// Module dependencies
const esprima = require('esprima');

// Project dependencies
const replaceRootIdentifiers = require('./context-converter.js'),
    validate = require('./expression-validator.js'),
    buildExpression = require('./expression-builder.js');

// Constants
const EMPTY = Symbol('empty');
const PARSER_OPTIONS = { loc: true };

/**
 * Parses config source and returns a value
 * @param {string} str The source to parse
 * @param {object} options Options to parse with
 * @param {string|boolean} options.id The name of the id field to register in the context. If this is false no id field
 *                                      will be defined thus no objects will be registered
 * @param {string} options.errorContext A context string to use with errors to define where the source comes from
 * @param {object|function} options.context A context lookup function for expressions, or an object to create a context
 *                                              lookup from
 * @returns {*} The parsed config
 */
module.exports = function parser(str, options) {
    const locals = Object.create(null);
    str = String(str);

    // Special case
    if (str.trim() === '') {
        return undefined;
    }

    // Make options truthy to make it easier to work with
    options = options || {};

    // Get the context
    const context = processContext(options.context);

    // Get the error context string for the source
    const errorContext = options.errorContext ?
        ` in ${options.errorContext}` :
        '';

    // Get the AST to process
    const ast = generateAst(str);

    // Generate and return the object (Note: It should not be possible to have an expression directly// )
    const root = processAst(undefined, ast);
    return root;

    /**
     * Processes config AST to create config objects
     * @param {string} propertyName The name of the property the AST is for (undefined for root)
     * @param {object} ast The AST representing the config
     * @returns {*} The processed config
     */
    function processAst(propertyName, ast) {
        switch (ast.type) {
            case 'Literal':
                return processLiteral(ast);
            case 'ObjectExpression':
                return processObjectExpression(ast);
            case 'ArrayExpression':
                return processArrayExpression(ast);
            default:
                ast = replaceRootIdentifiers(propertyName, ast);
                const expression = processExpression(propertyName, errorContext, ast, context);
                if (isConstantExpression(ast)) {
                    return expression();
                } else {
                    return expression;
                }
        }

        /**
         * Converts an object expression to an object
         * @param {object} ast The object expression
         * @returns {object} The object with the recursively processed properties
         */
        function processObjectExpression(ast) {
            let id;

            const res = {};
            ast.properties.forEach(processProperty);

            if (typeof context.register === 'function' && id) {
                context.register(id, res);
            }

            return res;

            /**
             *
             * @param {string} prop Processes the named property and attaches it's value to the object
             */
            function processProperty(prop) {
                let name;
                switch (prop.key.type) {
                    case 'Identifier':
                        name = prop.key.name;
                        break;
                    case 'Literal':
                        name = prop.key.value;
                        break;
                    /* istanbul ignore next */
                    default:
                        throw new Error(`Unable to process block of type ${prop.key.type} for a key name!`);
                }
                processElement(res, name, prop.value);
                if (name === options.id) {
                    id = res[name];
                }
            }
        }

        /**
         * Processes an array expression creating an array with the sub items recursively processed
         * @param {object} ast The array syntax tree
         * @returns {array} An array containing the processed data
         */
        function processArrayExpression(ast) {
            const res = [];
            ast.elements.forEach((element, index) => processElement(res, index, element));
            return res;
        }

        /**
         * Turns a "Literal" into a value
         * @param {object} ast The syntax tree containing the literal data
         * @returns {string|number|boolean|undefined|null|RegExp} The processed literal
         */
        function processLiteral(ast) {
            if (ast.regex) {
                return new RegExp(ast.regex.pattern, ast.regex.flags);
            } else {
                return ast.value;
            }
        }

        /**
         * Processes the element and attaches it to the object
         * @param {object} res The object the element is being prcessed for
         * @param {string|number} name The name of the element
         * @param {object} ast The AST representing the element
         */
        function processElement(res, name, ast) {
            const element = processAst(name, ast);
            if (typeof element === 'function') {
                const def = expressionDefinition(element);
                Object.defineProperty(res, name, def);
            } else {
                res[name] = element;
            }
        }

        /**
         * Checks whether the supplied AST is a constant expression or not
         * @param {object} ast The AST to check
         * @returns {boolean} true if the AST represents a constant expression, else false
         */
        function isConstantExpression(ast) {
            if (!isAst(ast) && !Array.isArray(ast)) {
                return true;
            } else if (ast.type === 'CallExpression') {
                return false;
            } else {
                const someNonConstant = Object.keys(ast).some(k => !isConstantExpression(ast[k]));
                return !someNonConstant;
            }

            /**
             * Check that the supplied value is a valid AST block
             * @param {object} ast The ast to check
             */
            function isAst(ast) {
                return ast && ast.type && typeof ast.type === 'string';
            }
        }

        /**
         * Creates an expression property definition
         * @param {function} expression The expression getter
         */
        function expressionDefinition(expression) {
            let override = EMPTY;
            set.reset = reset;
            return {
                configurable: true,
                enumerable: true,
                get,
                set
            };

            /** Gets the expression value. */
            function get() {
                if (override === EMPTY) {
                    return expression(this);
                } else {
                    return override;
                }
            }

            /**
             * Sets an override for the expression
             * @param {*} value The override value
             */
            function set(value) {
                override = value;
            }

            /** A helper function which can be used to clear an override */
            function reset() {
                override = EMPTY;
            }
        }

        /**
         * Validates and prepares the expression AST and creates a function representing the expression
         * @param {string} propertyName The name of the property the expression is being attached to
         * @param {string} errorContext The context the expression was created in
         * @param {object} ast The expression AST to use to generate the expression function
         * @param {function|object} context A context object to look values up on or a context function to use directly
         */
        function processExpression(propertyName, errorContext, ast, context) {
            validate(ast);
            context = processContext(context);
            const expression = buildExpression(propertyName, errorContext, ast, context);
            return expression;
        }
    }

    /**
     * Attempts to generate an AST representation from the supplied source string
     * @param {string} str The string to generate the AST from
     * @returns {object} The AST representing the source
     * @throws {SyntaxError} If the source cannot be parsed
     */
    function generateAst(str) {
        let err;
        try {
            const ast = parse(str);
            return ast;
        } catch (ex) {
            // Store the error, but attempt with some wrapping first
            err = new SyntaxError(`${ex.message}${errorContext}`);
        }

        // Attempt as an object
        try {
            const ast = parse(`{${str}}`);
            return ast;
        } catch (ex) {
            // Do nothing
        }

        // Attempt edge case arrays
        try {
            const ast = parse(`[${str}]`);
            return ast;
        } catch (ex) {
            // Throw the orinal error
            throw err;
        }

        /**
         * Parses a string and unwraps the AST
         * @param {string} str The string to parse
         */
        function parse(str) {
            str = `const placeholder = ${str}`;
            const ast = esprima.parseScript(str, PARSER_OPTIONS);
            return ast.body[0].declarations[0].init;
        }
    }

    /**
     * Returns the context function or creates one based on the supplied object.
     * @param {function|object|undefined} ctx The context function or object to create the context function with.
     */
    function processContext(ctx) {
        const context = ctx || Object.create(null);
        if (typeof context === 'function') {
            return context;
        } else if (context && typeof context === 'object') {
            return createDefaultLookup(context);
        } else {
            throw new TypeError(`When supplied, context MUST be a function or an object. Got ${ctx && typeof ctx}`);
        }
    }

    /**
     * Creates a context lookup function based on the supplied environment values
     * @param {object} environment The object to use as the environment lookup
     */
    function createDefaultLookup(environment) {
        defaultLookup.register = register;
        return defaultLookup;

        /**
         * Looks up the supplied identifier.
         * @param {object} obj The object we are fetching the identifier from
         * @param {string} propertyName The name of the identifier we are fetching
         * @param {string} id The name of the identifier we are fetching
         * @param {boolean} nothrow true to return undefined if the identifier is not found. false to throw a ReferenceError.
         */
        function defaultLookup(obj, propertyName, id, nothrow) {
            if (id === 'this') {
                return obj;
            } else if (id in environment) {
                return environment[id];
            } else if (id in obj) { // this shortcut
                return obj[id];
            } else if (id in locals) {
                return locals[id];
            } else if (id === 'base') {
                const proto = Object.getPrototypeOf(obj);
                return proto && proto[propertyName];
            } else if (nothrow) {
                return undefined;
            } else {
                throw new ReferenceError(`${id} is not defined`);
            }
        }

        /**
         * Registers an object with the lookup
         * @param {string} id The id of the objecy
         * @param {object} obj The object
         */
        function register(id, obj) {
            locals[id] = obj;
        }
    }
};

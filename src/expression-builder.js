// Module dependencies
const escodegen = require('escodegen');

// Project Dependencies
const astUtil = require('./ast-util.js');

// Constants
const EMPTY = Symbol('empty');

/**
 * Builds an expression getter function
 * @param {string} propertyName The name of the property the expression is bound to (Used for error information)
 * @param {string} errorContext The context in which the expression was defined. This will be returned in any expression
 *                                  errors.
 * @param {object} ast The expression AST
 * @param {function} context The context lookup function
 */
module.exports = function buildExpression(propertyName, errorContext, ast, context) {
    const staticCall = astUtil.isStaticCallRoot(ast);
    let value = EMPTY;
    let hasError = false;

    // If we gave a static call we need to unwrap
    if (staticCall) {
        if (ast.arguments.length === 0) {
            return noop;
        }
        if (ast.arguments.length === 1) {
            ast = ast.arguments[0];
        } else {
            ast = {
                type: 'SequenceExpression',
                expressions: ast.arguments
            };
        }
    }
    const position = getLineCol(ast);
    if (errorContext) {
        errorContext = ` from ${errorContext}`;
    } else {
        errorContext = '';
    }

    // Create the function to get the value
    const expressionFunction = generateExpressionFunction(ast);

    // Return the getter
    return get;

    /**
     * Gets the expression value
     * @param {object} obj The object the expression is being executed on
     * @returns {*} The expression value
     */
    function get(obj) {
        if (value !== EMPTY) {
            if (hasError) {
                throw value;
            } else {
                return value;
            }
        }

        try {
            const expressionResult = expressionFunction.call(obj, context);
            if (staticCall) {
                value = expressionResult;
            }
            return expressionResult;
        } catch (ex) {
            const err = new Error(`Error getting ${propertyName}${errorContext}. ${ex.message}.${position}`);
            if (staticCall) {
                value = err;
                hasError = true;
            }
            throw err;
        }
    }

    /**
     * Get's a string containing the line and column information for the expression
     * @param {object} ast The AST to get the line and column text for
     * @returns {string} A string containing the line and column information
     */
    function getLineCol(ast) {
        if (ast.loc && ast.loc.start) {
            return `. Line: ${ast.loc.start.line}. Column ${ast.loc.start.column}`;
        } else {
            return '';
        }
    }

    /**
     * Generates the function that will execute the expression contents
     * @param {object} ast The AST containing the expression contents
     * @returns {function} The function to execute to rertrieve the result
     */
    function generateExpressionFunction(ast) {
        const source = escodegen.generate({
            type: 'ReturnStatement',
            argument: ast
        });
        const expressionFunction = new Function('context', source);
        return expressionFunction;
    }

    /** Used in the case a static root has no arguments */
    function noop() {
        // Does nothing
    }

};

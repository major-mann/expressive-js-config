/**
* @module Parser module. This module is responsible for parsing the text into an config object
*  which can then be read by the consumer.
*/

// Dependencies
const astUtil = require('./ast-util.js');

// Public API
module.exports = processIdentifiers;

/**
* Replaces identifiers that are not in the list of VALID_GLOBALS with a call to
* context with the name of the identifier.
* @param {object} obj The AST block.
*/
function processIdentifiers(propertyName, obj) {
    const staticCall = astUtil.isStaticCallRoot(obj);
    // Create a set to hold the references we want to
    //  tie up change event watchers to.
    const refs = new Set();
    // Convert identifiers to context calls
    if (staticCall) {
        obj.arguments.forEach(process);
    } else {
        process(obj);
    }
    obj.refs = Array.from(refs);
    return obj;

    /**
     * Recursively processes through AST to extract root identifiers and convert them to context calls
     * @param {*} val The value to process. If this is not a valid AST block or an array, nothing will be done
     * @param {boolean} tof true if the caller of this is a unary typeof
     */
    function process(val, tof) {
        if (!isAst(val) && !Array.isArray(val)) {
            return;
        }
        switch (val.type) {
            case 'ThisExpression':
                convertToContextCall(val, 'this');
                break;
            case 'Identifier':
                refs.add(val.name);
                convertToContextCall(val, val.name);
                break;
            case 'MemberExpression':
                process(val.object);
                break;
            case 'UnaryExpression':
                if (val.operator === 'typeof') {
                    process(val.argument, true);
                    return;
                }
                // fall-through
            default:
                Object.keys(val).forEach(key => process(val[key]));
        }

        /**
         * Converts the given block to a context call
         * @param {object} val The AST block to convert
         * @param {string} id The name to lookup with context
         */
        function convertToContextCall(val, id) {
            Object.keys(val).forEach(removeField);

            val.type = 'CallExpression';
            val.callee = {
                type: 'Identifier',
                name: 'context'
            };
            val.arguments = [
                { type: 'ThisExpression' },
                { type: 'Literal', value: propertyName },
                { type: 'Literal', value: id },
                { type: 'Literal', value: !!tof }
            ];

            /**
             * Removes a field from the object
             * @param {string} name The name of the field to remove
             */
            function removeField(name) {
                delete val[name];
            }
        }
    }

    /** Checks whether the supplied value is an AST block */
    function isAst(ast) {
        return ast && ast.type && typeof ast.type === 'string';
    }
}

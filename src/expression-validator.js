/**
 * Validates that the supplied AST is valid
 * @param {object} node The AST of the expression to validate
 */
module.exports = function walk(node) {
    if (node && node.type && typeof node.type === 'string') {
        if (!blockSupported(node)) {
            throw new Error(`Blocks of type "${node.type}" are not supported!`);
        }
        Object.keys(node).forEach(k => walk(node[k]));
    }
};

/** Checks whether the supplied block type is supported in expressions. */
function blockSupported(block) { // eslint-disable-line complexity
    switch (block.type) {
        case 'ConditionalExpression':
        case 'ObjectExpression':
        case 'BinaryExpression':
        case 'MemberExpression':
        case 'UnaryExpression':
        case 'ArrayExpression':
        case 'TemplateLiteral':
        case 'TemplateElement':
        case 'CallExpression':
        case 'ThisExpression':
        case 'NewExpression':
        case 'Identifier':
        case 'Property':
        case 'Literal':
            return true;
        default:
            return false;
    }
}

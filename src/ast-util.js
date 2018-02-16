module.exports = {
    isStaticCallRoot
};

/**
 * Checks whether the supplied AST has a static call at it's root
 * @param {object} ast The expression syntax tree to check
 * @returns {boolean} true if the block has a static call at the roort, else false
 */
function isStaticCallRoot(ast) {
    return ast.type === 'CallExpression' &&
        ast.callee.type === 'Identifier' &&
        ast.callee.name === 'static';
}

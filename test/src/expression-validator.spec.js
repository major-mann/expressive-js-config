describe('Expression validator', function () {
    let validate;
    beforeEach(function () {
        validate = require('../../src/expression-validator.js');
    });
    it('should ensure the supplied AST does not have any invalid block types', function () {
        expect(() => validate({ type: 'ArrowExpression' })).to.throw(/not.*supported/i);
        expect(() => validate({ type: 'FunctionDeclaration' })).to.throw(/not.*supported/i);
        expect(() => validate({ type: 'FunctionExpression' })).to.throw(/not.*supported/i);
        expect(() => validate({ type: 'IfStatement' })).to.throw(/not.*supported/i);
    });
});

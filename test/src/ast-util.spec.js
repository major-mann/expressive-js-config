describe('AST utilities', function () {
    let util;
    beforeEach(function () {
        util = require('../../src/ast-util.js');
    });
    describe('isStaticCallRoot', function () {
        it('should return true if the supplied AST node is a call to an identifier named "static"', function () {
            expect(util.isStaticCallRoot({ type: 'Identifier', name: 'foo' })).to.equal(false);
            expect(util.isStaticCallRoot({ type: 'CallExpression', callee: { type: 'Identifier', name: 'foo' }, arguments: [] })).to.equal(false);
            expect(util.isStaticCallRoot({ type: 'CallExpression', callee: { type: 'Identifier', name: 'static' }, arguments: [] })).to.equal(true);
        });
    });
});

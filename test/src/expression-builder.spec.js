describe('expression builder', function () {
    let build, ast;
    beforeEach(function () {
        build = require('../../src/expression-builder.js');
        ast = {
            type: 'Identifier',
            name: 'bar'
        };
    });
    it('should include supplied error context in expression errors', function () {
        const fakeErrorContext = 'fake-context';
        const expression = build('foo', fakeErrorContext, ast);
        expect(() => expression()).to.throw(/fake-context.*bar/i);
    });
    it('should include line and column information in expression errors if the AST has the information', function () {
        ast = {
            type: 'Identifier',
            name: 'bar',
            loc: {
                start: {
                    line: 123,
                    column: 456
                }
            }
        };
        const expression = build('foo', undefined, ast);
        expect(() => expression()).to.throw(/line.*123.*column.*456/i);
    });
    it('should only execute an expression once if it is wrapped in a "static" call', function () {
        const fooSpy = chai.spy();
        ast = {
            type: 'CallExpression',
            callee: {
                type: 'Identifier',
                name: 'static'
            },
            arguments: [{
                type: 'CallExpression',
                callee: {
                    type: 'CallExpression',
                    callee: {
                        type: 'Identifier',
                        name: 'context'
                    },
                    arguments: [
                        { type: 'Literal', value: '' },
                        { type: 'Literal', value: '' },
                        { type: 'Literal', value: 'foo' }
                    ]
                },
                arguments: []
            }]
        };

        const expression = build('foo', undefined, ast, fakeContext);
        expect(fooSpy).to.have.been.called.exactly(0);
        expression();
        expect(fooSpy).to.have.been.called.exactly(1);
        expression();
        expect(fooSpy).to.have.been.called.exactly(1);

        function fakeContext(obj, prop, id) {
            expect(id).to.equal('foo');
            return fooSpy;
        }
    });
    it('should provide a noop function if static has no arguments', function () {
        ast = {
            type: 'CallExpression',
            callee: {
                type: 'Identifier',
                name: 'static'
            },
            arguments: []
        };
        const expression = build('foo', undefined, ast, undefined);
        expect(expression()).to.equal(undefined);
    });
    it('should re-throw any occuring error on every access if an error occured in the expression on a static call at first access', function () {
        let err;
        const fooSpy = chai.spy();
        ast = {
            type: 'CallExpression',
            callee: {
                type: 'Identifier',
                name: 'static'
            },
            arguments: [{
                type: 'CallExpression',
                callee: {
                    type: 'CallExpression',
                    callee: {
                        type: 'Identifier',
                        name: 'context'
                    },
                    arguments: [
                        { type: 'Literal', value: '' },
                        { type: 'Literal', value: '' },
                        { type: 'Literal', value: 'foo' }
                    ]
                },
                arguments: []
            }]
        };

        const expression = build('foo', undefined, ast, fakeContext);
        expect(fooSpy).to.have.been.called.exactly(0);
        try {
            expression();
        } catch (ex) {
            err = ex;
        }
        try {
            expression();
        } catch (ex) {
            expect(ex).to.equal(err);
        }

        function fakeContext() {
            throw new Error('fake');
        }
    });
    it('should treat multiple arguments to static as a SequenceExpression', function () {
        ast = {
            type: 'CallExpression',
            callee: {
                type: 'Identifier',
                name: 'static'
            },
            arguments: [{
                type: 'CallExpression',
                callee: {
                    type: 'CallExpression',
                    callee: {
                        type: 'Identifier',
                        name: 'context'
                    },
                    arguments: [
                        { type: 'Literal', value: '' },
                        { type: 'Literal', value: '' },
                        { type: 'Literal', value: 'foo' }
                    ]
                },
                arguments: []
            }, {
                type: 'Literal',
                value: 123
            }]
        };

        const expression = build('foo', undefined, ast, fakeContext);
        expect(expression()).to.equal(123);

        function fakeContext() {
            return () => 0;
        }
    });
});

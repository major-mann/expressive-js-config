describe('context converter', function () {
    let convert, sampleAst;
    beforeEach(function () {
        convert = require('../../src/context-converter.js');
        sampleAst = {
            type: 'CallExpression',
            callee: {
                type: 'Identifier',
                name: 'static'
            },
            arguments: [
                {
                    type: 'CallExpression',
                    callee: {
                        type: 'Identifier',
                        name: 'foo'
                    },
                    arguments: []
                }
            ]
        };
    });

    it('should not convert an outer static call', function () {
        const res = convert('prop', sampleAst);
        expect(res.type).to.equal('CallExpression');
        expect(res.callee.type).to.equal('Identifier');
        expect(res.callee.name).to.equal('static');
    });
    it('should convert all root identifiers to calls to "context"', function () {
        const res = convert('prop', sampleAst);
        expect(res.arguments[0].type).to.equal('CallExpression');
        expect(res.arguments[0].callee.type).to.equal('CallExpression');
        expect(res.arguments[0].callee.callee.type).to.equal('Identifier');
        expect(res.arguments[0].callee.callee.name).to.equal('context');
    });
    it('should attach an array of converted identifiers to the result', function () {
        const res = convert('prop', sampleAst);
        expect(res.refs).to.be.an('array');
        expect(res.refs.length).to.equal(1);
        expect(res.refs[0]).to.equal('foo');
    });

    describe('context arguments', function () {
        let converted, args;
        beforeEach(function () {
            converted = convert('prop', sampleAst);
            args = converted.arguments[0].callee.arguments;
        });
        it('should pass "this" as the first argument', function () {
            expect(args[0].type).to.equal('ThisExpression');
        });
        it('should pass the property name as the second argument', function () {
            expect(args[1].type).to.equal('Literal');
            expect(args[1].value).to.equal('prop');
        });
        it('should pass the name of the identifier as the third argument', function () {
            expect(args[2].type).to.equal('Literal');
            expect(args[2].value).to.equal('foo');
        });
        it('should pass a boolean indicating whether the lookup is part of a typeof expression', function () {
            expect(args[3].type).to.equal('Literal');
            expect(args[3].value).to.equal(false);

            sampleAst = {
                type: 'UnaryExpression',
                operator: 'typeof',
                argument: {
                    type: 'Identifier',
                    name: 'foo'
                }
            };
            converted = convert('prop', sampleAst);
            args = converted.argument.arguments;
            expect(args[3].type).to.equal('Literal');
            expect(args[3].value).to.equal(true);
        });
    });
});

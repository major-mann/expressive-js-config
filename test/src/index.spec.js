describe('parser', function () {
    let parser;
    beforeEach(function () {
        parser = require('../../src/index.js');
    });

    describe('simple cases', function () {
        it('should return undefined from an empty string', function () {
            expect(parser('')).to.equal(undefined);
        });
        it('should coerce the value into a string', function () {
            const obj = {
                toString: () => '{ foo: "bar" }'
            };
            const res = parser(obj);
            expect(res).to.be.an('object');
            expect(res.foo).to.equal('bar');
        });
    });
    describe('context', function () {
        it('should ensure context is an object or function', function () {
            expect(() => parser('{}', { context: 123 })).to.throw(/function.*object/i);
        });
        it('should lookup the values in the custom function if one is supplied', function () {
            const context = chai.spy();
            const obj = parser('{ foo: bar }', { context });
            expect(context).to.have.been.called.exactly(0);
            expect(obj.foo).to.equal(undefined);
            expect(context).to.have.been.called.exactly(1);
        });
        it('should call context.register when an object with an id is encountered and context.register is a function', function () {
            const context = chai.spy();
            context.register = chai.spy();
            parser('{ foo: "bar", sub: { id: "sub", foo: "baz" } }', { id: 'id', context });
            expect(context.register).to.have.been.called.with('sub');
        });
        it('should lookup values on the custom object if one is supplied', function () {
            const context = {
                bar: 'baz'
            };
            const obj = parser('{ foo: bar }', { context });
            expect(obj.foo).to.equal(context.bar);
        });
        it('should return the object when "this" is used as an identifier and the default context function is in place', function () {
            const obj = parser('{ foo: this }');
            expect(obj.foo).to.equal(obj);
        });
        it('should return the prototype value when "base" is used as an identifier and the default context function is in place', function () {
            const proto = { foo: 'bar' };
            const obj = parser('{ foo: base }');
            Object.setPrototypeOf(obj, proto);
            expect(obj.foo).to.equal('bar');
        });
        it('should return the value from the object when an identifier is in the object, but not in the supplied context object', function () {
            const obj = parser('{ foo: "bar", hello: foo }');
            expect(obj.hello).to.equal('bar');
        });
        it('should return the value from the registered locals when an identifier is not in the object, not in the supplied context object, but has been registered with an id property', function () {
            const context = chai.spy();
            context.register = chai.spy();
            const obj = parser('{ foo: sub, sub: { id: "sub", foo: "baz" } }', { id: 'id' });
            expect(obj.foo).to.equal(obj.sub);
        });
        it('should not throw if the identifier does not exist, but is part of a typeof statement', function () {
            const obj = parser('{ foo: typeof bar }');
            expect(obj.foo).to.equal('undefined');
        });
        it('should throw a ReferenceError if the identifier does not exist', function () {
            const obj = parser('{ foo: bar, hello: "world", baz: void foo }', { context: { Function } });
            expect(() => obj.foo).to.throw(/bar/);
        });
    });
    describe('parse', function () {
        it('should allow value types to be defined and returned directly', function () {
            expect(parser('123')).to.equal(123);
            expect(parser('"foo bar"')).to.equal('foo bar');
        });
        it('should allow "{" and "}" to be ommitted in the case of objects', function () {
            const obj = parser('foo: "bar"');
            expect(obj).to.be.an('object');
            expect(obj.foo).to.equal('bar');
        });
        it('should allow "[" and "]" to be ommitted in the case of arrays', function () {
            const obj = parser('"bar", "baz"');
            expect(obj).to.be.an('array');
            expect(obj[0]).to.equal('bar');
            expect(obj[1]).to.equal('baz');

            const obj2 = parser('1,2,3');
            expect(obj2).to.be.an('array');
            expect(obj2[0]).to.equal(1);
            expect(obj2[1]).to.equal(2);
            expect(obj2[2]).to.equal(3);
        });
        it('should indicate the line number in the case of a syntax error', function () {
            expect(() => parser('\n\n    <')).to.throw(/line.*3/i);
        });
        it('should return the supplied error context for errors', function () {
            expect(() => parser('\n\n    <', { errorContext: 'fake-context' })).to.throw(/fake-context/i);
        });
    });
    describe('process', function () {
        it('should attach values as standard public JS properties', function () {
            const obj = parser('{ foo: "bar" }');
            const desc = Object.getOwnPropertyDescriptor(obj, 'foo');
            expect(desc).to.be.an('object');
            expect(desc.configurable).to.equal(true);
            expect(desc.enumerable).to.equal(true);
            expect(desc.value).to.equal('bar');
        });
        it('should attach expressions as accessors', function () {
            const obj = parser('{ foo: "bar", baz: foo }');
            const desc = Object.getOwnPropertyDescriptor(obj, 'baz');
            expect(desc).to.be.an('object');
            expect(desc.configurable).to.equal(true);
            expect(desc.enumerable).to.equal(true);
            expect(desc.get).to.be.an('function');
        });
        it('should attach expressions made up of constants as standard JS properties', function () {
            const obj = parser('{ foo: "bar", baz: 60 * 1000 }');
            const desc = Object.getOwnPropertyDescriptor(obj, 'baz');
            expect(desc).to.be.an('object');
            expect(desc.configurable).to.equal(true);
            expect(desc.enumerable).to.equal(true);
            expect(desc.value).to.equal(60000);
        });
        it('should handle literal property keys correctly', function () {
            const obj = parser('{ "foo": "bar" }');
            expect(obj.foo).to.equal('bar');
        });
    });
    describe('set', function () {
        it('should override an expression value when a value with an expression is set', function () {
            const obj = parser('{ "foo": "bar", baz: foo }');
            expect(obj.baz).to.equal('bar');
            obj.foo = 'hello';
            expect(obj.baz).to.equal('hello');
            obj.baz = 'something else';
            obj.foo = 'world';
            expect(obj.baz).to.equal('something else');
        });
        it('should have a reset function attached to the setter which can remove the override', function () {
            const obj = parser('{ "foo": "bar", baz: foo }');
            expect(obj.baz).to.equal('bar');
            obj.foo = 'hello';
            expect(obj.baz).to.equal('hello');
            obj.baz = 'something else';
            obj.foo = 'world';
            expect(obj.baz).to.equal('something else');
            const desc = Object.getOwnPropertyDescriptor(obj, 'baz');
            expect(desc.set.reset).to.be.a('function');
            desc.set.reset();
            expect(obj.baz).to.equal('world');
        });
    });
});

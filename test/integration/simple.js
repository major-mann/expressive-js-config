describe('Simple integration test', function () {
    let fs, path, util, parser, simplePath, simpleText;
    beforeEach(async function () {
        fs = require('fs');
        util = require('util');
        path = require('path');
        parser = require('../../src/index.js');
        simplePath = path.join(__dirname, '../data/simple.ejsc');
        simpleText = await util.promisify(fs.readFile)(simplePath, { encoding: 'utf8' });
    });
    it('should load without error', function () {
        expect(() => parser(simpleText)).not.to.throw();
    });
    it('should correctly load the values', function () {
        const obj = parser(simpleText);
        expect(obj.foo).to.equal('bar');
        expect(obj.baz).to.equal(123);
        expect(obj.hello).to.be.an('array');
        expect(obj.regex instanceof RegExp).to.equal(true);
        expect(obj.regex.flags).to.equal('i');
        expect(obj.regex.source).to.equal('abc');
    });
});

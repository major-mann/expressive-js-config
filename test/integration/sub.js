describe('Sub integration test', function () {
    let fs, path, util, parser, subPath, subText;
    beforeEach(async function () {
        fs = require('fs');
        util = require('util');
        path = require('path');
        parser = require('../../src/index.js');
        subPath = path.join(__dirname, '../data/sub.ejsc');
        subText = await util.promisify(fs.readFile)(subPath, { encoding: 'utf8' });
    });
    it('should load without error', function () {
        expect(() => parser(subText)).not.to.throw();
    });
    it('should correctly load the values', function () {
        const obj = parser(subText);
        expect(obj.foo).to.be.an('object');
        expect(obj.foo.bar).to.be.an('object');
        expect(obj.foo.bar.baz).to.equal('hello world');
        expect(obj.foo.hello).to.be.an('object');
        expect(obj.foo.hello.world).to.equal(123);
    });
});

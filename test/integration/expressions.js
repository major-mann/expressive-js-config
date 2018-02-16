describe('Expressions integration test', function () {
    let fs, path, util, parser, expressionsPath, expressionsText;
    beforeEach(async function () {
        fs = require('fs');
        util = require('util');
        path = require('path');
        parser = require('../../src/index.js');
        expressionsPath = path.join(__dirname, '../data/expressions.ejsc');
        expressionsText = await util.promisify(fs.readFile)(expressionsPath, { encoding: 'utf8' });
    });
    it('should load without error', function () {
        expect(() => parser(expressionsText)).not.to.throw();
    });
    it('should correctly load the values', function () {
        const obj = parser(expressionsText, { id: 'id' });
        expect(obj.domain).to.equal('example.com');
        expect(obj.port).to.equal(8080);
        expect(obj.protocol).to.equal('https');
        expect(obj.uri).to.equal('https://example.com:8080');
        expect(obj.paths).to.be.an('array');
        expect(obj.paths[0]).to.equal('/info');
        expect(obj.paths[1]).to.equal('/help');
        expect(obj.paths[2]).to.equal('/secure');

        obj.port = 80;
        expect(obj.uri).to.equal('https://example.com');

        obj.protocol = 'http';
        expect(obj.uri).to.equal('http://example.com');
        expect(obj.paths[2]).to.equal('/public');
    });
    it('should make constant expressions constant values', function () {
        const obj = parser(expressionsText, { id: 'id' });

        const dynamicDef = Object.getOwnPropertyDescriptor(obj, 'uri');
        const staticDef = Object.getOwnPropertyDescriptor(obj, 'constant');

        expect(dynamicDef.get).to.be.a('function');
        expect(dynamicDef.value).to.equal(undefined);

        expect(staticDef.get).to.equal(undefined);
        expect(staticDef.value).not.to.equal(undefined);
    });
});

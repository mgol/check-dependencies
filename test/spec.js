'use strict';

var chalk = require('chalk'),
    expect = require('expect.js'),
    checkDependencies = require('../check-dependencies');

describe('checkDependencies', function () {
    var output = {error: [], log: []};

    function hijackConsole(methodName) {
        var original = console[methodName];
        console[methodName] = function (result) {
            output[methodName].push(chalk.stripColor(result));
        };
        console[methodName]._original = original;
    }

    beforeEach(function () {
        hijackConsole('log');
        hijackConsole('error');
    });

    afterEach(function () {
        output.error = [];
        output.writeln = [];

        console.log = console.log._original;
        console.error = console.error._original;
    });

    it('should not print anything for valid package setup', function (done) {
        checkDependencies({
            packageDir: './test/ok/',
            scopeList: ['dependencies', 'devDependencies'],
            install: false,
        }, function (error) {
            expect(error).to.be(undefined);
            expect(output.error).to.eql([]);
            done();
        });
    });

    it('should error on invalid package setup', function (done) {
        checkDependencies({
            packageDir: './test/not-ok/',
            scopeList: ['dependencies', 'devDependencies'],
            install: false,
        }, function (error) {
            expect(error).not.to.be(undefined);
            expect(output.error).to.eql([
                'a: installed: 1.2.4, expected: 1.2.3',
                'b: installed: 0.9.9, expected: >=1.0.0',
                'c: not installed!',
            ]);
            done();
        });
    });
});

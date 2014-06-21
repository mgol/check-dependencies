'use strict';

var chalk = require('chalk'),
    fs = require('fs-extra'),
    semver = require('semver'),
    chai = require('chai'),
    assert = chai.assert,
    expect = chai.expect,
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

    it('should not print errors for valid package setup', function (done) {
        checkDependencies({
            packageDir: './test/ok/',
            scopeList: ['dependencies', 'devDependencies'],
            install: false,
        }, function (error) {
            expect(error).to.not.exist;
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
            expect(error).to.exist;
            expect(output.error).to.eql([
                'a: installed: 1.2.4, expected: 1.2.3',
                'b: installed: 0.9.9, expected: >=1.0.0',
                'c: not installed!',
            ]);
            done();
        });
    });

    it('should accept scopeList parameter', function (done) {
        checkDependencies({
            packageDir: './test/not-ok/',
            scopeList: ['devDependencies'],
            install: false,
        }, function (error) {
            expect(error).to.not.exist;
            expect(output.error).to.eql([]);
            done();
        });
    });

    it('should find package.json if packageDir not provided', function (done) {
        checkDependencies({
            install: false,
        }, function (error) {
            expect(error).to.not.exist;
            expect(output.error).to.eql([]);
            done();
        });
    });

    it('should throw if callback not provided', function () {
        expect(function () {
            checkDependencies({
                packageDir: './test/not-ok/',
                scopeList: ['dependencies', 'devDependencies'],
                install: false,
            });
        }).to.throw();
    });

    it('should allow to provide callback as the first argument', function (done) {
        checkDependencies(function (error) {
            expect(error).to.not.exist;
            expect(output.error).to.eql([]);
            done();
        })
    });

    it('should install missing packages when install parameter is not set to false', function (done) {
        var versionRange = require('./not-ok-install/package.json').dependencies['check-dependencies'],
            version = JSON.parse(fs.readFileSync(__dirname +
                '/not-ok-install/node_modules/check-dependencies/package.json')).version;

        assert.equal(semver.satisfies(version, versionRange),
            false, 'Expected version ' + version + ' not to match ' + versionRange);
        this.timeout(30000);

        fs.remove(__dirname + '/not-ok-install-copy', function (error) {
            expect(error).to.not.exist;
            fs.copy(__dirname + '/not-ok-install', __dirname + '/not-ok-install-copy',
                function (error) {
                    expect(error).to.not.exist;
                    checkDependencies({
                        packageDir: './test/not-ok-install-copy/',
                    }, function (error) {
                        expect(error).not.to.exist;
                        expect(output.error).to.eql([
                            'check-dependencies: installed: 0.4.1, expected: <=0.2.5',
                        ]);
                        version = JSON.parse(fs.readFileSync(__dirname +
                            '/not-ok-install-copy/node_modules/' +
                            'check-dependencies/package.json')).version;
                        assert.equal(semver.satisfies(version, versionRange),
                            true, 'Expected version ' + version +
                                ' to match ' + versionRange);
                        done();
                    });
                });
        });
    });

});

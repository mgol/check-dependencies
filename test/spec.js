'use strict';

var chalk = require('chalk'),
    fs = require('fs-extra'),
    semver = require('semver'),
    assert = require('assert'),
    checkDependencies = require('../lib/check-dependencies');

describe('checkDependencies', function () {
    var errorsForNotOk = [
        'a: installed: 1.2.4, expected: 1.2.3',
        'b: installed: 0.9.9, expected: >=1.0.0',
        'c: not installed!',
        'Invoke npm install to install missing packages',
    ];

    beforeEach(function () {
        chalk.enabled = false;
    });

    it('should not print errors for valid package setup', function (done) {
        checkDependencies({
            packageDir: './test/ok/',
            scopeList: ['dependencies', 'devDependencies'],
        }, function (output) {
            assert.strictEqual(output.status, 0);
            assert.deepEqual(output.error, []);
            done();
        });
    });

    it('should error on invalid package setup', function (done) {
        checkDependencies({
            packageDir: './test/not-ok/',
            scopeList: ['dependencies', 'devDependencies'],
        }, function (output) {
            assert.strictEqual(output.status, 1);
            assert.deepEqual(output.error, errorsForNotOk);
            done();
        });
    });

    it('should accept `scopeList` parameter', function (done) {
        checkDependencies({
            packageDir: './test/not-ok/',
            scopeList: ['devDependencies'],
        }, function (output) {
            assert.strictEqual(output.status, 0);
            assert.deepEqual(output.error, []);
            done();
        });
    });

    it('should find package.json if `packageDir` not provided', function (done) {
        checkDependencies({}, function (output) {
            assert.strictEqual(output.status, 0);
            assert.deepEqual(output.error, []);
            done();
        });
    });

    it('should throw if callback not provided', function () {
        assert.throws(function () {
            checkDependencies({
                packageDir: './test/not-ok/',
                scopeList: ['dependencies', 'devDependencies'],
                install: false,
            });
        });
    });

    it('should allow to provide callback as the first argument', function (done) {
        checkDependencies(function (output) {
            assert.strictEqual(output.status, 0);
            assert.deepEqual(output.error, []);
            done();
        });
    });

    it('should support `log` and `error` options', function (done) {
        var logArray = [], errorArray = [];
        checkDependencies({
            packageDir: './test/not-ok/',
            verbose: true,
            log: function (msg) {
                logArray.push(msg);
            },
            error: function (msg) {
                errorArray.push(msg);
            },
        }, function (output) {
            // output.error shouldn't be silenced
            assert.deepEqual(output.error, errorsForNotOk);

            assert.deepEqual(logArray, output.log);
            assert.deepEqual(errorArray, output.error);
            done();
        });
    });

    it('should not print logs when `verbose` is not set to true', function (done) {
        var logArray = [], errorArray = [];
        checkDependencies({
            packageDir: './test/not-ok/',
            log: function (msg) {
                logArray.push(msg);
            },
            error: function (msg) {
                errorArray.push(msg);
            },
        }, function () {
            assert.deepEqual(logArray, []);
            assert.deepEqual(errorArray, []);
            done();
        });
    });

    it('should install missing packages when `install` is set to true', function (done) {
        var versionRange = require('./not-ok-install/package.json').dependencies.minimatch,
            version = JSON.parse(fs.readFileSync(__dirname +
                '/not-ok-install/node_modules/minimatch/package.json')).version;

        assert.equal(semver.satisfies(version, versionRange),
            false, 'Expected version ' + version + ' not to match ' + versionRange);

        this.timeout(30000);

        fs.remove(__dirname + '/not-ok-install-copy', function (error) {
            assert.equal(error, null);
            fs.copy(__dirname + '/not-ok-install', __dirname + '/not-ok-install-copy',
                function (error) {
                    assert.equal(error, null);
                    checkDependencies({
                        packageDir: './test/not-ok-install-copy/',
                        install: true,
                    }, function (output) {
                        assert.strictEqual(output.status, 0);
                        assert.deepEqual(output.error, [
                            'minimatch: installed: 0.2.2, expected: <=0.2.1',
                        ]);
                        version = JSON.parse(fs.readFileSync(__dirname +
                            '/not-ok-install-copy/node_modules/minimatch/package.json')).version;
                        assert.equal(semver.satisfies(version, versionRange),
                            true, 'Expected version ' + version +
                                ' to match ' + versionRange);
                        done();
                    });
                });
        });
    });

});

'use strict';

var chalk = require('chalk'),
    fs = require('fs-extra'),
    semver = require('semver'),
    assert = require('assert'),
    checkDependencies = require('../lib/check-dependencies');

describe('checkDependencies', function () {
    beforeEach(function () {
        chalk.enabled = false;
    });

    function testSuite(type) {
        var checkDeps, depsJsonName, depsDirName, errorsForNotOk;

        if (type === 'bower') {
            depsJsonName = 'bower.json';
            depsDirName = 'bower_components';
            checkDeps = function checkDependenciesBower() {
                var config = arguments[0];
                if (typeof config === 'object') {
                    config.type = 'bower';
                }
                return checkDependencies.apply(null, arguments);
            };
        } else {
            depsJsonName = 'package.json';
            depsDirName = 'node_modules';
            checkDeps = checkDependencies;
        }

        errorsForNotOk = [
            'a: installed: 1.2.4, expected: 1.2.3',
            'b: installed: 0.9.9, expected: >=1.0.0',
            'c: not installed!',
            'Invoke ' + type + ' install to install missing packages',
        ];

        it('should not print errors for valid package setup', function (done) {
            checkDeps({
                packageDir: './test/' + type + '-fixtures/ok/',
                scopeList: ['dependencies', 'devDependencies'],
            }, function (output) {
                assert.strictEqual(output.status, 0);
                assert.strictEqual(output.depsWereOk, true);
                assert.deepEqual(output.error, []);
                done();
            });
        });

        it('should error on invalid package setup', function (done) {
            checkDeps({
                packageDir: './test/' + type + '-fixtures/not-ok/',
                scopeList: ['dependencies', 'devDependencies'],
            }, function (output) {
                assert.strictEqual(output.status, 1);
                assert.strictEqual(output.depsWereOk, false);
                assert.deepEqual(output.error, errorsForNotOk);
                done();
            });
        });

        it('should accept `scopeList` parameter', function (done) {
            checkDeps({
                packageDir: './test/' + type + '-fixtures/not-ok/',
                scopeList: ['devDependencies'],
            }, function (output) {
                assert.strictEqual(output.status, 0);
                assert.strictEqual(output.depsWereOk, true);
                assert.deepEqual(output.error, []);
                done();
            });
        });

        it('should find ' + depsJsonName + ' if `packageDir` not provided', function (done) {
            checkDeps({}, function (output) {
                assert.strictEqual(output.status, 0);
                assert.strictEqual(output.depsWereOk, true);
                assert.deepEqual(output.error, []);
                done();
            });
        });

        it('should throw if callback not provided', function () {
            assert.throws(function () {
                checkDeps({
                    packageDir: './test/' + type + '-fixtures/not-ok/',
                    scopeList: ['dependencies', 'devDependencies'],
                    install: false,
                });
            });
        });

        it('should allow to provide callback as the first argument', function (done) {
            checkDeps(function (output) {
                assert.strictEqual(output.status, 0);
                assert.strictEqual(output.depsWereOk, true);
                assert.deepEqual(output.error, []);
                done();
            });
        });

        it('should support `log` and `error` options', function (done) {
            var logArray = [], errorArray = [];
            checkDeps({
                packageDir: './test/' + type + '-fixtures/not-ok/',
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
            checkDeps({
                packageDir: './test/' + type + '-fixtures/not-ok/',
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
            this.timeout(30000);

            var versionRange = require('./' + type + '-fixtures/not-ok-install/' + depsJsonName).dependencies.jquery,
                version = JSON.parse(fs.readFileSync(__dirname +
                    '/' + type + '-fixtures/not-ok-install/' + depsDirName + '/jquery/' + depsJsonName)).version;

            assert.equal(semver.satisfies(version, versionRange),
                false, 'Expected version ' + version + ' not to match ' + versionRange);

            fs.remove(__dirname + '/' + type + '-fixtures/not-ok-install-copy', function (error) {
                assert.equal(error, null);
                fs.copy(__dirname + '/' + type + '-fixtures/not-ok-install',
                        __dirname + '/' + type + '-fixtures/not-ok-install-copy',
                    function (error) {
                        assert.equal(error, null);
                        checkDeps({
                            packageDir: './test/' + type + '-fixtures/not-ok-install-copy/',
                            install: true,
                        }, function (output) {
                            // The functions is supposed to not fail because it's instructed to do
                            // `npm install`/`bower install`.
                            assert.strictEqual(output.status, 0);
                            assert.strictEqual(output.depsWereOk, false);
                            assert.deepEqual(output.error, [
                                'jquery: installed: 1.11.1, expected: <=1.11.0',
                            ]);
                            version = JSON.parse(fs.readFileSync(__dirname +
                                '/' + type + '-fixtures/not-ok-install-copy/' + depsDirName +
                                '/jquery/' + depsJsonName)).version;
                            assert(semver.satisfies(version, versionRange),
                                'Expected version ' + version + ' to match ' + versionRange);
                            done();
                        });
                    });
            });
        });
    }

    describe('npm', function () {
        testSuite('npm');
    });


    describe('bower', function () {
        testSuite('bower');
    });
});

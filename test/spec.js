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

    function testSuite(packageManager) {
        var checkDeps, depsJsonName, packageJsonName, depsDirName, errorsForNotOk;

        if (packageManager === 'bower') {
            packageJsonName = 'bower.json';
            depsJsonName = '.bower.json';
            depsDirName = 'bower_components';
            checkDeps = function checkDependenciesBower() {
                var args = [].slice.call(arguments),
                    config = arguments[0];
                if (typeof config === 'function') {
                    config = {};
                    args.unshift(config);
                }
                config.packageManager = 'bower';
                return checkDependencies.apply(null, args);
            };
        } else {
            packageJsonName = 'package.json';
            depsJsonName = 'package.json';
            depsDirName = 'node_modules';
            checkDeps = checkDependencies;
        }

        errorsForNotOk = [
            'a: installed: 1.2.4, expected: 1.2.3',
            'b: installed: 0.9.9, expected: >=1.0.0',
            'c: not installed!',
                'Invoke ' + packageManager + ' install to install missing packages',
        ];

        it('should not print errors for valid package setup', function (done) {
            checkDeps({
                packageDir: './test/' + packageManager + '-fixtures/ok/',
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
                packageDir: './test/' + packageManager + '-fixtures/not-ok/',
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
                packageDir: './test/' + packageManager + '-fixtures/not-ok/',
                scopeList: ['devDependencies'],
            }, function (output) {
                assert.strictEqual(output.status, 0);
                assert.strictEqual(output.depsWereOk, true);
                assert.deepEqual(output.error, []);
                done();
            });
        });

        it('should find ' + packageJsonName + ' if `packageDir` not provided', function (done) {
            checkDeps({}, function (output) {
                assert.strictEqual(output.status, 0);
                assert.strictEqual(output.depsWereOk, true);
                assert.deepEqual(output.error, []);
                done();
            });
        });

        it('should error if ' + packageJsonName + ' wasn\'t found in `packageDir`', function (done) {
            checkDeps({
                packageDir: './test/' + packageManager + '-fixtures/missing-json/',
            }, function (output) {
                assert.strictEqual(output.status, 1);
                assert.deepEqual(output.error, [
                    'Missing ' + packageJsonName + '!',
                ]);
                done();
            });
        });

        it('should throw if callback not provided', function () {
            assert.throws(function () {
                checkDeps({
                    packageDir: './test/' + packageManager + '-fixtures/not-ok/',
                    scopeList: ['dependencies', 'devDependencies'],
                    install: false,
                });
            });
        });

        if (packageManager === 'npm') {
            it('should allow to provide callback as the first argument', function (done) {
                checkDeps(function (output) {
                    assert.strictEqual(output.status, 0);
                    assert.strictEqual(output.depsWereOk, true);
                    assert.deepEqual(output.error, []);
                    done();
                });
            });
        }

        it('should support `log` and `error` options', function (done) {
            var logArray = [], errorArray = [];
            checkDeps({
                packageDir: './test/' + packageManager + '-fixtures/not-ok/',
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
                packageDir: './test/' + packageManager + '-fixtures/not-ok/',
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

        if (packageManager === 'bower') {
            it('should respect `directory` setting in `.bowerrc`', function (done) {
                checkDeps({
                    packageDir: './test/bower-fixtures/bowerrc/',
                }, function (output) {
                    assert.strictEqual(output.status, 0);
                    assert.strictEqual(output.depsWereOk, true);
                    assert.deepEqual(output.error, []);
                    done();
                });
            });
        }

        it('should install missing packages when `install` is set to true', function (done) {
            this.timeout(30000);

            var versionRange = require('./' + packageManager + '-fixtures/not-ok-install/' + packageJsonName)
                    .dependencies.jquery,
                fixtureDir = __dirname + '/' + packageManager + '-fixtures/not-ok-install',
                fixtureCopyDir = fixtureDir + '-copy',
                depVersion = JSON.parse(fs.readFileSync(__dirname +
                    '/' + packageManager + '-fixtures/not-ok-install/' + depsDirName +
                    '/jquery/' + depsJsonName)).version;

            assert.equal(semver.satisfies(depVersion, versionRange),
                false, 'Expected version ' + depVersion + ' not to match ' + versionRange);

            fs.remove(fixtureCopyDir, function (error) {
                assert.equal(error, null);
                fs.copy(fixtureDir, fixtureCopyDir, function (error) {
                    assert.equal(error, null);
                    checkDeps({
                        packageDir: './test/' + packageManager + '-fixtures/not-ok-install-copy/',
                        install: true,
                    }, function (output) {
                        // The functions is supposed to not fail because it's instructed to do
                        // `npm install`/`bower install`.
                        assert.strictEqual(output.status, 0);
                        assert.strictEqual(output.depsWereOk, false);
                        assert.deepEqual(output.error, [
                            'jquery: installed: 1.11.1, expected: <=1.11.0',
                        ]);
                        depVersion = JSON.parse(fs.readFileSync(fixtureCopyDir + '/' + depsDirName +
                            '/jquery/' + depsJsonName)).version;
                        assert(semver.satisfies(depVersion, versionRange),
                            'Expected version ' + depVersion + ' to match ' + versionRange);
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

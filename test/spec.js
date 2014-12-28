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
        var checkDeps, depsJsonName, packageJsonName, depsDirName, errorsForNotOk, pruneAndInstallMessage;

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
            'd: not installed!',
            'Invoke ' + packageManager + ' install to install missing packages',
        ];

        pruneAndInstallMessage = 'Invoke ' + packageManager + ' prune and ' +
            packageManager + ' install to install missing packages and remove ' +
            'excessive ones';


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
                checkGitUrls: true,
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

        it('should ignore excessive deps if `onlySpecified` not provided', function (done) {
            checkDeps({
                packageDir: './test/' + packageManager + '-fixtures/only-specified-not-ok',
            }, function (output) {
                assert.strictEqual(output.status, 0);
                assert.strictEqual(output.depsWereOk, true);
                assert.deepEqual(output.error, []);
                done();
            });
        });

        it('should ignore excessive deps if `onlySpecified` is `false`', function (done) {
            checkDeps({
                packageDir: './test/' + packageManager + '-fixtures/only-specified-not-ok',
                onlySpecified: false,
            }, function (output) {
                assert.strictEqual(output.status, 0);
                assert.strictEqual(output.depsWereOk, true);
                assert.deepEqual(output.error, []);
                done();
            });
        });

        it('should not error if no excessive deps and `onlySpecified` is `true`', function (done) {
            checkDeps({
                packageDir: './test/' + packageManager + '-fixtures/ok',
                onlySpecified: true,
            }, function (output) {
                assert.strictEqual(output.status, 0);
                assert.strictEqual(output.depsWereOk, true);
                assert.deepEqual(output.error, []);
                done();
            });
        });

        it('should error if there are excessive deps and `onlySpecified` is `true`', function (done) {
            checkDeps({
                packageDir: './test/' + packageManager + '-fixtures/only-specified-not-ok',
                onlySpecified: true,
            }, function (output) {
                assert.strictEqual(output.status, 1);
                assert.deepEqual(output.error, [
                    'Package c installed, though it shouldn\'t be',
                    pruneAndInstallMessage,
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
                checkGitUrls: true,
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

        it('should check Git URL based dependencies only if `checkGitUrls` is true', function (done) {
            checkDeps({
                packageDir: './test/' + packageManager + '-fixtures/git-urls/',
                scopeList: ['dependencies', 'devDependencies'],
            }, function (output) {
                assert.deepEqual(output.error, [
                    'b: not installed!',
                    'Invoke ' + packageManager + ' install to install missing packages',
                ]);
            });
            checkDeps({
                checkGitUrls: true,
                packageDir: './test/' + packageManager + '-fixtures/git-urls/',
                scopeList: ['dependencies', 'devDependencies'],
            }, function (output) {
                assert.deepEqual(output.error, [
                    'a: installed: 0.5.8, expected: 0.5.9',
                    'b: not installed!',
                    'Invoke ' + packageManager + ' install to install missing packages',
                ]);
                done();
            });
        });

        it('should check the version for Git URLs with valid semver tags only', function (done) {
            checkDeps({
                checkGitUrls: true,
                packageDir: './test/' + packageManager + '-fixtures/non-semver-tag/',
                scopeList: ['dependencies', 'devDependencies'],
            }, function (output) {
                assert.strictEqual(output.depsWereOk, true);
                done();
            });
        });

        it('should check a Git dependency is installed even if it\'s hash ' +
            'is not a valid semver tag', function (done) {
            checkDeps({
                checkGitUrls: true,
                packageDir: './test/' + packageManager + '-fixtures/non-semver-tag-pkg-missing/',
                scopeList: ['dependencies', 'devDependencies'],
            }, function (output) {
                assert.strictEqual(output.depsWereOk, false);
                assert.deepEqual(output.error, [
                    'a: not installed!',
                    'Invoke ' + packageManager + ' install to install missing packages',
                ]);
                done();
            });
        });

        it('should install missing packages when `install` is set to true', function (done) {
            this.timeout(30000);

            var fixtureName = 'not-ok-install',
                versionRange = require('./' + packageManager + '-fixtures/' + fixtureName + '/' + packageJsonName)
                    .dependencies.jquery,
                fixtureDir = __dirname + '/' + packageManager + '-fixtures/' + fixtureName,
                fixtureCopyDir = fixtureDir + '-copy',
                depVersion = JSON.parse(fs.readFileSync(__dirname +
                    '/' + packageManager + '-fixtures/' + fixtureName + '/' + depsDirName +
                    '/jquery/' + depsJsonName)).version;

            assert.equal(semver.satisfies(depVersion, versionRange),
                false, 'Expected version ' + depVersion + ' not to match ' + versionRange);

            fs.remove(fixtureCopyDir, function (error) {
                assert.equal(error, null);
                fs.copy(fixtureDir, fixtureCopyDir, function (error) {
                    assert.equal(error, null);
                    checkDeps({
                        packageDir: './test/' + packageManager + '-fixtures/' + fixtureName + '-copy/',
                        checkGitUrls: true,
                        install: true,
                    }, function (output) {
                        // The functions is supposed to not fail because it's instructed to do
                        // `npm install`/`bower install`.
                        assert.strictEqual(output.status, 0);
                        assert.strictEqual(output.depsWereOk, false);
                        assert.deepEqual(output.error, [
                            'jquery: installed: 1.11.1, expected: <=1.11.0',
                            'json3: installed: 0.8.0, expected: 3.3.2',
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

        it('should prune excessive packages when `install` is set to true', function (done) {
            this.timeout(30000);

            var fixtureName = 'only-specified-not-ok-install',
                fixtureDir = __dirname + '/' + packageManager + '-fixtures/' + fixtureName,
                fixtureCopyDir = fixtureDir + '-copy',
                packageDir = './test/' + packageManager + '-fixtures/' + fixtureName + '-copy/';


            fs.remove(fixtureCopyDir, function (error) {
                assert.equal(error, null);
                fs.copy(fixtureDir, fixtureCopyDir, function (error) {
                    assert.equal(error, null);

                    var depList = fs.readdirSync(packageDir + '/' + depsDirName);
                    assert.deepEqual(depList,
                        ['jquery', 'json3'],
                        'Expected package json3 to be present; got: ' + JSON.stringify(depList));

                    checkDeps({
                        packageDir: packageDir,
                        onlySpecified: true,
                        checkGitUrls: true,
                        install: true,
                    }, function (output) {
                        // The functions is supposed to not fail because it's instructed to do
                        // `npm install`/`bower install`.
                        assert.strictEqual(output.status, 0);
                        assert.strictEqual(output.depsWereOk, false);
                        assert.deepEqual(output.error, [
                            'Package json3 installed, though it shouldn\'t be',
                        ]);

                        var depList = fs.readdirSync(packageDir + '/' + depsDirName);
                        assert.deepEqual(depList,
                            ['jquery'],
                            'Expected package json3 to be removed; got: ' + JSON.stringify(depList));

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

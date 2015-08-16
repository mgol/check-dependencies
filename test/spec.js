'use strict';

/* eslint-disable no-undef */

var chalk = require('chalk'),
    Promise = require('bluebird'),
    fs = Promise.promisifyAll(require('fs-extra')),
    semver = require('semver'),
    assert = require('assert'),
    checkDependencies = require('../lib/check-dependencies');

/* eslint-enable no-undef */

describe('checkDependencies', function () {
    beforeEach(function () {
        chalk.enabled = false;
    });

    function testSuite(packageManager, checkDependenciesMode) {
        var checkDeps, depsJsonName, packageJsonName, depsDirName,
            errorsForNotOk, installMessage, pruneAndInstallMessage,
            fixturePrefix, fixturePrefixSeparate, logsForOkInterlaced, errorsForNotOkInterlaced;

        function getCheckDependencies() {
            return function checkDependenciesWrapped() {
                var config, callback,
                    args = [].slice.call(arguments);

                if (packageManager === 'bower') {
                    config = arguments[0];
                    if (typeof config === 'function') {
                        config = {};
                        args.unshift(config);
                    }
                    config.packageManager = 'bower';
                }

                if (checkDependenciesMode === 'callbacks') {
                    checkDependencies.apply(null, args);
                }
                if (checkDependenciesMode === 'promises') {
                    callback = args.pop();
                    checkDependencies.apply(null, args)
                        .then(function (output) {
                            callback(output);
                        })
                        .catch(function (error) {
                            assert.equal(error, null,
                                'The promise mode of checkDependencies should never reject');
                        });
                }
                if (checkDependenciesMode === 'sync') {
                    callback = args.pop();
                    callback(checkDependencies.sync.apply(null, args));
                }
            };
        }

        if (packageManager === 'bower') {
            packageJsonName = 'bower.json';
            depsJsonName = '.bower.json';
            depsDirName = 'bower_components';
            fixturePrefix = './test/bower-fixtures/generated/';
        } else {
            packageJsonName = 'package.json';
            depsJsonName = 'package.json';
            depsDirName = 'node_modules';
            fixturePrefix = './test/npm-fixtures/generated/';
        }
        fixturePrefixSeparate = fixturePrefix.replace(/generated\/$/, '');
        checkDeps = getCheckDependencies();

        installMessage = 'Invoke ' + packageManager + ' install to install missing packages';
        pruneAndInstallMessage = 'Invoke ' + packageManager + ' prune and ' +
            packageManager + ' install to install missing packages and remove ' +
            'excessive ones';

        errorsForNotOk = [
            'a: installed: 1.2.4, expected: 1.2.3',
            'b: installed: 0.9.9, expected: >=1.0.0',
            'c: not installed!',
            'd: not installed!',
            installMessage,
        ];
        errorsForNotOkInterlaced = [
          'b: installed: 0.9.0, expected: >=1.0.0',
          'd: installed: 0.7.0, expected: 0.5.9',
          installMessage,
        ];
        logsForOkInterlaced = [
          'a: installed: 1.2.3, expected: 1.2.3',
          'c: installed: 1.2.3, expected: <2.0',
        ];


        it('should not print errors for valid package setup', function (done) {
            checkDeps({
                packageDir: fixturePrefixSeparate + 'ok',
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
                packageDir: fixturePrefix + 'not-ok',
                scopeList: ['dependencies', 'devDependencies'],
            }, function (output) {
                assert.strictEqual(output.status, 1);
                assert.strictEqual(output.depsWereOk, false);
                assert.deepEqual(output.error, errorsForNotOk);
                done();
            });
        });

        it('should show log/error messages for all packages', function (done) {
            checkDeps({
                checkGitUrls: true,
                packageDir: fixturePrefix + 'not-ok-interlaced',
                scopeList: ['dependencies', 'devDependencies'],
            }, function (output) {
                assert.strictEqual(output.status, 1);
                assert.strictEqual(output.depsWereOk, false);
                assert.deepEqual(output.error, errorsForNotOkInterlaced);
                assert.deepEqual(output.log, logsForOkInterlaced);
                done();
            });
        });

        it('should accept `scopeList` parameter', function (done) {
            checkDeps({
                packageDir: fixturePrefix + 'not-ok',
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

        it('should error if ' + packageJsonName + ' wasn\'t found in `packageDir`',
                function (done) {
            checkDeps({
                packageDir: fixturePrefix + 'missing-json',
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
                packageDir: fixturePrefix + 'only-specified-not-ok',
            }, function (output) {
                assert.strictEqual(output.status, 0);
                assert.strictEqual(output.depsWereOk, true);
                assert.deepEqual(output.error, []);
                done();
            });
        });

        it('should ignore excessive deps if `onlySpecified` is `false`', function (done) {
            checkDeps({
                packageDir: fixturePrefix + 'only-specified-not-ok',
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
                packageDir: fixturePrefixSeparate + 'ok',
                onlySpecified: true,
            }, function (output) {
                assert.strictEqual(output.status, 0);
                assert.strictEqual(output.depsWereOk, true);
                assert.deepEqual(output.error, []);
                done();
            });
        });

        it('should accept packages in `optionalScopeList` when `onlySpecified` is `true`',
                function (done) {
            checkDeps({
                packageDir: fixturePrefix + 'only-specified-not-ok',
                onlySpecified: true,
                scopeList: ['dependencies'],
                optionalScopeList: ['fakeDependencies'],
            }, function (output) {
                assert.strictEqual(output.status, 0);
                assert.strictEqual(output.depsWereOk, true);
                assert.deepEqual(output.error, []);
                done();
            });
        });

        it('should error if there are excessive deps and `onlySpecified` is `true`',
                function (done) {
            checkDeps({
                packageDir: fixturePrefix + 'only-specified-not-ok',
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

        if (checkDependenciesMode === 'callback') {
            it('should throw if callback is not a function', function () {
                var config = {
                    packageDir: fixturePrefixSeparate + 'ok',
                };

                function expectToThrow(fnsWithReasons) {
                    fnsWithReasons.forEach(function (fnWithReason) {
                        assert.throws(fnWithReason[0], Error,
                            'Expected the function to throw when passed ' +
                                'a callback: ' + fnWithReason[1]);
                    });
                }

                function getFunctionWithReason(fakeCallback) {
                    return [
                        function () {
                            checkDeps(config, fakeCallback);
                        },
                        fakeCallback,
                    ];
                }

                expectToThrow([
                    getFunctionWithReason(undefined),
                    getFunctionWithReason(null),
                    getFunctionWithReason(42),
                    getFunctionWithReason('foobar'),
                    getFunctionWithReason({a: 2}),
                ]);
            });
        }

        // In other than async cases we fake the callback in tests so this wouldn't work.
        // But we test correctness of those modes in many other tests so that one
        // is not needed.
        if (checkDependenciesMode === 'callback') {
            it('should not throw if only one parameter provided', function () {
                assert.doesNotThrow(function () {
                    checkDeps({
                        packageDir: fixturePrefixSeparate + 'ok',
                    });
                }, 'Expected the function with one parameter not to throw');
            });
        }

        if (packageManager === 'npm') {
            it('should allow to provide callback as the first argument', function (done) {
                checkDeps(function (output) {
                    assert.strictEqual(output.status, 0);
                    assert.strictEqual(output.depsWereOk, true);
                    assert.deepEqual(output.error, []);
                    done();
                });
            });

            if (checkDependenciesMode === 'callback') {
                it('should throw if config not present and callback is not a function',
                        function () {
                    function expectToThrow(fnsWithReasons) {
                        fnsWithReasons.forEach(function (fnWithReason) {
                            assert.throws(fnWithReason[0], Error,
                                'Expected the function to throw when passed a callback: ' +
                                    fnWithReason[1]);
                        });
                    }

                    function getFunctionWithReason(fakeCallback) {
                        return [
                            function () {
                                checkDeps(fakeCallback);
                            },
                            fakeCallback,
                        ];
                    }

                    expectToThrow([
                        getFunctionWithReason(undefined),
                        getFunctionWithReason(null),
                        getFunctionWithReason(42),
                        getFunctionWithReason('foobar'),
                    ]);
                });
            }
        }

        it('should support `log` and `error` options', function (done) {
            var logArray = [], errorArray = [];
            checkDeps({
                checkGitUrls: true,
                packageDir: fixturePrefix + 'not-ok',
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
                packageDir: fixturePrefix + 'not-ok',
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

        it('should check Git URL based dependencies only if `checkGitUrls` is true',
                function (done) {
            checkDeps({
                packageDir: fixturePrefix + 'git-urls',
                scopeList: ['dependencies', 'devDependencies'],
            }, function (output) {
                assert.deepEqual(output.error, [
                    'b: not installed!',
                    installMessage,
                ]);
            });
            checkDeps({
                checkGitUrls: true,
                packageDir: fixturePrefix + 'git-urls',
                scopeList: ['dependencies', 'devDependencies'],
            }, function (output) {
                assert.deepEqual(output.error, [
                    'a: installed: 0.5.8, expected: 0.5.9',
                    'b: not installed!',
                    installMessage,
                ]);
                done();
            });
        });

        it('should check the version for Git URLs with valid semver tags only', function (done) {
            checkDeps({
                checkGitUrls: true,
                packageDir: fixturePrefix + 'non-semver-tag',
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
                packageDir: fixturePrefix + 'non-semver-tag-pkg-missing',
                scopeList: ['dependencies', 'devDependencies'],
            }, function (output) {
                assert.strictEqual(output.depsWereOk, false);
                assert.deepEqual(output.error, [
                    'a: not installed!',
                    installMessage,
                ]);
                done();
            });
        });

        it('should check custom package name dependencies only if `checkCustomPackageNames` ' +
            'is true and we are testing bower, not npm', function (done) {

            if (packageManager !== 'npm') {

                checkDeps({
                    checkCustomPackageNames: true,
                    packageDir: './test/bower-fixtures/custom-package-not-ok',
                    scopeList: ['dependencies', 'devDependencies'],
                }, function (output) {
                    assert.deepEqual(output.error, [
                        'a: installed: 0.5.8, expected: 0.5.9',
                        'b: not installed!',
                        installMessage,
                    ]);
                });

                checkDeps({
                    packageDir: './test/bower-fixtures/custom-package-not-ok',
                    scopeList: ['dependencies', 'devDependencies'],
                }, function (output) {
                    assert.deepEqual(output.error, [
                        'b: not installed!',
                        installMessage,
                    ]);
                    done();
                });

            } else {
                done();
            }
        });

        it('should find no errors if checkCustomPackageNames=true and custom package names are ok',
                function (done) {

            if (packageManager !== 'npm') {

                checkDeps({
                    checkCustomPackageNames: true,
                    packageDir: './test/bower-fixtures/custom-package-ok',
                    scopeList: ['dependencies', 'devDependencies'],
                }, function (output) {
                    assert.strictEqual(output.status, 0);
                    assert.strictEqual(output.depsWereOk, true);
                    assert.deepEqual(output.error, []);
                    done();
                });

            } else {
                done();
            }
        });

        it('should accept `latest` as a version', function (done) {
            checkDeps({
                packageDir: fixturePrefix + 'latest-ok',
            }, function (output) {
                assert.strictEqual(output.status, 0);
                assert.strictEqual(output.depsWereOk, true);
                assert.deepEqual(output.error, []);
                done();
            });
        });

        it('should report missing package even if version is `latest`', function (done) {
            checkDeps({
                packageDir: fixturePrefix + 'latest-not-ok',
            }, function (output) {
                assert.strictEqual(output.status, 1);
                assert.strictEqual(output.depsWereOk, false);
                assert.deepEqual(output.error, [
                    'a: not installed!',
                    installMessage,
                ]);
                done();
            });
        });

        it('should not require to have optional dependencies installed', function (done) {
            checkDeps({
                packageDir: fixturePrefix + 'optional-not-present',
            }, function (output) {
                assert.strictEqual(output.status, 0);
                assert.strictEqual(output.depsWereOk, true);
                assert.deepEqual(output.error, []);
                done();
            });
        });

        it('should require optional dependencies to have a proper version if installed',
                function (done) {
            checkDeps({
                packageDir: fixturePrefix + 'optional-present-incorrect',
            }, function (output) {
                assert.strictEqual(output.status, 1);
                assert.strictEqual(output.depsWereOk, false);
                assert.deepEqual(output.error, [
                    'a: installed: 1.1.2, expected: ~1.2.0',
                    installMessage,
                ]);
                done();
            });
        });

        it('should install missing packages when `install` is set to true', function (done) {
            /* eslint-disable no-invalid-this */
            this.timeout(30000);

            var fixtureName = 'not-ok-install',
                versionRange = require('../' + fixturePrefixSeparate + fixtureName + '/' +
                    packageJsonName).dependencies.jquery,
                fixtureDir = __dirname + '/../' + fixturePrefixSeparate + fixtureName,
                fixtureCopyDir = fixtureDir + '-copy',
                depVersion = JSON.parse(fs.readFileSync(__dirname +
                    '/../' + fixturePrefixSeparate + fixtureName + '/' + depsDirName +
                    '/jquery/' + depsJsonName)).version;

            assert.equal(semver.satisfies(depVersion, versionRange),
                false, 'Expected version ' + depVersion + ' not to match ' + versionRange);

            return Promise.all([])
                .then(function () {
                    return fs.removeAsync(fixtureCopyDir);
                })
                .then(function () {
                    return fs.copyAsync(fixtureDir, fixtureCopyDir);
                })
                .then(function () {
                    checkDeps({
                        packageDir: fixturePrefixSeparate + fixtureName + '-copy',
                        checkGitUrls: true,
                        install: true,
                    }, function (output) {
                        // The functions is supposed to not fail because it's instructed to do
                        // `npm install`/`bower install`.
                        assert.strictEqual(output.status, 0);
                        assert.strictEqual(output.depsWereOk, false);
                        assert.deepEqual(output.error,
                            []
                                .concat([
                                    'jquery: installed: 1.11.1, expected: <=1.11.0',
                                    'json3: installed: 0.8.0, expected: 3.3.2',
                                ])
                                .concat(packageManager === 'npm' ? [
                                    '@bcoe/awesomeify: not installed!',
                                ] : [])
                        );
                        depVersion = JSON.parse(fs.readFileSync(fixtureCopyDir + '/' + depsDirName +
                            '/jquery/' + depsJsonName)).version;
                        assert(semver.satisfies(depVersion, versionRange),
                            'Expected version ' + depVersion + ' to match ' + versionRange);
                        done();
                    });
                });
        });

        it('should prune excessive packages when `install` is set to true', function (done) {
            this.timeout(30000);

            var fixtureName = 'only-specified-not-ok-install',
                fixtureDir = __dirname + '/../' + fixturePrefix + fixtureName,
                fixtureCopyDir = fixtureDir + '-copy',
                packageDir = fixturePrefix + fixtureName + '-copy';


            return Promise.all([])
                .then(function () {
                    return fs.removeAsync(fixtureCopyDir);
                })
                .then(function () {
                    return fs.copyAsync(fixtureDir, fixtureCopyDir);
                })
                .then(function () {
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
                            'Expected package json3 to be removed; got: ' +
                                JSON.stringify(depList));

                        done();
                    });
                });
        });
    }


    it('should prepare fixures for Bower and npm successfully', function () {
        this.timeout(30000);

        var npmFixturesDir = __dirname + '/common-fixtures';

        function getGeneratedDir(packageManager) {
            return __dirname + '/' + packageManager + '-fixtures/generated';
        }

        return Promise.all([])

            // npm
            .then(function () {
                return fs.removeAsync(getGeneratedDir('npm'));
            })
            .then(function () {
                return fs.copyAsync(npmFixturesDir, getGeneratedDir('npm'));
            })

            // Bower
            .then(function () {
                return fs.removeAsync(getGeneratedDir('bower'));
            })
            .then(function () {
                return fs.copyAsync(npmFixturesDir, getGeneratedDir('bower'));
            })
            .then(function () {
                return fs.readdirAsync(getGeneratedDir('bower'));
            })
            .then(function (fixtureDirNames) {
                var tasks = [];
                fixtureDirNames.forEach(function (fixtureDirName) {
                    tasks.push(
                        convertToBowerFixture(getGeneratedDir('bower') + '/' + fixtureDirName));
                });
                return Promise.all(tasks);
            });

        function convertToBowerFixture(fixtureDirPath) {
            return Promise.all([])

                // Change package.json to bower.json in top level scope
                .then(function () {
                    if (fs.existsSync(fixtureDirPath + '/package.json')) {
                        return fs.moveAsync(fixtureDirPath + '/package.json',
                            fixtureDirPath + '/bower.json');
                    }
                })

                // Change node_modules to bower_components in top level scope
                .then(function () {
                    if (fs.existsSync(fixtureDirPath + '/node_modules')) {
                        return fs.moveAsync(fixtureDirPath + '/node_modules',
                            fixtureDirPath + '/bower_components');
                    }
                })

                // Change package.json to .bower.json in dependencies' folders
                .then(function () {
                    if (fs.existsSync(fixtureDirPath + '/bower_components')) {
                        return fs.readdirAsync(fixtureDirPath + '/bower_components');
                    }
                    return [];
                })
                .then(function (depDirNames) {
                    return depDirNames
                        .filter(function (depDirName) {
                            return depDirName !== '.bin';
                        })
                        .map(function (depDirName) {
                            return fixtureDirPath + '/bower_components/' + depDirName;
                        });
                })
                .then(function (depDirPaths) {
                    var tasks = [];
                    depDirPaths.forEach(function (depDirPath) {
                        tasks.push(fs.moveAsync(depDirPath + '/package.json',
                            depDirPath + '/.bower.json'));
                    });
                    return Promise.all(tasks);
                });
        }
    });

    describe('npm', function () {
        describe('callbacks', function () {
            testSuite('npm', 'callbacks');
        });
        describe('promises', function () {
            testSuite('npm', 'promises');
        });
        if (semver.satisfies(process.version, '>=0.12.0')) {
            describe('sync', function () {
                testSuite('npm', 'sync');
            });
        }
    });


    describe('bower', function () {
        describe('callbacks', function () {
            testSuite('bower', 'callbacks');
        });
        describe('promises', function () {
            testSuite('bower', 'promises');
        });
        if (semver.satisfies(process.version, '>=0.12.0')) {
            describe('sync', function () {
                testSuite('bower', 'sync');
            });
        }
    });
});

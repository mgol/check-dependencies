'use strict';

process.env.NO_COLOR = '1';

const assert = require('node:assert');
const { existsSync, readFileSync, readdirSync } = require('node:fs');
const fs = require('node:fs/promises');
const spawn = require('node:child_process').spawn;

const semver = require('semver');
const sinon = require('sinon');

const timeout = 60000;

describe('checkDependencies', () => {
    const checkDependencies = require('../lib/check-dependencies');
    const checkDependenciesSync = checkDependencies.sync;

    const testSuite = (packageManager, checkDependenciesMode) => {
        const getCheckDependencies = () =>
            function checkDependenciesWrapped(...args) {
                const callback = args.pop();

                if (checkDependenciesMode === 'promises') {
                    return checkDependencies(...args).then(output =>
                        callback(output),
                    );
                }
                if (checkDependenciesMode === 'sync') {
                    // Wrap in a promise to be able to use Mocha's async
                    // test support while still checking for sync mode output.
                    return Promise.resolve().then(() =>
                        callback(checkDependenciesSync(...args)),
                    );
                }

                throw new Error(
                    `Unknown checkDependenciesMode: ${checkDependenciesMode}`,
                );
            };

        const packageJsonName = 'package.json';
        const depsJsonName = 'package.json';
        const depsDirName = 'node_modules';
        const fixturePrefix = `${__dirname}/fixtures/`;
        const checkDeps = getCheckDependencies();

        const installMessage = `Invoke ${packageManager} install to install missing packages`;
        const installMessageWithOnlySpecified = `Invoke ${packageManager} install to install missing packages and remove excessive ones`;

        const errorsForNotOk = [
            'a: installed: 1.2.4, expected: 1.2.3',
            'b: installed: 0.9.9, expected: >=1.0.0',
            'c: not installed!',
            'd: not installed!',
            installMessage,
        ];
        const errorsForNotOkInterlaced = [
            'b: installed: 0.9.0, expected: >=1.0.0',
            'd: installed: 0.7.0, expected: 0.5.9',
            installMessage,
        ];
        const logsForOkInterlaced = [
            'a: installed: 1.2.3, expected: 1.2.3',
            'c: installed: 1.2.3, expected: <2.0',
        ];

        it('should exit with an error for invalid `packageManager`', () =>
            checkDeps(
                {
                    packageManager: 'foo bar',
                    packageDir: `${fixturePrefix}ok`,
                    scopeList: ['dependencies', 'devDependencies'],
                },
                output => {
                    assert.deepEqual(output.error, [
                        'The packageManager field value must match the regex ' +
                            '`/^[a-z][a-z0-9-]*$/i`; got: "foo bar"',
                    ]);
                    assert.strictEqual(output.status, 1);
                },
            ));

        it('should not print errors for valid package setup', () =>
            checkDeps(
                {
                    packageDir: `${fixturePrefix}ok`,
                    scopeList: ['dependencies', 'devDependencies'],
                },
                output => {
                    assert.deepEqual(output.error, []);
                    assert.strictEqual(output.depsWereOk, true);
                    assert.strictEqual(output.status, 0);
                },
            ));

        it('should error on invalid package setup', () =>
            checkDeps(
                {
                    checkGitUrls: true,
                    packageDir: `${fixturePrefix}not-ok`,
                    scopeList: ['dependencies', 'devDependencies'],
                },
                output => {
                    assert.deepEqual(output.error, errorsForNotOk);
                    assert.strictEqual(output.depsWereOk, false);
                    assert.strictEqual(output.status, 1);
                },
            ));

        it('should show log/error messages for all packages', () =>
            checkDeps(
                {
                    checkGitUrls: true,
                    packageDir: `${fixturePrefix}not-ok-interlaced`,
                    scopeList: ['dependencies', 'devDependencies'],
                },
                output => {
                    assert.deepEqual(output.log, logsForOkInterlaced);
                    assert.deepEqual(output.error, errorsForNotOkInterlaced);
                    assert.strictEqual(output.depsWereOk, false);
                    assert.strictEqual(output.status, 1);
                },
            ));

        it('should accept `scopeList` parameter', () =>
            checkDeps(
                {
                    packageDir: `${fixturePrefix}not-ok`,
                    scopeList: ['devDependencies'],
                },
                output => {
                    assert.deepEqual(output.error, []);
                    assert.strictEqual(output.depsWereOk, true);
                    assert.strictEqual(output.status, 0);
                },
            ));

        it(`should find ${packageJsonName} if \`packageDir\` not provided`, () =>
            checkDeps({}, output => {
                assert.deepEqual(output.error, []);
                assert.strictEqual(output.depsWereOk, true);
                assert.strictEqual(output.status, 0);
            }));

        it(`should error if ${packageJsonName} wasn't found in \`packageDir\``, () =>
            checkDeps(
                {
                    packageDir: `${fixturePrefix}missing-json`,
                },
                output => {
                    assert.deepEqual(output.error, [
                        `Missing ${packageJsonName}!`,
                    ]);
                    assert.strictEqual(output.status, 1);
                },
            ));

        it('should ignore excessive deps if `onlySpecified` not provided', () =>
            checkDeps(
                {
                    packageDir: `${fixturePrefix}only-specified-not-ok`,
                },
                output => {
                    assert.deepEqual(output.error, []);
                    assert.strictEqual(output.depsWereOk, true);
                    assert.strictEqual(output.status, 0);
                },
            ));

        it('should ignore excessive deps if `onlySpecified` is `false`', () =>
            checkDeps(
                {
                    packageDir: `${fixturePrefix}only-specified-not-ok`,
                    onlySpecified: false,
                },
                output => {
                    assert.deepEqual(output.error, []);
                    assert.strictEqual(output.depsWereOk, true);
                    assert.strictEqual(output.status, 0);
                },
            ));

        it('should not error if no excessive deps and `onlySpecified` is `true`', () =>
            checkDeps(
                {
                    packageDir: `${fixturePrefix}ok`,
                    onlySpecified: true,
                },
                output => {
                    assert.strictEqual(output.status, 0);
                    assert.strictEqual(output.depsWereOk, true);
                    assert.deepEqual(output.error, []);
                },
            ));

        it('should accept packages in `optionalScopeList` when `onlySpecified` is `true`', () =>
            checkDeps(
                {
                    packageDir: `${fixturePrefix}only-specified-not-ok`,
                    onlySpecified: true,
                    scopeList: ['dependencies'],
                    optionalScopeList: ['fakeDependencies'],
                },
                output => {
                    assert.deepEqual(output.error, []);
                    assert.strictEqual(output.depsWereOk, true);
                    assert.strictEqual(output.status, 0);
                },
            ));

        it('should error if there are excessive deps and `onlySpecified` is `true`', () =>
            checkDeps(
                {
                    packageDir: `${fixturePrefix}only-specified-not-ok`,
                    onlySpecified: true,
                },
                output => {
                    assert.deepEqual(output.error, [
                        "Package c installed, though it shouldn't be",
                        installMessageWithOnlySpecified,
                    ]);
                    assert.strictEqual(output.status, 1);
                },
            ));

        it('should support `log` and `error` options', () => {
            const logArray = [];
            const errorArray = [];

            return checkDeps(
                {
                    checkGitUrls: true,
                    packageDir: `${fixturePrefix}not-ok`,
                    verbose: true,
                    log(msg) {
                        logArray.push(msg);
                    },
                    error(msg) {
                        errorArray.push(msg);
                    },
                },
                output => {
                    // output.error shouldn't be silenced
                    assert.deepEqual(output.error, errorsForNotOk);

                    assert.deepEqual(logArray, output.log);
                    assert.deepEqual(errorArray, output.error);
                },
            );
        });

        it('should not print logs when `verbose` is not set to true', () => {
            const logArray = [];
            const errorArray = [];

            return checkDeps(
                {
                    packageDir: `${fixturePrefix}not-ok`,
                    log(msg) {
                        logArray.push(msg);
                    },
                    error(msg) {
                        errorArray.push(msg);
                    },
                },
                () => {
                    assert.deepEqual(logArray, []);
                    assert.deepEqual(errorArray, []);
                },
            );
        });

        it('should check Git URL based dependencies only if `checkGitUrls` is true', async () => {
            await checkDeps(
                {
                    packageDir: `${fixturePrefix}git-urls`,
                    scopeList: ['dependencies', 'devDependencies'],
                },
                output => {
                    assert.deepEqual(output.error, [
                        'b: not installed!',
                        installMessage,
                    ]);
                },
            );
            await checkDeps(
                {
                    checkGitUrls: true,
                    packageDir: `${fixturePrefix}git-urls`,
                    scopeList: ['dependencies', 'devDependencies'],
                },
                output => {
                    assert.deepEqual(output.error, [
                        'a: installed: 0.5.8, expected: 0.5.9',
                        'b: not installed!',
                        installMessage,
                    ]);
                },
            );
        });

        it('should check the version for Git URLs with valid semver tags only', () =>
            checkDeps(
                {
                    checkGitUrls: true,
                    packageDir: `${fixturePrefix}non-semver-tag`,
                    scopeList: ['dependencies', 'devDependencies'],
                },
                output => {
                    assert.strictEqual(output.depsWereOk, true);
                },
            ));

        it(
            "should check a Git dependency is installed even if it's hash " +
                'is not a valid semver tag',
            () =>
                checkDeps(
                    {
                        checkGitUrls: true,
                        packageDir: `${fixturePrefix}non-semver-tag-pkg-missing`,
                        scopeList: ['dependencies', 'devDependencies'],
                    },
                    output => {
                        assert.strictEqual(output.depsWereOk, false);
                        assert.deepEqual(output.error, [
                            'a: not installed!',
                            installMessage,
                        ]);
                    },
                ),
        );

        it('should accept `latest` as a version', () =>
            checkDeps(
                {
                    packageDir: `${fixturePrefix}latest-ok`,
                },
                output => {
                    assert.deepEqual(output.error, []);
                    assert.strictEqual(output.depsWereOk, true);
                    assert.strictEqual(output.status, 0);
                },
            ));

        it('should report missing package even if version is `latest`', () =>
            checkDeps(
                {
                    packageDir: `${fixturePrefix}latest-not-ok`,
                },
                output => {
                    assert.deepEqual(output.error, [
                        'a: not installed!',
                        installMessage,
                    ]);
                    assert.strictEqual(output.depsWereOk, false);
                    assert.strictEqual(output.status, 1);
                },
            ));

        it('should not require to have optional dependencies installed', () =>
            checkDeps(
                {
                    packageDir: `${fixturePrefix}optional-not-present`,
                },
                output => {
                    assert.deepEqual(output.error, []);
                    assert.strictEqual(output.depsWereOk, true);
                    assert.strictEqual(output.status, 0);
                },
            ));

        it('should require optional dependencies to have a proper version if installed', () =>
            checkDeps(
                {
                    packageDir: `${fixturePrefix}optional-present-incorrect`,
                },
                output => {
                    assert.deepEqual(output.error, [
                        'a: installed: 1.1.2, expected: ~1.2.0',
                        installMessage,
                    ]);
                    assert.strictEqual(output.depsWereOk, false);
                    assert.strictEqual(output.status, 1);
                },
            ));

        it('should ignore all files & hidden directories as dep dirs', () =>
            checkDeps(
                {
                    packageDir: `${fixturePrefix}ok-ignored-dirs-files`,
                    onlySpecified: true,
                },
                output => {
                    assert.deepEqual(output.error, []);
                    assert.strictEqual(output.depsWereOk, true);
                    assert.strictEqual(output.status, 0);
                },
            ));

        it('should install missing packages when `install` is set to true', function () {
            this.timeout(timeout);

            const fixtureName = 'not-ok-install';
            const versionRange = require(
                `${fixturePrefix}${fixtureName}/${packageJsonName}`,
            ).dependencies.jquery;
            const fixtureDir = `${fixturePrefix}${fixtureName}`;
            const fixtureCopyDir = `${fixtureDir}-copy`;
            const depVersion = JSON.parse(
                readFileSync(
                    `${fixturePrefix}${fixtureName}/${depsDirName}/jquery/${depsJsonName}`,
                ),
            ).version;

            assert.equal(
                semver.satisfies(depVersion, versionRange),
                false,
                `Expected version ${depVersion} not to match ${versionRange}`,
            );

            // Our fake jQuery copy contains only package.json but the true one has the /dist/
            // sub-directory. We'll use it to check if the `install` command was invoked
            // when technically not needed as we require it now always when pruning.
            assert.strictEqual(
                existsSync(`${fixtureCopyDir}/${depsDirName}/jquery/dist`),
                false,
            );

            return fs
                .rm(fixtureCopyDir, { recursive: true, force: true })
                .then(() =>
                    fs.cp(fixtureDir, fixtureCopyDir, { recursive: true }),
                )
                .then(() =>
                    checkDeps(
                        {
                            packageDir: `${fixturePrefix}${fixtureName}-copy`,
                            checkGitUrls: true,
                            install: true,
                        },
                        output => {
                            // See the comment at the analogous assertion above.
                            assert.strictEqual(
                                existsSync(
                                    `${fixtureCopyDir}/${depsDirName}/jquery/dist`,
                                ),
                                true,
                            );

                            // The function is supposed to not fail because
                            // it's instructed to do `npm install`.
                            assert.deepEqual(
                                output.error,
                                []
                                    .concat([
                                        'jquery: installed: 1.11.1, expected: <=1.11.0',
                                        'json3: installed: 0.8.0, expected: 3.3.2',
                                    ])
                                    .concat(
                                        packageManager === 'npm'
                                            ? [
                                                  '@bcoe/awesomeify: not installed!',
                                              ]
                                            : [],
                                    ),
                            );

                            const newDepVersion = JSON.parse(
                                readFileSync(
                                    `${fixtureCopyDir}/${depsDirName}/jquery/${depsJsonName}`,
                                ),
                            ).version;
                            assert(
                                semver.satisfies(newDepVersion, versionRange),
                                `Expected version ${newDepVersion} to match ${versionRange}`,
                            );

                            assert.strictEqual(output.depsWereOk, false);
                            assert.strictEqual(output.status, 0);

                            // Clean up
                            return fs.rm(fixtureCopyDir, {
                                recursive: true,
                                force: true,
                            });
                        },
                    ),
                );
        });

        it('should prune excessive packages when `install` is set to true', function () {
            this.timeout(timeout);

            const fixtureName = 'only-specified-not-ok-install';
            const fixtureDir = `${fixturePrefix}${fixtureName}`;
            const fixtureCopyDir = `${fixtureDir}-copy`;
            const packageDir = `${fixturePrefix}${fixtureName}-copy`;

            return fs
                .rm(fixtureCopyDir, { recursive: true, force: true })
                .then(() =>
                    fs.cp(fixtureDir, fixtureCopyDir, { recursive: true }),
                )
                .then(() => {
                    const depList = readdirSync(`${packageDir}/${depsDirName}`);
                    assert.deepEqual(
                        depList,
                        ['jquery', 'json3'],
                        `Expected package json3 to be present; got: ${JSON.stringify(
                            depList,
                        )}`,
                    );

                    return checkDeps(
                        {
                            packageDir,
                            onlySpecified: true,
                            checkGitUrls: true,
                            install: true,
                        },
                        output => {
                            // The function is supposed to not fail because
                            // it's instructed to do `npm install`.
                            assert.deepEqual(output.error, [
                                "Package json3 installed, though it shouldn't be",
                            ]);

                            const depList = readdirSync(
                                `${packageDir}/${depsDirName}`,
                            ).filter(name => name[0] !== '.');
                            assert.deepEqual(
                                depList,
                                ['jquery'],
                                `Expected package json3 to be removed; got: ${JSON.stringify(
                                    depList,
                                )}`,
                            );

                            assert.strictEqual(output.depsWereOk, false);
                            assert.strictEqual(output.status, 0);

                            // Clean up
                            return fs.rm(fixtureCopyDir, {
                                recursive: true,
                                force: true,
                            });
                        },
                    );
                });
        });
    };

    describe('API', () => {
        describe('promises', () => {
            testSuite('npm', 'promises');
        });
        describe('sync', () => {
            testSuite('npm', 'sync');
        });
    });

    describe('CLI reporter', () => {
        let cli, consoleLogStub, consoleErrorStub;

        beforeEach(() => {
            cli = require('../bin/cli.js');

            consoleLogStub = sinon.stub(console, 'log');
            consoleErrorStub = sinon.stub(console, 'error');
        });

        afterEach(() => {
            consoleLogStub.restore();
            consoleErrorStub.restore();

            process.exitCode = undefined;
        });

        it('should call console log for every error', () => {
            const result = {
                error: ['error1', 'error2'],
            };

            cli.reporter(result);

            sinon.assert.calledTwice(consoleErrorStub);
            sinon.assert.calledWith(consoleErrorStub, 'error1');
            sinon.assert.calledWith(consoleErrorStub, 'error2');
        });

        it('should not call console log if no errors', () => {
            const result = {
                error: [],
            };

            cli.reporter(result);

            sinon.assert.notCalled(consoleErrorStub);
        });

        it('should set process.exitCode to one if non-zero status returned', () => {
            const result = {
                status: 666,
                log: [],
                error: [],
            };

            cli.reporter(result);

            assert.strictEqual(process.exitCode, 666);
        });

        it('should not set process.exitCode if zero status returned', () => {
            const result = {
                status: 0,
                log: [],
                error: [],
            };

            cli.reporter(result);

            assert.strictEqual(process.exitCode, undefined);
        });
    });

    describe('CLI (via a spawned process)', () => {
        const cliPath = `${__dirname}/../bin/cli.js`;
        const fixturesRoot = `${__dirname}/fixtures`;

        const npmNotOkStderrString = [
            'a: installed: 1.2.4, expected: 1.2.3',
            'b: installed: 0.9.9, expected: >=1.0.0',
            'c: not installed!',
            'd: not installed!',
            'Invoke npm install to install missing packages',
            '',
        ].join('\n');
        const pnpmNotOkStderrString = npmNotOkStderrString.replace(
            /npm/g,
            'pnpm',
        );

        const read = fileDescriptor => {
            const stream = fileDescriptor.read();
            if (!stream) {
                return stream;
            }

            // Ignore npm warnings about deprecated packages.
            return stream
                .toString()
                .replace(/^npm warn deprecated [^\n]+\n/g, '');
        };

        describe('ok package', () => {
            const runTest = verbose => done => {
                const packageRoot = `${fixturesRoot}/ok`;

                const child = spawn(
                    process.execPath,
                    [cliPath].concat(verbose ? ['--verbose'] : []),
                    {
                        cwd: packageRoot,
                    },
                );

                child.on('exit', code => {
                    if (verbose) {
                        assert.strictEqual(
                            read(child.stdout),
                            [
                                'a: installed: 1.2.3, expected: 1.2.3',
                                'b: installed: 1.2.3, expected: >=1.0.0',
                                'c: installed: 1.2.3, expected: <2.0',
                                'c-alias: installed: 1.2.3, expected: <2.0',
                                '@e-f/g-h: installed: 2.5.9, expected: ~2.5.7',
                                '',
                            ].join('\n'),
                        );
                    } else {
                        assert.strictEqual(read(child.stdout), null);
                    }
                    assert.strictEqual(read(child.stderr), null);
                    assert.strictEqual(code, 0);
                    done();
                });
            };

            it('should succeed', runTest());
            it('should succeed (verbose mode)', runTest(true));
        });

        describe('non-ok package', () => {
            const runTest = verbose => done => {
                const packageRoot = `${fixturesRoot}/not-ok`;

                const child = spawn(
                    process.execPath,
                    [cliPath].concat(verbose ? ['--verbose'] : []),
                    {
                        cwd: packageRoot,
                    },
                );

                child.on('exit', code => {
                    if (verbose) {
                        assert.strictEqual(
                            read(child.stdout),
                            ['e: installed: 1.0.0, expected: 1.0.0', ''].join(
                                '\n',
                            ),
                        );
                    } else {
                        assert.strictEqual(read(child.stdout), null);
                    }
                    assert.strictEqual(
                        read(child.stderr),
                        npmNotOkStderrString,
                    );
                    assert.strictEqual(code, 1);
                    done();
                });
            };

            it('should fail', runTest());
            it('should fail (verbose mode)', runTest(true));
        });

        describe('the --install option', () => {
            it('should succeed on a non-ok package if installation succeeded', function (done) {
                this.timeout(timeout);

                const sourceForPackageDir = `${fixturesRoot}/not-ok-install`;
                const packageDir = `${fixturesRoot}/not-ok-install-copy`;

                Promise.resolve()
                    .then(() =>
                        fs.cp(sourceForPackageDir, packageDir, {
                            recursive: true,
                        }),
                    )
                    .then(() => {
                        const child = spawn(
                            process.execPath,
                            [
                                cliPath,
                                '--package-dir',
                                packageDir,
                                '--check-git-urls',
                                '--install',
                            ],
                            {
                                cwd: __dirname,
                            },
                        );

                        child.on('exit', code => {
                            // The process is supposed to not fail because
                            // it's instructed to do `npm install`.
                            assert.strictEqual(
                                // Strip npm http debug messages to make it CI-friendly.
                                (read(child.stderr) || '')
                                    .replace(/^npm http .+\n/gm, '')
                                    .replace(
                                        /^npm notice created a lockfile .+\n/gm,
                                        '',
                                    ),
                                [
                                    'jquery: installed: 1.11.1, expected: <=1.11.0',
                                    'json3: installed: 0.8.0, expected: 3.3.2',
                                    '@bcoe/awesomeify: not installed!',
                                    '',
                                ].join('\n'),
                            );
                            assert.strictEqual(code, 0);

                            const secondChild = spawn(
                                process.execPath,
                                [
                                    cliPath,
                                    '--package-dir',
                                    packageDir,
                                    '--install',
                                ],
                                {
                                    cwd: __dirname,
                                },
                            );

                            secondChild.on('exit', code => {
                                assert.strictEqual(
                                    read(secondChild.stderr),
                                    null,
                                );
                                assert.strictEqual(code, 0);

                                // Clean up
                                fs.rm(packageDir, {
                                    recursive: true,
                                    force: true,
                                }).then(() => done());
                            });
                        });
                    });
            });
        });

        describe('the --package-dir option', () => {
            it('should succeed on an ok package', done => {
                const packageDir = `${fixturesRoot}/ok`;

                const child = spawn(
                    process.execPath,
                    [cliPath, '--package-dir', packageDir],
                    {
                        cwd: __dirname,
                    },
                );

                child.on('exit', code => {
                    assert.strictEqual(read(child.stderr), null);
                    assert.strictEqual(code, 0);
                    done();
                });
            });

            it('should fail on a non-ok package', done => {
                const packageDir = `${fixturesRoot}/not-ok`;

                const child = spawn(
                    process.execPath,
                    [cliPath, '--package-dir', packageDir],
                    {
                        cwd: __dirname,
                    },
                );

                child.on('exit', code => {
                    assert.strictEqual(
                        read(child.stderr),
                        npmNotOkStderrString,
                    );
                    assert.strictEqual(code, 1);
                    done();
                });
            });
        });

        describe('the --package-manager option', () => {
            it('should succeed on an ok package', done => {
                const packageRoot = `${fixturesRoot}/ok`;

                const child = spawn(
                    process.execPath,
                    [cliPath, '--package-manager', 'pnpm'],
                    {
                        cwd: packageRoot,
                    },
                );

                child.on('exit', code => {
                    assert.strictEqual(read(child.stderr), null);
                    assert.strictEqual(code, 0);
                    done();
                });
            });

            it('should fail on a non-ok package', done => {
                const packageRoot = `${fixturesRoot}/not-ok`;

                const child = spawn(
                    process.execPath,
                    [cliPath, '--package-manager', 'pnpm'],
                    {
                        cwd: packageRoot,
                    },
                );

                child.on('exit', code => {
                    assert.strictEqual(
                        read(child.stderr),
                        pnpmNotOkStderrString,
                    );
                    assert.strictEqual(code, 1);
                    done();
                });
            });
        });

        describe('the --scope-list and --optional-scope-list options', () => {
            const errorMessage = [
                "Package c installed, though it shouldn't be\n",
                'Invoke npm install to install missing packages ',
                'and remove excessive ones\n',
            ].join('');

            it('should succeed on an ok package', done => {
                const packageRoot = `${fixturesRoot}/only-specified-not-ok`;

                const child = spawn(
                    process.execPath,
                    [
                        cliPath,
                        '--only-specified',
                        '--scope-list',
                        'dependencies',
                        '--optional-scope-list',
                        'fakeDependencies',
                    ],
                    {
                        cwd: packageRoot,
                    },
                );

                child.on('exit', code => {
                    assert.strictEqual(read(child.stderr), null);
                    assert.strictEqual(code, 0);
                    done();
                });
            });

            it('should fail on a non-ok package', done => {
                const packageRoot = `${fixturesRoot}/only-specified-not-ok`;

                const child = spawn(
                    process.execPath,
                    [
                        cliPath,
                        '--only-specified',
                        '--scope-list',
                        'dependencies',
                        '--optional-scope-list',
                        'devDependencies',
                    ],
                    {
                        cwd: packageRoot,
                    },
                );

                child.on('exit', code => {
                    assert.strictEqual(read(child.stderr), errorMessage);
                    assert.strictEqual(code, 1);
                    done();
                });
            });

            it('should accept multiple values and succeed', done => {
                const packageRoot = `${fixturesRoot}/only-specified-not-ok`;

                const child = spawn(
                    process.execPath,
                    [
                        cliPath,
                        '--only-specified',
                        '--scope-list',
                        'dependencies',
                        '--scope-list',
                        'fakeDependencies',
                        '--optional-scope-list',
                        'fake2Dependencies',
                        '--optional-scope-list',
                        'fake3Dependencies',
                    ],
                    {
                        cwd: packageRoot,
                    },
                );

                child.on('exit', code => {
                    assert.strictEqual(read(child.stderr), null);
                    assert.strictEqual(code, 0);
                    done();
                });
            });

            it('should accept multiple values and fail', done => {
                const packageRoot = `${fixturesRoot}/only-specified-not-ok`;

                const child = spawn(
                    process.execPath,
                    [
                        cliPath,
                        '--only-specified',
                        '--scope-list',
                        'dependencies',
                        '--scope-list',
                        'devDependencies',
                        '--optional-scope-list',
                        'optionalDependencies',
                        '--optional-scope-list',
                        'optionalDevDependencies',
                    ],
                    {
                        cwd: packageRoot,
                    },
                );

                child.on('exit', code => {
                    assert.strictEqual(read(child.stderr), errorMessage);
                    assert.strictEqual(code, 1);
                    done();
                });
            });
        });
    });
});

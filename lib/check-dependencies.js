'use strict';

const fs = require('fs');
const path = require('path');
const pico = require('picocolors');
const semver = require('semver');
const spawn = require('child_process').spawn;
const spawnSync = require('child_process').spawnSync;

const findup = fileName => {
    let dir = process.cwd();
    while (true) {
        const filePath = path.resolve(dir, fileName);
        if (fs.existsSync(filePath)) {
            return filePath;
        }
        const nextDir = path.dirname(dir);
        if (dir === nextDir) {
            // top level => not found
            return null;
        }
        dir = nextDir;
    }
};

const checkDependenciesHelper = (syncOrAsync, config) => {
    const output = { log: [], error: [] };

    let packageJson;

    let installPromise = Promise.resolve();
    let success = true;
    let installNeeded = false;

    const log = message => {
        output.log.push(message);
        if (options.verbose) {
            options.log(message);
        }
    };

    const error = message => {
        output.error.push(message);
        if (options.verbose) {
            options.error(message);
        }
    };

    const finish = () => {
        output.status = success ? 0 : 1;
        if (syncOrAsync === 'async') {
            return Promise.resolve(output);
        }
        return output;
    };

    const missingPackageJson = () => {
        success = false;
        error('Missing package.json!');
        return finish();
    };

    const options = {
        packageManager: 'npm',
        onlySpecified: false,
        install: false,
        scopeList: ['dependencies', 'devDependencies'],
        optionalScopeList: ['optionalDependencies'],
        verbose: false,
        checkGitUrls: false,
        log: console.log.bind(console),
        error: console.error.bind(console),
        ...config,
    };

    if (!/^[a-z][a-z0-9-]*$/i.test(options.packageManager)) {
        success = false;
        error(
            'The packageManager field value must match the regex ' +
                `\`/^[a-z][a-z0-9-]*$/i\`; got: "${options.packageManager}"`,
        );
        return finish();
    }

    const packageJsonRegex = /package\.json$/;

    options.packageDir = options.packageDir || findup('package.json');
    if (!options.packageDir) {
        return missingPackageJson();
    }
    options.packageDir = path.resolve(
        options.packageDir.replace(packageJsonRegex, ''),
    );

    packageJson = `${options.packageDir}/package.json`;
    if (!fs.existsSync(packageJson)) {
        return missingPackageJson();
    }
    packageJson = require(packageJson);

    const depsDir = `${options.packageDir}/node_modules`;

    const getDepsMappingsFromScopeList = scopeList =>
        // Get names of all packages specified in `package.json` at keys from
        // `scopeList` together with specified version numbers.
        scopeList.reduce(
            (result, scope) => Object.assign(result, packageJson[scope]),
            {},
        );

    // Make sure each package from `scopeList` is present and matches the specified version range.
    // Packages from `optionalScopeList` may not be present but if they are, they are required
    // to match the specified version range.
    const checkPackage = pkg => {
        const name = pkg.name;
        let versionString = pkg.versionString;

        const depDir = `${depsDir}/${name}`;
        const depJsonPath = `${depDir}/package.json`;

        if (!fs.existsSync(depDir) || !fs.existsSync(depJsonPath)) {
            if (pkg.isOptional) {
                log(`${name}: ${pico.red('not installed!')}`);
            } else {
                error(`${name}: ${pico.red('not installed!')}`);
                success = false;
            }
            return;
        }

        // Let's look if we can get a valid version from a Git URL
        if (options.checkGitUrls && /\.git.*#v?(.+)$/.test(versionString)) {
            versionString = /#v?(.+)$/.exec(versionString)[1];
            if (!semver.valid(versionString)) {
                return;
            }
        }

        // Quick and dirty check - make sure we're not dealing with a URL
        if (/\//.test(versionString)) {
            return;
        }

        // If we are dealing with a custom package name, semver check won't work - skip it
        if (/#/.test(versionString)) {
            return;
        }

        // Skip version checks for 'latest' - the semver module won't help here and the check
        // would have to consult the npm server, making the operation slow.
        if (versionString === 'latest') {
            return;
        }

        const depJson = require(depJsonPath);

        // Support package aliases
        if (/npm:(.+)@(.+)/.test(versionString)) {
            const [, depName, version] = versionString.match(/npm:(.+)@(.+)/);

            versionString = version;

            if (depJson.name !== depName) {
                success = false;
                error(
                    `${name}: installed: ${pico.red(
                        depName,
                    )}, expected: ${pico.green(depJson.name)}`,
                );
            }
        }

        const depVersion = depJson.version;
        if (semver.satisfies(depVersion, versionString)) {
            log(
                `${name}: installed: ${pico.green(
                    depVersion,
                )}, expected: ${pico.green(versionString)}`,
            );
        } else {
            success = false;
            error(
                `${name}: installed: ${pico.red(
                    depVersion,
                )}, expected: ${pico.green(versionString)}`,
            );
        }
    };

    const depsMappings = getDepsMappingsFromScopeList(options.scopeList);
    const optionalDepsMappings = getDepsMappingsFromScopeList(
        options.optionalScopeList,
    );
    const fullDepsMappings = {
        ...depsMappings,
        ...optionalDepsMappings,
    };

    Object.keys(depsMappings).forEach(name => {
        checkPackage({
            name,
            versionString: depsMappings[name],
            isOptional: false,
        });
    });

    Object.keys(optionalDepsMappings).forEach(name => {
        checkPackage({
            name,
            versionString: optionalDepsMappings[name],
            isOptional: true,
        });
    });

    installNeeded = !success;

    if (options.onlySpecified) {
        fs.readdirSync(depsDir)

            // Ignore hidden directories
            .filter(depName => depName[0] !== '.')

            // Ignore files
            .filter(depName =>
                fs.lstatSync(`${depsDir}/${depName}`).isDirectory(),
            )

            .forEach(depName => {
                let depSubDirName;

                // Scoped packages
                if (depName[0] === '@') {
                    depName = fs.readdirSync(`${depsDir}/${depName}`)[0];

                    // Ignore weird directories - if it just looks like a scoped package but
                    // isn't one, just skip it.
                    if (depSubDirName && !fullDepsMappings[depName]) {
                        success = false;
                        installNeeded = true;
                        error(
                            `Package ${depName} installed, though it shouldn't be`,
                        );
                    }
                    return;
                }

                // Regular packages
                if (!fullDepsMappings[depName]) {
                    success = false;
                    installNeeded = true;
                    error(
                        `Package ${depName} installed, though it shouldn't be`,
                    );
                }
            });
    }

    if (success) {
        output.depsWereOk = true;
        return finish();
    }
    output.depsWereOk = false;

    if (!options.install) {
        error(
            `Invoke ${pico.green(
                `${options.packageManager} install`,
            )} to install missing packages${
                options.onlySpecified ? ' and remove excessive ones' : ''
            }`,
        );
        return finish();
    }

    const install = () => {
        log(`Invoking ${pico.green(`${options.packageManager} install`)}...`);

        // If we're using a direct path, on Windows we need to invoke it via `node path`, not
        // `cmd /c path`. In UNIX systems we can execute the command directly so no need to wrap.
        let msg;
        const method = syncOrAsync === 'sync' ? spawnSync : spawn;

        const spawnReturn = method(`${options.packageManager} install`, {
            cwd: options.packageDir,
            stdio: 'inherit',
            shell: true,
        });

        if (syncOrAsync === 'sync') {
            if (spawnReturn.status !== 0) {
                msg = `${
                    options.packageManager
                } install failed with code: ${pico.red(spawnReturn.status)}`;
                throw new Error(msg);
            }
            return null;
        }
        return new Promise((resolve, reject) => {
            spawnReturn.on('close', code => {
                if (code === 0) {
                    resolve();
                    return;
                }
                msg = `${
                    options.packageManager
                } install failed with code: ${pico.red(code)}`;
                error(msg);
                reject(msg);
            });
        });
    };

    const installMissing = () => install();

    if (syncOrAsync === 'sync') {
        try {
            if (installNeeded) {
                installMissing();
            }

            success = true;
        } catch (error) {
            success = false;
        }
        return finish();
    }

    // Async scenario
    if (installNeeded) {
        installPromise = installPromise.then(installMissing);
    }

    return installPromise
        .then(() => {
            success = true;
            return finish();
        })
        .catch(() => {
            success = false;
            return finish();
        });
};

module.exports = cfg => checkDependenciesHelper('async', cfg);
module.exports.sync = cfg => checkDependenciesHelper('sync', cfg);

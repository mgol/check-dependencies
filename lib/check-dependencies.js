/**
 * check-dependencies
 * https://github.com/mzgol/check-dependencies
 *
 * Author Michał Gołębiowski <m.goleb@gmail.com>
 * Licensed under the MIT license.
 */

'use strict';

/* eslint-disable no-undef */
var fs = require('fs'),
    path = require('path'),
    chalk = require('chalk'),
    findup = require('findup-sync'),
    _ = require('lodash'),
    semver = require('semver'),
    Promise = require('bluebird'),
    spawn = require('child_process').spawn;
/* eslint-enable no-undef */

module.exports = function checkDependencies(config, callback) {
    if (typeof callback !== 'function') {
        if (typeof config === 'function') {
            callback = config;
            config = {};
        } else {
            throw new Error('Callback has to be provided!');
        }
    }

    var bowerConfig, depsMappings, fullDepsMappings, depsDir, depsDirName, depsJsonName,
        packageJson, packageJsonName, packageJsonRegex, pkgManagerPath,
        installNeeded = false,
        pruneNeeded = false,
        installPrunePromise = Promise.all([]),
        win32 = process.platform === 'win32',
        output = {log: [], error: []},
        success = true,
        options = _.defaults({}, config, {
            packageManager: 'npm',
            onlySpecified: false,
            install: false,
            scopeList: ['dependencies', 'devDependencies'],
            optionalScopeList: ['optionalDependencies'],
            verbose: false,
            checkGitUrls: false,
            log: console.log.bind(console),
            error: console.error.bind(console),
        });

    packageJsonName = options.packageManager === 'npm' ? 'package.json' : 'bower.json';
    packageJsonRegex = options.packageManager === 'npm' ? /package\.json$/ : /bower\.json$/;
    depsDirName = options.packageManager === 'npm' ? 'node_modules' : 'bower_components';

    options.packageDir = options.packageDir || findup(packageJsonName);
    if (!options.packageDir) {
        return missingPackageJson();
    }
    options.packageDir = path.resolve(options.packageDir.replace(packageJsonRegex, ''));

    packageJson = options.packageDir + '/' + packageJsonName;
    if (!fs.existsSync(packageJson)) {
        return missingPackageJson();
    }
    packageJson = require(packageJson);

    if (options.packageManager === 'bower') {
        bowerConfig = require('bower-config').create(options.packageDir).load();
        depsDirName = bowerConfig._config.directory;
    }

    // Bower uses a different name (with a dot) for package data of dependencies.
    depsJsonName = options.packageManager === 'npm' ? 'package.json' : '.bower.json';

    if (options.packageManager === 'bower') {
        // Allow a local bower.
        pkgManagerPath = findup('node_modules/bower/bin/bower');
    }

    depsDir = options.packageDir + '/' + depsDirName;

    depsMappings = getDepsMappingsFromScopeList(options.scopeList);

    // Make sure each package is present and matches a required version.
    _.forEach(depsMappings, function (versionString, name) {
        var depVersion,
            depDir = depsDir + '/' + name,
            depJson = depDir + '/' + depsJsonName;

        if (!fs.existsSync(depDir) || !fs.existsSync(depJson)) {
            error(name + ': ' + chalk.red('not installed!'));
            success = false;
            return;
        }

        // Let's look if we can get a valid version from a Git URL
        if (options.checkGitUrls && /\.git.*\#v?(.+)$/.test(versionString)) {
            versionString = (/\#v?(.+)$/.exec(versionString))[1];
            if (!semver.valid(versionString)) {
                return;
            }
        }

        // Quick and dirty check - make sure we're not dealing with a URL
        if (/\//.test(versionString)) {
            return;
        }

        // Skip version checks for 'latest' - the semver module won't help here and the check
        // would have to consult the npm server, making the operation slow.
        if (versionString === 'latest') {
            return;
        }

        depVersion = require(depJson).version;
        if (!semver.satisfies(depVersion, versionString)) {
            success = false;
            error(name + ': installed: ' + chalk.red(depVersion) +
                ', expected: ' + chalk.green(versionString));
        }

        if (success) {
            log(name + ': installed: ' + chalk.green(depVersion) +
                ', expected: ' + chalk.green(versionString));
        }
    });

    installNeeded = !success;

    fullDepsMappings = getDepsMappingsFromScopeList(options.scopeList.concat(options.optionalScopeList));
    if (options.onlySpecified) {
        fs.readdirSync(depsDir).forEach(function (depName) {
            if (!fullDepsMappings[depName]) {
                success = false;
                pruneNeeded = true;
                error('Package ' + depName + ' installed, though it shouldn\'t be');
            }
        });
    }

    if (success) {
        output.depsWereOk = true;
        return finish();
    }
    output.depsWereOk = false;

    if (!options.install) {
        if (options.onlySpecified) {
            error('Invoke ' + chalk.green(options.packageManager + ' prune') + ' and ' +
                chalk.green(options.packageManager + ' install') + ' to install missing packages ' +
                'and remove excessive ones');
        } else {
            error('Invoke ' + chalk.green(options.packageManager + ' install') + ' to install missing packages');
        }
        return finish();
    }


    function getDepsMappingsFromScopeList(scopeList) {
        // Get names of all packages specified in package.json/bower.json at keys from scopeList
        // together with specified version numbers.
        return scopeList.reduce(function (result, scope) {
            return _.merge(result, packageJson[scope] || {});
        }, {});
    }

    function installOrPrune(mode) {
        log('Invoking ' + chalk.green(options.packageManager + ' ' + mode) + '...');
        // If we're using a direct path, on Windows we need to invoke it via `node path`, not
        // `cmd /c path`. In UNIX systems we can execute the command directly so no need to wrap.
        return new Promise(function (resolve, reject) {
            spawn(win32 ? (pkgManagerPath ? 'node' : 'cmd') : options.packageManager,
                (win32 ?
                    (pkgManagerPath ? [pkgManagerPath] : ['/c', options.packageManager]) :
                    [])
                    .concat([mode]),
                {
                    cwd: options.packageDir,
                    stdio: 'inherit',
                })
                .on('close', function (code) {
                    if (code === 0) {
                        success = true;
                        resolve();
                        return;
                    }
                    success = false;
                    var msg = options.packageManager + ' ' + mode + ' failed with code: ' + chalk.red(code);
                    error(msg);
                    reject(msg);
                });
        });

    }

    function installMissing() {
        return installOrPrune('install');
    }

    function pruneExcessive() {
        return installOrPrune('prune');
    }

    // TODO is this needed?
    Promise.onPossiblyUnhandledRejection();

    if (installNeeded) {
        installPrunePromise = installPrunePromise.then(installMissing);
    }

    if (pruneNeeded) {
        installPrunePromise = installPrunePromise.then(pruneExcessive);
    }

    installPrunePromise
        .then(function () {
            success = true;
            finish();
        }).catch(function () {
            success = false;
            finish();
        });

    function log(message) {
        output.log.push(message);
        if (options.verbose) {
            options.log(message);
        }
    }

    function error(message) {
        output.error.push(message);
        if (options.verbose) {
            options.error(message);
        }
    }

    function finish() {
        output.status = success ? 0 : 1;
        return callback(output);
    }

    function missingPackageJson() {
        success = false;
        error('Missing ' + packageJsonName + '!');
        return finish();
    }
};

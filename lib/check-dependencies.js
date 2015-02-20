/**
 * check-dependencies
 * https://github.com/mzgol/check-dependencies
 *
 * Author Michał Gołębiowski <m.goleb@gmail.com>
 * Licensed under the MIT license.
 */

'use strict';

/* eslint-disable no-undef */
var fs = require('fs');
var path = require('path');
var chalk = require('chalk');
var findup = require('findup-sync');
var _ = require('lodash');
var semver = require('semver');
var Promise = require('bluebird');
var spawn = require('child_process').spawn;
var spawnSync = require('child_process').spawnSync;
/* eslint-enable no-undef */

function checkDependenciesHelper(syncOrAsync, config, callback) {
    // We treat the signature:
    //     checkDependencies(callback)
    // as:
    //     checkDependencies({}, callback)
    // Adjust the detected arguments.length to account for that.
    var adjustedArgumentsLength = arguments.length;
    if (syncOrAsync === 'async') {
        // Catch all cases where `config` is not an object - even if it's not a function
        // so it's useless here, we need it to be assigned to `callback` to provide
        // to the error message.
        if (typeof callback !== 'function' && (typeof config !== 'object' || config == null)) {
            adjustedArgumentsLength++;
            callback = config;
            config = null;
        }
        if (typeof callback !== 'function') {
            if (adjustedArgumentsLength >= 3) {
                // If callback was simply not provided, we assume the user wanted
                // to handle the returned promise. If it was passed but not a function
                // we assume user error and throw.
                throw new Error('The provided callback wasn\'t a function! Got:', callback);
            } else {
                // In the async mode we return the promise anyway; assign callback
                // to noop to keep code consistency.
                callback = _.noop;
            }
        }
    }

    var bowerConfig, depsMappings, optionalDepsMappings, fullDepsMappings,
        depsDir, depsDirName, depsJsonName,
        packageJson, packageJsonName, packageJsonRegex, pkgManagerPath;
    var installNeeded = false;
    var pruneNeeded = false;
    var installPrunePromise = Promise.all([]);
    var win32 = process.platform === 'win32';
    var output = {log: [], error: []};
    var success = true;
    var options = _.defaults({}, config, {
        packageManager: 'npm',
        onlySpecified: false,
        install: false,
        scopeList: ['dependencies', 'devDependencies'],
        optionalScopeList: ['optionalDependencies'],
        verbose: false,
        checkGitUrls: false,
        checkCustomPackageNames: false,
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

    // Make sure each package from `scopeList` is present and matches the specified version range.
    // Packages from `optionalScopeList` may not be present but if they are, they are required
    // to match the specified version range.
    function checkPackage(name, versionString, isOptional) {
        var depVersion;
        var depDir = depsDir + '/' + name;
        var depJson = depDir + '/' + depsJsonName;

        if (!fs.existsSync(depDir) || !fs.existsSync(depJson)) {
            if (isOptional) {
                log(name + ': ' + chalk.red('not installed!'));
            } else {
                error(name + ': ' + chalk.red('not installed!'));
                success = false;
            }
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

        // Bower has the option to specify a custom name, e.g. 'packageOld' : 'package#1.2.3'
        if (options.checkCustomPackageNames && options.packageManager !== 'npm') {
            // Let's look if we can get a valid version from a custom package name (with a # in it)
            if (/\.*\#v?(.+)$/.test(versionString)) {
                versionString = (/\#v?(.+)$/.exec(versionString))[1];
                if (!semver.valid(versionString)) {
                    return;
                }
            }
        }

        // If we are dealing with a custom package name, semver check won't work - skip it
        if (/\#/.test(versionString)) {
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
    }

    depsMappings = getDepsMappingsFromScopeList(options.scopeList);
    optionalDepsMappings = getDepsMappingsFromScopeList(options.optionalScopeList);
    fullDepsMappings = _.assign({}, depsMappings, optionalDepsMappings);

    _.forEach(depsMappings, function (versionString, name) {
        checkPackage(name, versionString, false /* isOptional */);
    });

    _.forEach(optionalDepsMappings, function (versionString, name) {
        checkPackage(name, versionString, true /* isOptional */);
    });

    installNeeded = !success;

    if (options.onlySpecified) {
        fs.readdirSync(depsDir)
            .filter(function (depName) {
                return depName !== '.bin';
            })
            .forEach(function (depName) {
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
        var msg;
        var method = syncOrAsync === 'sync' ? spawnSync : spawn;
        var spawnReturn = method(win32 ? (pkgManagerPath ? 'node' : 'cmd') : options.packageManager,
            (win32 ?
                (pkgManagerPath ? [pkgManagerPath] : ['/c', options.packageManager]) :
                [])
                .concat([mode]),
            {
                cwd: options.packageDir,
                stdio: 'inherit',
            });

        if (syncOrAsync === 'sync') {
            if (spawnReturn.status !== 0) {
                msg = options.packageManager + ' ' + mode + ' failed with code: ' +
                chalk.red(spawnReturn.status);
                throw new Error(msg);
            }
        } else {
            return new Promise(function (resolve, reject) {
                spawnReturn.on('close', function (code) {
                    if (code === 0) {
                        resolve();
                        return;
                    }
                    msg = options.packageManager + ' ' + mode + ' failed with code: ' + chalk.red(code);
                    error(msg);
                    reject(msg);
                });
            });
        }

    }

    function installMissing() {
        return installOrPrune('install');
    }

    function pruneExcessive() {
        return installOrPrune('prune');
    }

    if (syncOrAsync !== 'sync') {
        // TODO disable it in a more clever way?
        Promise.onPossiblyUnhandledRejection();
    }

    if (syncOrAsync === 'sync') {
        try {
            if (installNeeded) {
                installMissing();
            }

            if (pruneNeeded) {
                pruneExcessive();
            }

            success = true;
        } catch (error) {
            success = false;
        }
        return finish();
    }

    // Async scenario
    if (installNeeded) {
        installPrunePromise = installPrunePromise.then(installMissing);
    }

    if (pruneNeeded) {
        installPrunePromise = installPrunePromise.then(pruneExcessive);
    }

    return installPrunePromise
        .then(function () {
            success = true;
            return finish();
        })
        .catch(function () {
            success = false;
            return finish();
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
        if (syncOrAsync === 'async') {
            callback(output);
            return new Promise(function (resolve) {
                resolve(output);
            });
        }
        return output;
    }

    function missingPackageJson() {
        success = false;
        error('Missing ' + packageJsonName + '!');
        return finish();
    }
}

module.exports = function checkDependencies(/*config, callback*/) {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('async');
    return checkDependenciesHelper.apply(null, args);
};

module.exports.sync = function checkDependenciesSync(/*config*/) {
    if (!spawnSync) {
        throw new Error([
            'Your version of Node.js doesn\'t support child_process.spawnSync.',
            'Update Node.js or use require(\'checkDependencies\') instead of',
            'require(\'checkDependencies\').sync.',
        ].join(' '));
    }
    var args = Array.prototype.slice.call(arguments);
    args.unshift('sync');
    return checkDependenciesHelper.apply(null, args);
};

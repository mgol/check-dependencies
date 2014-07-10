/**
 * check-dependencies
 * https://github.com/mzgol/check-dependencies
 *
 * Author Michał Gołębiowski <m.goleb@gmail.com>
 * Licensed under the MIT license.
 */

'use strict';

var fs = require('fs'),
    path = require('path'),
    chalk = require('chalk'),
    findup = require('findup-sync'),
    _ = require('lodash'),
    semver = require('semver'),
    spawn = require('child_process').spawn;

module.exports = function checkDependencies(config, callback) {
    if (typeof callback !== 'function') {
        if (typeof config === 'function') {
            callback = config;
            config = {};
        } else {
            throw new Error('Callback has to be provided!');
        }
    }

    var bowerConfig, mappings, depsDirName, depsJsonName,
        packageJson, packageJsonName, packageJsonRegex, pkgManagerPath,
        win32 = process.platform === 'win32',
        output = {log: [], error: []},
        success = true,
        options = _.defaults({}, config, {
            packageManager: 'npm',
            install: false,
            scopeList: ['dependencies', 'devDependencies'],
            verbose: false,
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

    // Get names of all packages specified in bower.json/bower.json together with specified version numbers.
    mappings = options.scopeList.reduce(function (result, scope) {
        return _.merge(result, packageJson[scope] || {});
    }, {});

    // Make sure each package is present and matches a required version.
    _.forEach(mappings, function (versionString, name) {
        var depVersion,
            depDir = options.packageDir + '/' + depsDirName + '/' + name,
            depJson = depDir + '/' + depsJsonName;

        if (!fs.existsSync(depDir) || !fs.existsSync(depJson)) {
            error(name + ': ' + chalk.red('not installed!'));
            success = false;
            return;
        }

        // Quick and dirty check - make sure we're dealing with semver, not
        // a URL or a shortcut to the GitHub repo.
        if (/\//.test(versionString)) {
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

    if (success) {
        output.depsWereOk = true;
        return finish();
    } else {
        output.depsWereOk = false;
    }

    if (!options.install) {
        error('Invoke ' + chalk.green(options.packageManager + ' install') + ' to install missing packages');
        return finish();
    }

    log('Invoking ' + chalk.green(options.packageManager + ' install') + '...');

    // If we're using a direct path, on Windows we need to invoke it via `node path`, not `cmd /c path`.
    // In UNIX systems we can execute the command directly so no need to wrap.
    spawn(win32 ? (pkgManagerPath ? 'node' : 'cmd') : options.packageManager,
        (win32 ?
            (pkgManagerPath ? [pkgManagerPath] : ['/c', options.packageManager]) :
            [])
            .concat(['install']),
        {
            cwd: options.packageDir,
            stdio: 'inherit',
        })
        .on('close', function (code) {
            if (code === 0) {
                success = true;
                return finish();
            }
            success = false;
            error(options.packageManager + ' install failed with code: ' + chalk.red(code));
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
        return callback(output);
    }

    function missingPackageJson() {
        success = false;
        error('Missing ' + packageJsonName + '!');
        return finish();
    }
};

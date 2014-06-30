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

    var mappings, depsJson, depsJsonName, depsJsonRegex, depsDirName,
        win32 = process.platform === 'win32',
        output = {log: [], error: []},
        success = true,
        options = _.defaults({}, config, {
            type: 'npm',
            install: false,
            scopeList: ['dependencies', 'devDependencies'],
            verbose: false,
            log: console.log.bind(console),
            error: console.error.bind(console),
        });

    depsJsonName = options.type === 'npm' ? 'package.json' : 'bower.json';
    depsJsonRegex = options.type === 'npm' ? /package\.json/ : /bower\.json/;
    depsDirName = options.type === 'npm' ? 'node_modules' : 'bower_components';
    options.packageDir = path.resolve(options.packageDir || findup(depsJsonName).replace(depsJsonRegex, ''));

    depsJson = require(options.packageDir + '/' + depsJsonName);

    // Get names of all packages specified in bower.json/bower.json together with specified version numbers.
    mappings = options.scopeList.reduce(function (result, scope) {
        return _.merge(result, depsJson[scope] || {});
    }, {});

    // Make sure each package is present and matches a required version.
    _.forEach(mappings, function (versionString, name) {
        if (!fs.existsSync(options.packageDir + '/' + depsDirName + '/' + name)) {
            error(name + ': ' + chalk.red('not installed!'));
            success = false;
            return;
        }

        // Quick and dirty check - make sure we're dealing with semver, not
        // a URL or a shortcut to the GitHub repo.
        if (/\//.test(versionString)) {
            return;
        }

        var version = require(options.packageDir + '/' + depsDirName + '/' + name + '/' + depsJsonName).version;
        if (!semver.satisfies(version, versionString)) {
            success = false;
            error(name + ': installed: ' + chalk.red(version) +
                ', expected: ' + chalk.green(versionString));
        }

        if (success) {
            log(name + ': installed: ' + chalk.green(version) +
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
        error('Invoke ' + chalk.green(options.type + ' install') + ' to install missing packages');
        return finish();
    }

    log('Invoking ' + chalk.green(options.type + ' install') + '...');
    spawn(win32 ? 'cmd' : options.type,
        win32 ? ['/c', options.type, 'install'] : ['install'],
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
            error(options.type + ' install failed with code: ' + chalk.red(code));
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
};

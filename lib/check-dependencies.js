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

    var mappings, packageJson,
        win32 = process.platform === 'win32',
        output = {log: [], error: []},
        success = true,
        options = _.defaults({}, config, {
            install: false,
            scopeList: ['dependencies', 'devDependencies'],
            verbose: false,
            log: console.log.bind(console),
            error: console.error.bind(console),
        });

    options.packageDir = path.resolve(options.packageDir || findup('package.json').replace(/package\.json$/, ''));

    packageJson = require(options.packageDir + '/package.json');

    // Get names of all packages specified in package.json together with specified version numbers.
    mappings = options.scopeList.reduce(function (result, scope) {
        return _.merge(result, packageJson[scope] || {});
    }, {});

    // Make sure each package is present and matches a required version.
    _.forEach(mappings, function (versionString, name) {
        if (!fs.existsSync(options.packageDir + '/node_modules/' + name)) {
            error(name + ': ' + chalk.red('not installed!'));
            success = false;
            return;
        }

        // Quick and dirty check - make sure we're dealing with semver, not
        // a URL or a shortcut to the GitHub repo.
        if (/\//.test(versionString)) {
            return;
        }

        var version = require(options.packageDir + '/node_modules/' + name + '/package.json').version;
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
        error('Invoke ' + chalk.green('npm install') + ' to install missing packages');
        return finish();
    }

    log('Invoking ' + chalk.green('npm install') + '...');
    spawn(win32 ? 'cmd' : 'npm',
        win32 ? ['/c', 'npm', 'install'] : ['install'],
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
            error('npm install failed with code: ' + chalk.red(code));
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

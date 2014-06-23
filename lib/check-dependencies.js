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
    findup = require('findup-sync'),
    _ = require('lodash'),
    chalk = require('chalk'),
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
        validRun = true,
        options = _.defaults({}, config, {
            error: config.install === false,
            install: true,
            scopeList: ['dependencies', 'devDependencies'],
            verbose: false,
        });

    options.packageDir = path.resolve(options.packageDir || findup('package.json').replace(/package\.json$/, ''));

    packageJson = require(options.packageDir + '/package.json');

    // Get names of all packages specified in package.json together with specified version numbers.
    mappings = options.scopeList.reduce(function (result, scope) {
        return _.merge(result, packageJson[scope] || {});
    }, {});

    // Make sure each package is present and matches a required version.
    _(mappings).forEach(function (versionString, name) {
        if (!fs.existsSync(options.packageDir + '/node_modules/' + name)) {
            console.error(name + ': ' + chalk.red('not installed!'));
            validRun = false;
            return;
        }

        // Quick and dirty check - make sure we're dealing with semver, not
        // a URL or a shortcut to the GitHub repo.
        if (/\//.test(versionString)) {
            return;
        }

        var version = require(options.packageDir + '/node_modules/' + name + '/package.json').version;
        if (!semver.satisfies(version, versionString)) {
            validRun = false;
            console.error(name + ': installed: ' + chalk.red(version) +
                ', expected: ' + chalk.green(versionString));
        }

        if (validRun && config.verbose) {
            console.log(name + ': installed: ' + chalk.green(version) +
                ', expected: ' + chalk.green(versionString));
        }
    });

    if (validRun) {
        return callback();
    }

    if (!options.install) {
        console.log('Invoke ' + chalk.green('npm install') + ' to install missing packages');
        return callback(new Error('Invoke ' + chalk.green('npm install') +
            ' to install missing packages'));
    }

    console.log('Invoking ' + chalk.green('npm install') + '...');
    spawn(win32 ? 'cmd' : 'npm',
        [win32 ? '/c npm install' : 'install'],
        {
            cwd: options.packageDir,
            stdio: 'inherit',
        })
        .on('close', function (code) {
            if (code === 0) {
                return callback();
            }
            console.log('npm install failed with code: ' + chalk.red(code));
            return callback(new Error('npm install failed with code: ' + chalk.red(code)));
        });
};

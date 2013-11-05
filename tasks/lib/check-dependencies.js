/**
 * grunt-check-dependencies
 * https://github.com/mzgol/grunt-check-dependencies
 *
 * Author Michał Gołębiowski <m.goleb@gmail.com>
 * Licensed under the MIT license.
 */

'use strict';

var findup = require('findup-sync'),
    _ = require('lodash'),
    path = require('path'),
    semver = require('semver'),
    execSync = require('exec-sync');

module.exports = function (grunt) {
    return function checkDependencies(options) {
        var mappings,
            validRun = true,
            packageDir = options.packageDir || findup('package.json').replace(/package\.json$/, ''),
            scopeList = options.scopeList || ['peerDependencies', 'dependencies', 'devDependencies'],
            npmInstall = !!options.npmInstall,
            packageJson = grunt.file.readJSON(path.join(packageDir, 'package.json'));

        // Get names of all packages specified in package.json together with specified version numbers.
        mappings = scopeList.reduce(function (result, scope) {
            return _.merge(result, packageJson[scope] || {});
        }, {});

        // Make sure each package is present and matches a required version.
        _(mappings).forEach(function (versionString, name) {
            if (!grunt.file.exists(path.join(packageDir, 'node_modules', name))) {
                grunt.log.error(name + ': ' + 'not installed!'.red);
                validRun = false;
                return;
            }

            // Quick and dirty check - make sure we're dealing with semver, not
            // a URL or a shortcut to the GitHub repo.
            if (/\//.test(versionString)) {
                return;
            }

            var version = grunt.file.readJSON(
                path.join(packageDir, 'node_modules', name, 'package.json')).version;
            if (!semver.satisfies(version, versionString)) {
                validRun = false;
                grunt.log.error(name + ': installed: ' + version.red + ', expected: ' + versionString.green);
            }

            if (validRun) {
                grunt.verbose.writeln(name + ': installed: ' + version.green + ', expected: ' + versionString.green);
            }
        });

        if (!validRun) {
            if (!npmInstall) {
                grunt.log.writeln('Invoke ' + 'npm install'.green + ' to install missing packages');
            } else {
                try {
                    grunt.log.writeln('Invoking ' + 'npm install'.green + '...');
                    // execSync errors on non-empty stderr; silent such output.
                    execSync('npm install --loglevel error');
                    validRun = true;
                } catch (e) {
                    grunt.log.error('npm install'.green + ' ended with an ' + 'error'.red, e);
                }
            }
        }
        return validRun;
    };
};

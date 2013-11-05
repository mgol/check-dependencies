/**
 * grunt-check-dependencies
 * https://github.com/mzgol/grunt-check-dependencies
 *
 * Author Michał Gołębiowski <m.goleb@gmail.com>
 * Licensed under the MIT license.
 */

'use strict';

var _ = require('lodash'),
    path = require('path'),
    semver = require('semver'),
    execSync = require('exec-sync');

module.exports = function (grunt) {
    return function checkDependencies(options) {
        var mappings,
            validRun = true,
            packageDir = options.packageDir,
            scopeList = options.scopeList,
            npmInstall = options.npmInstall,
            packageJson = grunt.file.readJSON(path.join(packageDir, 'package.json'));

        // Get names of all packages specified in package.json together with specified version numbers.
        mappings = scopeList.reduce(function (result, scope) {
            return _.merge(result, packageJson[scope] || {});
        }, {});

        // Make sure each package is present and matches a required version.
        _(mappings).forEach(function (versionString, name) {
            if (!grunt.file.exists(path.join(packageDir, 'node_modules', name))) {
                grunt.log.error('Package ' + name + ' is not installed!');
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
                grunt.log.error('Package ' + name + '\'s installed version is ' + version +
                    ' which doesn\'t satisfy provided version requirements: ' + versionString);
            }

            if (validRun) {
                grunt.verbose.writeln('Package ' + name + '\'s installed version, ' + version + ', is correct.');
            }
        });

        if (!validRun) {
            if (!npmInstall) {
                grunt.log.error('Invoke `npm install` to fix errors');
            } else {
                try {
                    grunt.log.writeln('Invoking `npm install`...');
                    // execSync errors on non-empty stderr; silent such output.
                    execSync('npm install --loglevel error');
                    validRun = true;
                } catch (e) {
                    grunt.log.error('`npm install` ended with an error', e);
                }
            }
        }
        return validRun;
    };
};

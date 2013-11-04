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
    semver = require('semver');

module.exports = function (grunt) {
    grunt.registerTask('checkDependencies',
        'Checks if currently installed npm dependencies are installed in the exact same versions ' +
            'that are specified in package.json',
        function () {
            var mappings,
                validRun = true,
                config = findup('package.json'),
                scopeList = ['dependencies', 'devDependencies', 'peerDependencies'];

            if (typeof config === 'string') {
                config = require(config);
            }

            // Get names of all packages specified in package.json together with specified version numbers.
            mappings = scopeList.reduce(function (result, scope) {
                return _.merge(result, config[scope] || {});
            }, {});

            // Make sure each package is present and matches a required version.
            _(mappings).forEach(function (versionString, name) {
                if (!grunt.file.exists(path.join('node_modules', name))) {
                    grunt.log.error('Module ' + name + ' is not installed!');
                    validRun = false;
                    return;
                }

                // Quick and dirty check - make sure we're dealing with semver, not
                // a URL or a shortcut to the GitHub repo.
                if (/\//.test(versionString)) {
                    return;
                }

                var version = grunt.file.readJSON(path.join('node_modules', name, 'package.json')).version;
                if (!semver.satisfies(version, versionString)) {
                    validRun = false;
                    grunt.log.error('Package ' + name + '\'s installed version is ' + version +
                        ' which doesn\'t satisfy provided version requirements: ' + versionString);
                }

                grunt.verbose.writeln('Package ' + name + '\'s installed version, ' + version + ', is correct.');
            });

            if (!validRun) {
                grunt.log.error('Invoke `npm install` to fix errors');
            }
            return validRun;
        }
    );
};

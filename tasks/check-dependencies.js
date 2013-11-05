/**
 * grunt-check-dependencies
 * https://github.com/mzgol/grunt-check-dependencies
 *
 * Author Michał Gołębiowski <m.goleb@gmail.com>
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function (grunt) {
    var findup = require('findup-sync'),
        checkDependencies = require('./lib/check-dependencies')(grunt);

    grunt.registerMultiTask('checkDependencies',
        'Checks if currently installed npm dependencies are installed in the exact same versions ' +
            'that are specified in package.json',
        function () {
            var options = this.options();

            options.packageDir = options.packageDir || findup('package.json').replace(/package\.json$/, '');
            options.scopeList = options.scopeList || ['peerDependencies', 'dependencies', 'devDependencies'];

            return checkDependencies(options);
        }
    );
};

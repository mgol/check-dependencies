/**
 * grunt-check-dependencies
 * https://github.com/mzgol/grunt-check-dependencies
 *
 * Author Michał Gołębiowski <m.goleb@gmail.com>
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function (grunt) {
    var checkDependencies = require('./lib/check-dependencies')(grunt);

    grunt.registerMultiTask('checkDependencies',
        'Checks if currently installed npm dependencies are installed in the exact same versions ' +
            'that are specified in package.json',
        function () {
            return checkDependencies(this.options(), this.async());
        }
    );
};

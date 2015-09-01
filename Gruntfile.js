/**
 * check-dependencies
 * https://github.com/mzgol/check-dependencies
 *
 * Author Michał Gołębiowski <m.goleb@gmail.com>
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function (grunt) {
    require('time-grunt')(grunt);

    grunt.initConfig({
        clean: {
            all: {
                src: [
                    '*.log',
                    'test/*/*-copy',
                    'test/bower-fixtures/generated',
                ],
            },
        },

        eslint: {
            all: {
                src: [
                    '*.js',
                    'bin',
                    'lib',
                    'test',
                ],
            },
        },

        jscs: {
            all: {
                src: [
                    'Gruntfile.js',
                    'bin/**/*.js',
                    'lib/**/*.js',
                    'test/**/*.js',
                ],
                options: {
                    config: '.jscsrc',
                },
            },
        },

        mochaTest: {
            all: {
                options: {
                    reporter: 'spec',
                },
                src: ['test/spec.js'],
            },
        },
    });

    // Load all grunt tasks matching the `grunt-*` pattern.
    require('load-grunt-tasks')(grunt);

    grunt.registerTask('lint', [
        'eslint',
        'jscs',
    ]);

    grunt.registerTask('test', ['mochaTest']);

    grunt.registerTask('default', [
        'lint',
        'test',
    ]);
};

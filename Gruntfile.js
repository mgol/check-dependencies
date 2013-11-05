/**
 * grunt-check-dependencies
 * https://github.com/mzgol/grunt-check-dependencies
 *
 * Author Michał Gołębiowski <m.goleb@gmail.com>
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function (grunt) {
    // Project configuration.
    grunt.initConfig({
        jshint: {
            options: {
                jshintrc: true,
            },
            all: {
                src: [
                    'Gruntfile.js',
                    'tasks/*.js',
                    'test/spec/**/*.js',
                ],
            },
        },

        // Configuration to be run (and tested).
        checkDependencies: {
            thisPackage: {
                options: {
                    npmInstall: true,
                },
            },
            ok: {
                options: {
                    packageDir: 'test/ok/',
                    scopeList: ['peerDependencies', 'dependencies', 'devDependencies'],
                },
            },
            notOk: {
                options: {
                    packageDir: 'test/not-ok/',
                    scopeList: ['peerDependencies', 'dependencies', 'devDependencies'],
                },
            },
        },

        // Unit tests.
        mochaTest: {
            all: {
                options: {
                    reporter: 'spec',
                },
                src: ['test/spec.js']
            }
        },
    });

    // Load all grunt tasks matching the `grunt-*` pattern.
    require('load-grunt-tasks')(grunt);

    // Actually load this plugin's task(s).
    grunt.loadTasks('tasks');

    grunt.registerTask('test', ['mochaTest']);

    // By default, lint and run all tests.
    grunt.registerTask('default', [
        'jshint',
        'test',
    ]);
};

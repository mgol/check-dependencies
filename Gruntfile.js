'use strict';

// Disable options that don't work in Node.js 0.12.
// Gruntfile.js & tasks/*.js are the only non-transpiled files.
/* eslint-disable no-var, object-shorthand, prefer-arrow-callback, prefer-const,
 prefer-spread, prefer-reflect, prefer-template */

var assert = require('assert');

var newNode;
try {
    assert.strictEqual(eval('(r => [...r])([2])[0]'), 2); // eslint-disable-line no-eval
    newNode = true;
} catch (e) {
    newNode = false;
}

module.exports = function (grunt) {
    require('time-grunt')(grunt);

    grunt.initConfig({
        clean: {
            all: {
                src: [
                    'dist',
                    '*.log',
                    'test/*/*-copy',
                    'test/*-fixtures/generated',
                ],
            },
        },

        copy: {
            all: {
                files: [
                    {
                        expand: true,
                        dot: true,
                        src: [
                            'test/**/*',
                            '!test/**/*.js',
                        ],
                        dest: 'dist',
                    },
                ],
            },
        },

        babel: {
            options: {
                sourceMap: true,
                retainLines: true,
            },
            all: {
                files: [
                    {
                        expand: true,
                        src: [
                            'bin/**/*.js',
                            'lib/**/*.js',
                            'test/**/*.js',
                        ],
                        dest: 'dist',
                    },
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

        mochaTest: {
            all: {
                options: {
                    reporter: 'spec',
                },
                src: [newNode ? 'test/spec.js' : 'dist/test/spec.js'],
            },
        },
    });

    // Load all grunt tasks matching the `grunt-*` pattern.
    require('load-grunt-tasks')(grunt);

    grunt.registerTask('lint', [
        'eslint',
    ]);

    // In modern Node.js we just use the non-transpiled source as it makes it easier to debug;
    // in older version we transpile (but keep the lines).
    grunt.registerTask('build', [
        'copy',
        'babel',
    ]);

    grunt.registerTask('test', ['mochaTest']);

    grunt.registerTask('default', [
        'clean',
        'lint',
        'build',
        'test',
    ]);
};

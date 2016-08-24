'use strict';

// Disable options that don't work in Node.js 0.12.
// Gruntfile.js & tasks/*.js are the only non-transpiled files.
/* eslint-disable no-var, object-shorthand, prefer-arrow-callback, prefer-const,
 prefer-spread, prefer-reflect, prefer-rest-params, prefer-template */

var assert = require('assert');

var newNode;
try {
    assert.strictEqual(eval('(r => [...r])([2])[0]'), 2); // eslint-disable-line no-eval
    newNode = true;
} catch (e) {
    newNode = false;
}

var tooOldNodeForTheTask = /^v0\./.test(process.version);

// Support: Node.js <4
// Skip running tasks that dropped support for Node.js 0.10 & 0.12
// in those Node versions.
var runIfNewNode = function (task) {
    return tooOldNodeForTheTask ? 'print_old_node_message:' + task : task;
};

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

    // Load grunt tasks from NPM packages
    // Support: Node.js <4
    // Don't load the eslint task in old Node.js, it won't parse.
    require('load-grunt-tasks')(grunt, {
        pattern: tooOldNodeForTheTask ? ['grunt-*', '!grunt-eslint'] : ['grunt-*'],
    });

    // Supports: Node.js <4
    grunt.registerTask('print_old_node_message', function () {
        var task = [].slice.call(arguments).join(':');
        grunt.log.writeln('Old Node.js detected, running the task "' + task + '" skipped...');
    });

    grunt.registerTask('lint', [
        runIfNewNode('eslint'),
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

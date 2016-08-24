'use strict';

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
                src: 'test/spec.js',
            },
        },
    });

    // Load grunt tasks from NPM packages
    require('load-grunt-tasks')(grunt, {
        pattern: ['grunt-*'],
    });

    grunt.registerTask('lint', ['eslint']);
    grunt.registerTask('build', ['copy']);
    grunt.registerTask('test', ['mochaTest']);

    grunt.registerTask('default', [
        'clean',
        'lint',
        'build',
        'test',
    ]);
};

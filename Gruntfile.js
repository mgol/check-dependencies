'use strict';

module.exports = function (grunt) {
    require('time-grunt')(grunt);

    grunt.initConfig({
        clean: {
            all: {
                src: [
                    '*.log',
                    'test/*/*-copy',
                    'test/*-fixtures/generated',
                ],
            },
        },

        eslint: {
            all: {
                src: [
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
    require('load-grunt-tasks')(grunt);

    grunt.registerTask('lint', ['eslint']);
    grunt.registerTask('test', ['mochaTest']);

    grunt.registerTask('default', [
        'clean',
        'lint',
        'test',
    ]);
};

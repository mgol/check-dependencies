import mgolConfig from 'eslint-config-mgol';
import globals from 'globals';

export default [
    {
        ignores: ['node_modules/**', 'test/*/**/*.js'],
    },

    ...mgolConfig,

    {
        files: ['*.js', 'bin/**/*.js', 'lib/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
            },
        },
    },

    {
        files: ['*.mjs'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node,
            },
        },
    },

    {
        files: ['*.mjs'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node,
            },
        },
    },

    {
        files: ['test/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
                ...globals.mocha,
            },
        },
    },
];

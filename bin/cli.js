#!/usr/bin/env node

'use strict';

const util = require('node:util');
const checkDependencies = require('../lib/check-dependencies');

const camelCase = x =>
    x.replace(/-([a-z])/g, (__match, letter) => letter.toUpperCase());

const argv = util.parseArgs({
    options: {
        'package-manager': {
            type: 'string',
        },
        'package-dir': {
            type: 'string',
        },
        'only-specified': {
            type: 'boolean',
        },
        install: {
            type: 'boolean',
        },
        'scope-list': {
            type: 'string',
            multiple: true,
        },
        'optional-scope-list': {
            type: 'string',
            multiple: true,
        },
        'check-git-urls': {
            type: 'boolean',
        },
        verbose: {
            type: 'boolean',
        },
    },
}).values;

// camelCase the options
for (const key of Object.keys(argv)) {
    const value = argv[key];
    delete argv[key];
    argv[camelCase(key)] = value;
}

// Options of type array should always have array values
for (const option of ['scopeList', 'optionalScopeList']) {
    if (option in argv) {
        if (!Array.isArray(argv[option])) {
            argv[option] = [argv[option]];
        }
    }
}

// We'll handle verbosity by the CLI here.
const verbose = argv.verbose;
delete argv.verbose;

const Cli = {
    reporter(result) {
        if (verbose) {
            for (const msg of result.log) {
                console.log(msg);
            }
        }

        for (const msg of result.error) {
            console.error(msg);
        }

        if (result.status !== 0) {
            process.exitCode = result.status;
        }
    },
};

checkDependencies(argv).then(result => Cli.reporter(result));

module.exports = Cli;

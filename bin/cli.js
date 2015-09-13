#!/usr/bin/env node

'use strict';

const minimist = require('minimist');
const _ = require('lodash');
const checkDependencies = require('../lib/check-dependencies');

const argv = minimist(process.argv.slice(2));

// camelCase the options
for (const key in argv) {
    const value = argv[key];
    delete argv[key];
    argv[_.camelCase(key)] = value;
}

// We'll handle verbosity by the CLI here.
const verbose = argv.verbose;
delete argv.verbose;

const Cli = {
    reporter(result) {
        if (verbose) {
            result.log.forEach(function (msg) {
                console.log(msg);
            });
        }

        result.error.forEach(function (msg) {
            console.error(msg);
        });

        if (result.error.length > 0) {
            process.exit(1); // eslint-disable-line no-process-exit
        }
    },
};

checkDependencies(argv, Cli.reporter);

module.exports = Cli;

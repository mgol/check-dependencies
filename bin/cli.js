#!/usr/bin/env node

'use strict';

var minimist = require('minimist');
var _ = require('lodash');
var checkDependencies = require('../');

var argv = minimist(process.argv.slice(2));

// camelCase the options
for (var key in argv) {
    var value = argv[key];
    delete argv[key];
    argv[_.camelCase(key)] = value;
}

// We'll handle verbosity by the CLI here.
var verbose = argv.verbose;
delete argv.verbose;

var Cli = {
    reporter: function (result) {
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

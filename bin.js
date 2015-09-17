#!/usr/bin/env node

'use strict';

// Disable options that don't work in Node.js 0.10.
// Gruntfile.js & tasks/*.js are the only non-transpiled files.
/* eslint-disable no-var */

var semver = require('semver');

if (semver.satisfies(process.version, '>=4.0.0')) {
    module.exports = require('./bin/cli');
} else {
    module.exports = require('./dist/bin/cli');
}

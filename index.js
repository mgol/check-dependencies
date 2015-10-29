'use strict';

// Disable options that don't work in Node.js 0.12.
// Gruntfile.js & tasks/*.js are the only non-transpiled files.
/* eslint-disable no-var, no-eval */

var assert = require('assert');

try {
    assert.strictEqual(eval('(r => [...r])([2])[0]'), 2);
    module.exports = require('./lib/check-dependencies');
} catch (e) {
    module.exports = require('./dist/lib/check-dependencies');
}

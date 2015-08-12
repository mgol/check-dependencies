#!/usr/bin/env node

'use strict';

var minimist = require('minimist')
var checkDependencies = require('../');

var argv = minimist(process.argv.slice(2));

checkDependencies(argv, handleResult);

function handleResult(result) {
  result.error.forEach(function(dep) {
    console.log(dep);
  });

  if (result.error.length > 0) {
    process.exit(1);
  }
}

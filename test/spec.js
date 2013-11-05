'use strict';

var grunt = require('grunt'),
    expect = require('expect.js'),
    checkDependencies = require('../tasks/lib/check-dependencies')(grunt);

describe('Task: checkDependencies', function () {
    var errors = [],
        hooker = grunt.util.hooker;

    function hijackGruntLog(method) {
        hooker.hook(grunt.log, method, {
            // This gets executed before the original process.stdout.write.
            pre: function (result) {
                // Concatenate uncolored result onto actual.
                errors.push(grunt.log.uncolor(result));
                // Prevent the original process.stdout.write from executing.
                return hooker.preempt();
            }
        });
    }

    beforeEach(function () {
        hijackGruntLog('error');
        hijackGruntLog('writeln');
    });

    afterEach(function () {
        errors = [];
        // Restore grunt.log.error to its original value.
        hooker.unhook(grunt.log, 'error');
        hooker.unhook(grunt.log, 'writeln');
    });

    it('should not print anything for valid package setup', function () {
        var result = checkDependencies(grunt.config(['checkDependencies', 'ok', 'options']));
        expect(result).to.be(true);
        expect(errors).to.eql([]);
    });

    it('should error on invalid package setup', function () {
        var result = checkDependencies(grunt.config(['checkDependencies', 'notOk', 'options']));
        expect(result).to.be(false);
        expect(errors).to.eql([
            'Package a\'s installed version is 1.2.4 which doesn\'t satisfy provided version requirements: 1.2.3',
            'Package b\'s installed version is 0.9.9 which doesn\'t satisfy provided version requirements: >=1.0.0',
            'Package c is not installed!',
            'Invoke `npm install` to fix errors',
        ]);
    });
});

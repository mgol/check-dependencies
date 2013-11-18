'use strict';

var grunt = require('grunt'),
    expect = require('expect.js'),
    checkDependencies = require('../tasks/lib/check-dependencies')(grunt);

describe('Task: checkDependencies', function () {
    var output = {error: [], writeln: []},
        hooker = grunt.util.hooker;

    function hijackGruntLog(method) {
        hooker.hook(grunt.log, method, {
            // This gets executed before the original process.stdout.write.
            pre: function (result) {
                // Concatenate uncolored result onto actual.
                output[method].push(grunt.log.uncolor(result));
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
        output.error = [];
        output.writeln = [];
        // Restore grunt.log.error to its original value.
        hooker.unhook(grunt.log, 'error');
        hooker.unhook(grunt.log, 'writeln');
    });

    it('should not print anything for valid package setup', function (done) {
        checkDependencies(grunt.config(['checkDependencies', 'ok', 'options']), function (success) {
            expect(success).to.be(true);
            expect(output.error).to.eql([]);
            done();
        });
    });

    it('should error on invalid package setup', function (done) {
        checkDependencies(grunt.config(['checkDependencies', 'notOk', 'options']), function (success) {
            expect(success).to.be(false);
            expect(output.error).to.eql([
                'a: installed: 1.2.4, expected: 1.2.3',
                'b: installed: 0.9.9, expected: >=1.0.0',
                'c: not installed!',
            ]);
            done();
        });
    });
});

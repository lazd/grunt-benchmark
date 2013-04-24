/*
 * grunt-benchmark
 * https://github.com/shama/grunt-benchmark
 *
 * Copyright (c) 2013 Kyle Robinson Young
 * Licensed under the MIT license.
 */

module.exports = function(grunt) {
  'use strict';

  var Benchmark = require('Benchmark');
  var path = require('path');
  var fs = require('fs');
  var async = grunt.util.async;
  
  function logStart(name, src) {
    grunt.log.writeln('Benchmarking '+(name ? name+' ' : '')+'[' + src + ']...');
  }
  
  function writeResults(target, dest) {
    if (dest) {
      // Create the file withe the column headers
      if (!grunt.file.exists(dest)) {
        grunt.file.write(dest, 'name,date,error,count,cycles,hz\n');
      }
      
      // Append a line with the test results
      var line = [
          '"' + target.name + '"',
          '"' + (new Date()).toString() + '"',
          target.error,
          target.count,
          target.cycles,
          target.hz
      ].join(',') + '\n';
      
      fs.appendFileSync(dest, line);
    }
  };

  function runBench(src, dest, options, next) {
    var benchmarkOptions;
    var benchmarks = require(path.join(process.cwd(), src));

    if (typeof benchmarks === 'function') {
      /*
        // A lone function named by its file
        module.exports = function() {}  // Test function
      */
      benchmarkOptions = {};
      benchmarkOptions.name = path.basename(src, '.js');
      benchmarkOptions.fn = benchmarks;
    }
    
    if (typeof benchmarks.name === 'string' && typeof benchmarks.fn === 'function') {
      /*
        // A single test
        module.exports = {
          name: String,  // Test name
          fn: Function, // Test function
          [setup: Function],  // Other Benchmark parameters
          [teardown: Function] // etc
      */
      benchmarkOptions = benchmarks;
    }
    
    // Run a single benchmark
    if (benchmarkOptions) {
      var onComplete = benchmarkOptions.onComplete;
      benchmarkOptions.onComplete = function() {
        if (typeof onComplete === 'function') {
          onComplete.apply(this, arguments);
        }
        
        // Catch errors
        if (this.error) {
          grunt.log.error(this.error);
        }
        else {
          grunt.log.ok(this);
        }
        
        writeResults(this, dest);
        
        // Run the next test
        next();
      };
      
      // Create a single benchmark
      var benchmark = new Benchmark(benchmarkOptions);
      
      logStart('"'+benchmarkOptions.name+'"', src);
      
      // Run the benchmark
      benchmark.run();
    }
    else {
      /*
        // A suite of tests
        module.exports = {
          name: String, // Suite name
          tests: Object, // Object keyed on test name
          [setup: Function],  // Other Benchmark parameters
          [teardown: Function] // etc
        }
      */
      
      // Extract name
      var suiteName = benchmarks.name || path.basename(src, '.js');
      delete benchmarks.name;
      
      // Extract tests
      var tests = benchmarks.tests;
      delete benchmarks.tests;
      
      // Setup listeners
      var onCycle = benchmarks.onCycle;
      benchmarks.onCycle = function(event) {
        if (typeof onCycle === 'function') {
          onCycle.apply(this, arguments);
        }
        
        var target = event.target;
        
        grunt.log.ok('   '+target);
        
        writeResults(target, dest);
      };
        
      var onComplete = benchmarks.onComplete;
      benchmarks.onComplete = function() {
        if (typeof onComplete === 'function') {
          onComplete.apply(this, arguments);
        }
        
        // Catch errors
        if (this.error) {
          grunt.log.error(this.error);
        }
        else {
          grunt.log.writeln('Fastest is ' + Benchmark.pluck(Benchmark.filter(this, 'fastest'), 'name'));
        }
        
        // Run the next test
        next();
      };
      
      // Create a benchmarking suite
      var suite = new Benchmark.Suite(suiteName, benchmarks);
      
      for (var testName in tests) {
        var testData = tests[testName];
        if (typeof testData === 'function') {
          // A test with no parameters, named by its key
          suite.add(testName, testData);
        }
        else {
          // A test with parameters, named optionally by its key
          testData.name = testData.name || testName;
          suite.add(testData);
        }
      }
      
      logStart('suite "'+suiteName+'"', src);
      
      // Run the suite
      suite.run();
      
      // ben(options.times, grunt.util._.bind(benchmark.fn, context), function(ms) {
      //   grunt.log.ok(ms + ' ms per iteration');
      //   if (dest) {
      //     if (!grunt.file.exists(dest)) {
      //       grunt.file.write(dest, 'name,date,times,iteration\n');
      //     }
      //     var today = (new Date()).toString();
      //     fs.appendFileSync(dest, [name, '"' + today + '"', options.times, ms].join(',') + '\n');
      //   }
      //   n();
      // });
    }
  }

  grunt.registerMultiTask('benchmark', 'Grunt task for benchmarking grunt tasks', function() {
    // TODO: populate options
    var options = this.options();
    
    var done = this.async();
    async.forEachSeries(this.files, function(fileSet, nextSet) {
      async.forEachSeries(fileSet.src, function(file, next) {
        runBench(file, fileSet.dest || false, options, next);
      }, nextSet);
    }, done);
  });

};

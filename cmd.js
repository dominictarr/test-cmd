#! /usr/bin/env node

var Reporter = require('test-report')
  , path = require('path')
  , fs = require('fs')
  , d = require('d-utils')
  , opts = d.merge({}, require('optimist').argv)
  , tests = opts._
  , ls = require('ls-r')
  delete opts._

//
// usage 
// [cmd] test/*.js 
//
// --reportFile   write report to file
// --isolate      run each test in separate process]
// --timeout MS   stop a test if it's taking longer that MS milliseconds]
//                timeout must be user with --isolate
//

//
// TODO: 
//   * search for tests if no args (*test/*.js) or (./*.js)
//   * ignore files (defaults to fixtures, helpers)
//

function run (file, loader, adapter, reporter) {
  var shutdown = function () {}
    , failed = false
    , tests
    try {
      tests = loader (path.resolve(file))
    } catch (error) {
      failed = true
      reporter.error(error)
    }
  
    if (adapter && !failed)
      shutdown = adapter.run(tests, reporter, function () {})

  return shutdown
}

function go(adapter) {

  //parse arguments, load files, run command
  var reportFile = opts.reportFile || process.env.NODETEST_reportFile
    , isolate = opts.isolate || process.env.NODETEST_isolate
    , reporter = new Reporter(tests.length > 1 ? process.cwd() : tests[0])
    , shutdowns = []
    , isShutdown = false
    
  function runShutdown () {
    if(isShutdown) return
    isShutdown = true

    shutdowns.forEach(function (stop) {stop()})
    if(reportFile)
      fs.writeFileSync(reportFile, JSON.stringify(reporter.report))
    else 
      console.log(require('test-report-view').view(reporter.report))
      
    return reporter.report.failureCount
  }

  process.on('SIGINT', function () {
    reporter.error(new Error("test manualy stopped"))
    process.exit()
  })

  process.on('SIGTSTP', function () {
    reporter.error(new Error("recieved stop signal due to timeout"))
    process.exit()
  })

  process.on('SIGTERM', function () {
    reporter.error(new Error("recieved stop signal due to timeout"))
    process.exit()
  })

  process.on('exit', function (code) {
  
    // return error count.
    // check if the code is correct. if it is not, call exit(code)
    // take care to not cause a stackOverflow
    if(!isShutdown)
      process.exit(runShutdown())
  })
  var lsOpts = {
        strict: false, 
        prune: function (file) {
          return /\/\.git/.exec(file.path) || /node_modules/.exec(file.path)
        }
      }

//  console.log('PRE', tests)
//  tests = d.map(tests, path.resolve) 
  ls(tests, lsOpts, function (err, tests) {
    tests = d.filter(tests, /\.js$/)
//    console.log('POST',tests)
    if(isolate && tests.length > 1) {
      //run same node command again, but with only one test
      var _cmd = process.argv[1]
        , ctrl = require('ctrlflow')
        , started = {}

      ctrl.parallel.map(function (test, callback) {
        started[test] = true
        var child = require('./runner').runCP(_cmd, test, opts, function (err, report) {
          started[test] = false
          report.name = test
          reporter.test(report)
          callback(err, report)
        })
        console.log('isolating', test, "in", child.pid)
      })(tests, function (err) {
          if(err) reporter.error(err, 'strange')
          // the process will exit when the event loop empties
          // which should be right after this!
          // if it isn't, something has been left dangling open
          // or there is a still running timout or interval.
        })

      shutdowns = [function () {
        d.map(started, function (notFinished, test) {
          if(notFinished)
            reporter.test(test, 'was started but did not finish')
        })
      }]

    } else {
      shutdowns = 
      tests.map(function (file) {
        return run(file, function loader(file) {
            return require(file)
          }, adapter, tests.length > 1 ? reporter.subreport(file) : reporter)
      })
    }
  })
}

exports.run = run
exports.go = go

if(!module.parent) go()

#! /usr/bin/env node

var Reporter = require('test-report')
  , path = require('path')
  , fs = require('fs')
//
// usage 
// [cmd] test/*.js --file [write report to file] 

function run (file, loader, adapter, reporter) {
  var shutdown = function () {}
    , failed = false

    try{
      tests = loader (path.resolve(file))
    } catch (error) {
      failed = true
      reporter.error(error)
    }
  
    if (adapter && !failed)
      shutdown = adapter.run(tests, reporter, function () {})

  return shutdown
}

function args (argv) {
  var n
    , o = {args: []}
  while(argv.length) {
    n = argv.shift()
    if(n == '--reportFile')
      o.reportFile = argv.shift()
    else 
      o.args.push(n)
  }
  return o
}

function go(adapter) {

  //parse arguments, load files, run command
  var opts = args(process.argv.slice(2))
    , tests = opts.args
    , reportFile = opts.reportFile 
    , reporter = new Reporter(tests.length > 1 ? process.cwd() : tests[0])
    , shutdowns

  process.on('SIGINT',function (){
    reporter.error(new Error("test manualy stopped"))
    process.exit()
  })
  process.on('SIGTSTP',function (){
    reporter.error(new Error("recieved stop signal due to timeout"))
    //
    // return error count.
    //
    process.exit()
  })

  process.on('exit', function (code, signal){
    //
    //return error count.
    // check if the code is correct. if it is not, call exit(code)
    // take care to not cause a stackOverflow

    if(code != reporter.report.failureCount) {
      process.exit(reporter.report.failureCount)
    } else {
      //
      // trust the adapter to catch any thing thrown during shutdown.
      //
      shutdowns.forEach(function(e){e()})
      if(reportFile)
        fs.writeFileSync(reportFile,JSON.stringify(reporter.report))
      else {
        console.log(require('test-report-view').view(reporter.report))
      }
    }
  })

    
  shutdowns = 
  tests.map(function (file) {
    return run(file, function(file) {
        return require(path.resolve(file))
      }, adapter, tests.length > 1 ? reporter.subreport(file) : reporter)
  })
}

exports.run = run
exports.go = go
exports.args = args

if(!module.parent) go()

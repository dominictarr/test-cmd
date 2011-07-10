var Reporter = require('test-report')



function run (files, adapter, fname) {
  var reporter = new Reporter(fname)
    , shutdown
    
  if ('string' === typeof files) files = [files]

  try{
    tests = require (files[0])
  } catch (error) {
//    failed = true
    reporter.error(error)  
  }
  
  if (adapter)
    shutdown = adapter.run(tests, reporter, function () {})
}

exports.run = run

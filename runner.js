var //Reporter = require('test-report')
  //, path = require('path')
   fs = require('fs')
  , d = require('d-utils')
  , opts = d.merge({}, require('optimist').argv)
  , spawn = require('child_process').spawn
  , tests = opts._

function deparse (opts) {
  
  return d.mapToArray(opts, function (v,k) {
      return ['--' + k, v]
    }).reduce(function (a,b) {
      return [].concat(a).concat(b)
  },[])
}

function runCP (adapter, test, _opts, callback) {
  if (!callback) callback = _opts, _opts = opts 

  var out = []
    , tmp =  '/tmp/isolated_test_' + Math.random()

  _opts = d.merge({reportFile: tmp}, _opts)

  var command = [adapter, test].concat(deparse(_opts))
    , spawnOpts = {cwd: process.cwd()}

  var child = spawn(process.execPath, command, spawnOpts)
    , timer = d.delay(child.kill.bind(child), +(_opts.timeout || 30e3))('SIGTSTP')

  child.stdout.on('data', function (chunk) {
    out.push(chunk)
    process.stdout.write(chunk)
  })

  child.stderr.on('data', function (chunk) {
    out.push(chunk)
    process.stderr.write(chunk)
  })

  child.on('exit', function (code, status) {
    clearTimeout(timer)
    var report
    try {
      var file = fs.readFileSync(tmp)
      report = JSON.parse(file)
      fs.unlinkSync(tmp)
    } catch (err) {
      return callback(err, {name: test, status: 'error', failures: [err], failureCount: 1})
    }
    report.output = out.join('')
    callback(null, report)
  })

  return child
}
exports.runCP = runCP

const transformTools = require('browserify-transform-tools')

const nodeRequire = '/node'
const browserRequire = '/browser'

module.exports = transformTools.makeRequireTransform(
  'nodeToBrowserRequireTransform',
  { evaluateArguments: true },
  function (args, opts, cb) {
    const requireArg = args[0]
    const endsWithNodeRequire =
      requireArg.slice(-nodeRequire.length) === nodeRequire
    if (endsWithNodeRequire) {
      const newRequireArg = requireArg.replace(nodeRequire, browserRequire)
      return cb(null, "require('" + newRequireArg + "')")
    } else {
      return cb()
    }
  }
)

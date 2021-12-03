import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import polyfillNode from 'rollup-plugin-polyfill-node'
import injectProcessEnv from 'rollup-plugin-inject-process-env'

function getDescriptor () {
  const currentDescriptor = process.env.DRIVER_DESCRIPTOR || ''
  return currentDescriptor + ',browser'
}

export default {
  input: 'src/index.js',
  output: {
    dir: 'public',
    format: 'umd',
    name: 'testkitbackend'
  },
  plugins: [
    nodeResolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs(),
    polyfillNode({
    }),
    injectProcessEnv({
      ...process.env,
      TEST_ENVIRONMENT: 'LOCAL',
      CHANNEL_TYPE: 'WEBSOCKET',
      DRIVER_DESCRIPTOR: getDescriptor(),
      BACKEND_PORT: process.env.WEB_SERVER_PORT || 8000
    })
  ]
}

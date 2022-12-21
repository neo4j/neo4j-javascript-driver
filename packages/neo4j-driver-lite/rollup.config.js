import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import polyfillNode from 'rollup-plugin-polyfill-node'

export default {
  input: 'lib/index.js',
  output: [{
    file: 'lib/browser/neo4j-lite-web.js',
    format: 'umd',
    name: 'neo4j'
  }, {
    file: 'lib/browser/neo4j-lite-web.esm.js',
    format: 'esm'
  }],
  plugins: [
    nodeResolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs(),
    polyfillNode({
    })
  ]
}

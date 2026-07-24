// See: https://rollupjs.org/introduction/

import commonjs from '@rollup/plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'

const plugins = () => [
  typescript(),
  nodeResolve({ preferBuiltins: true }),
  commonjs()
]

const config = [
  {
    input: 'src/index.ts',
    output: {
      esModule: true,
      file: 'dist/index.js',
      format: 'es',
      sourcemap: true
    },
    plugins: plugins()
  },
  {
    input: 'src/cli/index.ts',
    output: {
      esModule: true,
      file: 'dist/cli.js',
      format: 'es',
      sourcemap: true,
      banner: '#!/usr/bin/env node'
    },
    plugins: plugins()
  }
]

export default config

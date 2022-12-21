/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [http://neo4j.com]
 *
 * This file is part of Neo4j.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const buffer = require('vinyl-buffer')
const gulp = require('gulp')
const uglify = require('gulp-uglify')
const jasmine = require('gulp-jasmine')
const watch = require('gulp-watch')
const batch = require('gulp-batch')
const replace = require('gulp-replace')
const fs = require('fs-extra')
const path = require('path')
const minimist = require('minimist')
const install = require('gulp-install')
const file = require('gulp-file')
const rollup = require('rollup')
const rollupCommonJs = require('@rollup/plugin-commonjs')
const rollupNodeResolve = require('@rollup/plugin-node-resolve').default
const rollupPolyfillNode = require('rollup-plugin-polyfill-node')
const semver = require('semver')
const sharedNeo4j = require('./test/internal/shared-neo4j').default
const stream = require('stream')
const ts = require('gulp-typescript')
const JasmineReporter = require('jasmine-spec-reporter').SpecReporter
const karma = require('karma')
const log = require('fancy-log')
const JasmineExec = require('jasmine')

/**
 * Useful to investigate resource leaks in tests. Enable to see active sockets and file handles after the 'test' task.
 */
const enableActiveNodeHandlesLogging = false

const browserOutput = 'lib/browser'

gulp.task('nodejs', function () {
  return gulp
    .src('src/**/*.js')
    .pipe(ts({
      target: 'ES5',
      lib: ['ES6'],
      noImplicitAny: true,
      noImplicitReturns: true,
      strictNullChecks: true,
      esModuleInterop: true,
      moduleResolution: 'node',
      downlevelIteration: true,
      allowJs: true,
      isolatedModules: true
    }))
    .pipe(gulp.dest('lib'))
})

gulp.task('generate-umd-bundle', generateBrowserBundleTask({
  outputFile: 'neo4j-web.js',
  outputFileMin: 'neo4j-web.min.js',
  name: 'neo4j',
  format: 'umd'
}))

gulp.task('minify-umd-bundle', minifyBrowserBundleTask({
  inputFile: 'neo4j-web.js',
  outputFile: 'neo4j-web.min.js'
}))

gulp.task('browser::umd', gulp.series('generate-umd-bundle', 'minify-umd-bundle'))

gulp.task('generate-esm-bundle', generateBrowserBundleTask({
  outputFile: 'neo4j-web.esm.js',
  format: 'esm'
}))

gulp.task('minify-esm-bundle', minifyBrowserBundleTask({
  inputFile: 'neo4j-web.esm.js',
  outputFile: 'neo4j-web.esm.min.js'
}))

gulp.task('browser::esm', gulp.series('generate-esm-bundle', 'minify-esm-bundle'))

/** Build all-in-one files for use in the browser */
gulp.task('browser', gulp.series('nodejs', gulp.parallel('browser::umd', 'browser::esm')))

// prepares directory for package.test.js
gulp.task(
  'install-driver-into-sandbox',
  gulp.series('nodejs', function () {
    const testDir = path.join('build', 'sandbox')
    fs.emptyDirSync(testDir)

    const packageJsonContent = JSON.stringify({
      private: true,
      dependencies: {
        'neo4j-driver': __dirname
      }
    })

    return file('package.json', packageJsonContent, { src: true })
      .pipe(gulp.dest(testDir))
      .pipe(install())
  })
)

gulp.task(
  'test-nodejs',
  gulp.series('install-driver-into-sandbox', function () {
    return gulp
      .src(['./test/**/*.test.js', '!./test/**/browser/*.js'])
      .pipe(
        jasmine({
          includeStackTrace: true,
          reporter: newJasmineConsoleReporter()
        })
      )
      .on('end', logActiveNodeHandles)
  })
)

gulp.task('test-nodejs-unit', () => {
  return runJasmineTests('#unit*')
})

gulp.task('test-nodejs-stub', () => {
  return runJasmineTests('#stub*')
})

gulp.task('test-nodejs-integration', () => {
  return runJasmineTests('#integration*')
})

gulp.task('run-browser-test-chrome', function (cb) {
  runKarma('chrome', cb)
})

gulp.task('run-browser-test-firefox', function (cb) {
  runKarma('firefox', cb)
})

gulp.task('run-browser-test', gulp.series('run-browser-test-firefox'))

gulp.task('watch', function () {
  return watch(
    'src/**/*.js',
    batch(function (events, done) {
      gulp.start('all', done)
    })
  )
})

gulp.task(
  'watch-n-test',
  gulp.series('test-nodejs', function () {
    return gulp.watch(['src/**/*.js', 'test/**/*.js'], ['test-nodejs'])
  })
)

/** Set the project version, controls package.json and version.js */
gulp.task('set', function () {
  // example: gulp set --x 4.0.2

  // Get the --x arg from command line
  const command = minimist(process.argv.slice(2), { string: 'x' })
  const version = command.x

  if (!semver.valid(version)) {
    throw new Error(`Invalid version "${version}"`)
  }

  // Change the version in relevant files
  const versionFile = path.join('src', 'version.js')
  return gulp
    .src([versionFile], { base: './' })
    .pipe(replace('0.0.0-dev', version))
    .pipe(gulp.dest('./'))
})

gulp.task('start-neo4j', function (done) {
  sharedNeo4j.start()
  done()
})

gulp.task('stop-neo4j', function (done) {
  sharedNeo4j.stop()
  done()
})

gulp.task('run-stress-tests', function () {
  return gulp
    .src('test/**/stress.test.js')
    .pipe(
      jasmine({
        includeStackTrace: true,
        reporter: newJasmineConsoleReporter()
      })
    )
    .on('end', logActiveNodeHandles)
})

gulp.task('run-stress-tests-without-jasmine', function () {
  const stresstest = require('./test/stress-test')
  return stresstest()
})

gulp.task('run-ts-declaration-tests', function (done) {
  return gulp
    .src(['test/types/**/*', 'types/**/*'], { base: '.' })
    .pipe(
      ts({
        lib: ['es6', 'dom', 'esnext.asynciterable'],
        module: 'es6',
        target: 'es6',
        noImplicitAny: true,
        noImplicitReturns: true,
        strictNullChecks: true,
        moduleResolution: 'node',
        types: []
      })
    )
    .pipe(gulp.dest('build/test/types'))
    .on('error', err => done(err))
    .on('end', () => done())
})

gulp.task('all', gulp.series('nodejs', 'browser'))

gulp.task('test-browser', gulp.series('browser', 'run-browser-test'))

gulp.task(
  'test',
  gulp.series('run-ts-declaration-tests', 'test-nodejs', 'test-browser')
)

gulp.task('default', gulp.series('test'))

function logActiveNodeHandles () {
  if (enableActiveNodeHandlesLogging) {
    console.log(
      '-- Active NodeJS handles START\n',
      process._getActiveHandles(),
      '\n-- Active NodeJS handles END'
    )
  }
}

function newJasmineConsoleReporter () {
  return new JasmineReporter({
    colors: {
      enabled: true
    },
    spec: {
      displayDuration: true,
      displayErrorMessages: true,
      displayStacktrace: true,
      displayFailed: true,
      displaySuccessful: true,
      displayPending: false
    },
    summary: {
      displayFailed: true,
      displayStacktrace: true,
      displayErrorMessages: true
    }
  })
}

function runKarma (browser, cb) {
  new karma.Server(
    {
      configFile: path.join(__dirname, `/test/browser/karma-${browser}.conf.js`)
    },
    function (exitCode) {
      exitCode ? process.exit(exitCode) : cb()
    }
  ).start()
}

function runJasmineTests (filterString) {
  return new Promise((resolve, reject) => {
    const jasmine = new JasmineExec()
    jasmine.loadConfigFile('./spec/support/jasmine.json')
    jasmine.loadHelpers()
    jasmine.loadSpecs()
    jasmine.configureDefaultReporter({
      print: () => {}
    })
    jasmine.addReporter(newJasmineConsoleReporter())
    jasmine.exitOnCompletion = false
    jasmine.execute(null, filterString)
      .then(result => {
        if (result.overallStatus === 'passed') {
          resolve()
        } else {
          reject(new Error('tests failed'))
        }
      })
  })
}

function generateBrowserBundleTask ({ format, name, outputFile }) {
  return async function () {
    return await rollup.rollup({
      input: 'lib/index.js',
      plugins: [
        rollupNodeResolve({
          browser: true,
          preferBuiltins: false
        }),
        rollupCommonJs(),
        rollupPolyfillNode()
      ]
    }).then(bundle => {
      return bundle.write({
        file: `${browserOutput}/${outputFile}`,
        format,
        name
      })
    })
  }
}

function minifyBrowserBundleTask ({ inputFile, outputFile }) {
  return async function () {
    const input = `${browserOutput}/${inputFile}`
    const output = `${browserOutput}/${outputFile}`

    return gulp.src(input)
      .on('error', log.error)
      .pipe(new stream.Transform({
        objectMode: true,
        transform (file, _, callback) {
          const clone = file.clone()
          clone.path = output
          callback(null, clone)
        }
      }))
      .pipe(buffer())
      .pipe(uglify())
      .pipe(gulp.dest(browserOutput))
  }
}

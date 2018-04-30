/**
 * Copyright (c) 2002-2018 Neo4j Sweden AB [http://neo4j.com]
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

var browserify = require('browserify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var gulp = require('gulp');
var through = require('through2');
var uglify = require('gulp-uglify');
var gutil = require('gulp-util');
var download = require("gulp-download");
var jasmine = require('gulp-jasmine');
var babelify = require('babelify');
var babel = require('gulp-babel');
var watch = require('gulp-watch');
var batch = require('gulp-batch');
var replace = require('gulp-replace');
var decompress = require('gulp-decompress');
var fs = require("fs-extra");
var runSequence = require('run-sequence');
var path = require('path');
var minimist = require('minimist');
var cucumber = require('gulp-cucumber');
var install = require("gulp-install");
var os = require('os');
var file = require('gulp-file');
var semver = require('semver');
var sharedNeo4j = require('./test/internal/shared-neo4j').default;
var ts = require('gulp-typescript');
var JasmineConsoleReporter = require('jasmine-console-reporter');
var karmaServer = require('karma').Server;

/**
 * Useful to investigate resource leaks in tests. Enable to see active sockets and file handles after the 'test' task.
 */
var enableActiveNodeHandlesLogging = false;

gulp.task('default', ["test"]);

gulp.task('browser', function(cb){
  runSequence('build-browser-test', 'build-browser', cb);
});

/** Build all-in-one files for use in the browser */
gulp.task('build-browser', function () {
  var browserOutput = 'lib/browser';
  // Our app bundler
  var appBundler = browserify({
    entries: ['src/index.js'],
    cache: {},
    standalone: 'neo4j',
    packageCache: {}
  }).transform(babelify.configure({
    presets: ['es2015', 'stage-3'], ignore: /external/
  })).bundle();

  // Un-minified browser package
  appBundler
    .on('error', gutil.log)
    .pipe(source('neo4j-web.js'))
    .pipe(gulp.dest(browserOutput));

  return appBundler
    .on('error', gutil.log)
    .pipe(source('neo4j-web.min.js'))
    .pipe(buffer())
    .pipe(uglify())
    .pipe(gulp.dest(browserOutput));
});

gulp.task('build-browser-test', function(){
  var browserOutput = 'lib/browser/';
  var testFiles = [];
  return gulp.src('./test/**/*.test.js')
    .pipe( through.obj( function( file, enc, cb ) {
      if(file.path.indexOf('examples.test.js') < 0) {
        testFiles.push( file.path );
      }
      cb();
    }, function(cb) {
      // At end-of-stream, push the list of files to the next step
      this.push( testFiles );
      cb();
    }))
    .pipe( through.obj( function( testFiles, enc, cb) {
      browserify({
          entries: testFiles,
          cache: {},
          debug: true
        }).transform(babelify.configure({
          presets: ['es2015', 'stage-3'], plugins: ['transform-runtime'], ignore: /external/
        }))
        .bundle(function(err, res){
          cb();
        })
        .on('error', gutil.log)
        .pipe(source('neo4j-web.test.js'))
        .pipe(gulp.dest(browserOutput))
    },
    function(cb) {
      cb()
    }
    ));
});

var buildNode = function(options) {
  return gulp.src(options.src)
    .pipe(babel({presets: ['es2015', 'stage-3'], plugins: ['transform-runtime'], ignore: ['src/external/**/*.js']}))
    .pipe(gulp.dest(options.dest))
};

gulp.task('nodejs', function(){
  return buildNode({
    src: 'src/**/*.js',
    dest: 'lib'
    });
});

gulp.task('all', function(cb){
  runSequence('nodejs', 'browser', cb);
});

// prepares directory for package.test.js
gulp.task('install-driver-into-sandbox', ['nodejs'], function(){
  var testDir = path.join(os.tmpdir(), 'sandbox');
  fs.emptyDirSync(testDir);

  var packageJsonContent = JSON.stringify({
      "dependencies":{
          "neo4j-driver" : __dirname
      }
  });

  return file('package.json', packageJsonContent, {src:true})
      .pipe(gulp.dest(testDir))
      .pipe(install());
});

gulp.task('test', function (cb) {
  runSequence('run-ts-declaration-tests', 'test-nodejs', 'test-browser', 'run-tck', function (err) {
    if (err) {
      var exitCode = 2;
      console.log('[FAIL] test task failed - exiting with code ' + exitCode);
      return process.exit(exitCode);
    }
    return cb();
  });
});

gulp.task('test-nodejs', ['install-driver-into-sandbox'], function () {
  return gulp.src('test/**/*.test.js')
    .pipe(jasmine({
      includeStackTrace: true,
      reporter: newJasmineConsoleReporter()
    })).on('end', logActiveNodeHandles);
});

gulp.task('test-browser', function (cb) {
  runSequence('all', 'run-browser-test', cb)
});

gulp.task('run-browser-test', function(cb){
  runSequence('run-browser-test-firefox', cb);
});

gulp.task('run-browser-test-chrome', function(cb){
  new karmaServer({
    configFile: __dirname + '/test/browser/karma-chrome.conf.js',
  }, cb).start();
});

gulp.task('run-browser-test-firefox', function(cb){
  new karmaServer({
    configFile: __dirname + '/test/browser/karma-firefox.conf.js',
  }, cb).start();
});

gulp.task('run-browser-test-edge', function(cb){
  new karmaServer({
    configFile: __dirname + '/test/browser/karma-edge.conf.js',
  }, cb).start();
});

gulp.task('run-browser-test-ie', function (cb) {
  new karmaServer({
    configFile: __dirname + '/test/browser/karma-ie.conf.js',
  }, cb).start();
});

gulp.task('watch', function () {
  return watch('src/**/*.js', batch(function (events, done) {
      gulp.start('all', done);
  }));
});

gulp.task('watch-n-test', ['test-nodejs'], function () {
  return gulp.watch(['src/**/*.js', "test/**/*.js"], ['test-nodejs'] );
});

var featureFiles   = 'https://s3-eu-west-1.amazonaws.com/remoting.neotechnology.com/driver-compliance/tck.tar.gz';
var featureHome    = './build/tck';

gulp.task('download-tck', function() {
  return download(featureFiles)
        .pipe(decompress({strip: 1}))
        .pipe(gulp.dest(featureHome));
});

gulp.task('run-tck', ['download-tck', 'nodejs'], function() {
    return gulp.src(featureHome + "/*").pipe(cucumber({
        'steps': 'test/v1/tck/steps/*.js',
        'format': 'progress',
        'tags' : ['~@fixed_session_pool', '~@db', '~@equality', '~@streaming_and_cursor_navigation']
    })).on('end', logActiveNodeHandles);
});

/** Set the project version, controls package.json and version.js */
gulp.task('set', function() {
  // Get the --version arg from command line
  var version = minimist(process.argv.slice(2), { string: 'version' }).version;

  if (!semver.valid(version)) {
      throw 'Invalid version "' + version + '"';
  }

  // Change the version in relevant files
  var versionFile = path.join('src', 'version.js');
  return gulp.src([versionFile], {base: "./"})
      .pipe(replace('0.0.0-dev', version))
      .pipe(gulp.dest('./'));

});


var neo4jHome = path.resolve('./build/neo4j');

gulp.task('start-neo4j', function (done) {
  sharedNeo4j.start(neo4jHome, process.env.NEOCTRL_ARGS);
  done();
});

gulp.task('stop-neo4j', function (done) {
  sharedNeo4j.stop(neo4jHome);
  done();
});

gulp.task('run-stress-tests', function () {
  return gulp.src('test/**/stress.test.js')
    .pipe(jasmine({
      includeStackTrace: true,
      reporter: newJasmineConsoleReporter()
    })).on('end', logActiveNodeHandles);
});

gulp.task('run-ts-declaration-tests', function () {
  var failed = false;

  return gulp.src(['test/types/**/*', 'types/**/*'], {base: '.'})
    .pipe(ts({
      module: 'es6',
      target: 'es6',
      noImplicitAny: true,
      noImplicitReturns: true,
      strictNullChecks: true,
    }))
    .on('error', function () {
      failed = true;
    })
    .on('finish', function () {
      if (failed) {
        console.log('[ERROR] TypeScript declarations contain errors. Exiting...');
        process.exit(1);
      }
    })
    .pipe(gulp.dest('build/test/types'));
});

function logActiveNodeHandles() {
  if (enableActiveNodeHandlesLogging) {
    console.log('-- Active NodeJS handles START\n', process._getActiveHandles(), '\n-- Active NodeJS handles END');
  }
}

function newJasmineConsoleReporter() {
  return new JasmineConsoleReporter({
    colors: 1,
    cleanStack: 1,
    verbosity: 4,
    listStyle: 'indent',
    activity: false
  });
}

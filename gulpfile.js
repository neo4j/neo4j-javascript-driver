/**
 * Copyright (c) 2002-2016 "Neo Technology,"
 * Network Engine for Objects in Lund AB [http://neotechnology.com]
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
var gulpif = require('gulp-if');
var uglify = require('gulp-uglify');
var concat = require('gulp-concat');
var gutil = require('gulp-util');
var download = require("gulp-download");
var shell = require('gulp-shell');
var jasmine = require('gulp-jasmine');
var jasmineBrowser = require('gulp-jasmine-browser');
var reporters = require('jasmine-reporters');
var babelify = require('babelify');
var babel = require('gulp-babel');
var watch = require('gulp-watch');
var batch = require('gulp-batch');
var replace = require('gulp-replace');
var decompress = require('gulp-decompress');
var fs = require("fs");
var runSequence = require('run-sequence');
var path = require('path');
var childProcess = require("child_process");
var minimist = require('minimist');
var cucumber = require('gulp-cucumber');

gulp.task('default', ["test"]);

gulp.task('browser', function(cb){
  runSequence('build-browser-test', 'build-browser', cb);
})

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
    ignore: /external/
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
      testFiles.push( file.path );
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
          ignore: /external/
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

var compress = function(source, dest, filename) {

}

var buildNode = function(options) {
  return gulp.src(options.src)
    .pipe(babel({ignore: ['src/external/**/*.js']}))
    .pipe(gulp.dest(options.dest))
}

gulp.task('nodejs', function(){
  return buildNode({
    src: 'src/**/*.js',
    dest: 'lib'
    });
})

gulp.task('all', function(cb){
  runSequence('nodejs', 'browser', cb);
});

gulp.task('test', function(cb){
  runSequence('test-nodejs', 'test-browser', 'run-tck', cb);
});

gulp.task('test-nodejs', ['nodejs'], function () {
  return gulp.src('test/**/*.test.js')
        .pipe(jasmine({
            // reporter: new reporters.JUnitXmlReporter({
            //   savePath: "build/nodejs-test-reports",
            //   consolidateAll: false
            // }),
            includeStackTrace: true
        }));
});

gulp.task('test-browser', function (cb) {
  runSequence('all', 'run-browser-test', cb)
});

gulp.task('run-browser-test', function(){
  return gulp.src('lib/browser/neo4j-web.test.js')
    .pipe(jasmineBrowser.specRunner({console: true}))
    .pipe(jasmineBrowser.headless())
});

gulp.task('watch', function () {
  return watch('src/**/*.js', batch(function (events, done) {
      gulp.start('all', done);
  }));
});

gulp.task('watch-n-test', ['test-nodejs'], function () {
  return gulp.watch(['src/**/*.js', "test/**/*.js"], ['test-nodejs'] );
});

var neo4jLinuxUrl = 'http://alpha.neohq.net/dist/neo4j-enterprise-3.0.0-NIGHTLY-unix.tar.gz';
var neo4jWinUrl   = 'http://alpha.neohq.net/dist/neo4j-enterprise-3.0.0-NIGHTLY-windows.zip';
var neo4jHome     = './build/neo4j-enterprise-3.0.0-M02';
var isWin         = /^win/.test(process.platform);

gulp.task('download-neo4j', function() {
  if( !fs.existsSync(neo4jHome) ) {
    // Need to download
    if(isWin) {
        return download(neo4jWinUrl)
              .pipe(decompress({strip: 1}))
              .pipe(gulp.dest(neo4jHome));
    }
    else {
        return download(neo4jLinuxUrl)
              .pipe(decompress({strip: 1}))
              .pipe(gulp.dest(neo4jHome));
    }
  }
});

var featureFiles   = 'https://s3-eu-west-1.amazonaws.com/remoting.neotechnology.com/driver-compliance/tck.tar.gz';
var featureHome     = './build/tck';

gulp.task('download-tck', function() {
  return download(featureFiles)
        .pipe(decompress({strip: 1}))
        .pipe(gulp.dest(featureHome));
});

gulp.task('run-tck', ['download-tck', 'nodejs'], function() {
    return gulp.src(featureHome + "/*").pipe(cucumber({
        'steps': 'test/v1/tck/steps/*.js',
        'format': 'pretty',
        'tags' : "~@in_dev"
    }));
});

var runPowershell = function( cmd ) {
    var spawn = childProcess.spawn, child;
    child = spawn("powershell.exe",[
        'Import-Module ' + neo4jHome + '/bin/Neo4j-Management.psd1;' + cmd]);
    child.stdout.on("data",function(data){
        console.log("Powershell Data: " + data);
    });
    child.stderr.on("data",function(data){
        console.log("Powershell Errors: " + data);
    });
    child.on("exit",function(){
        console.log("Powershell Script finished");
    });
    child.stdin.end(); //end input
}

/** Set the project version, controls package.json and version.js */
gulp.task('set', function() {
  // Get the --version arg from command line
  var version = minimist(process.argv.slice(2), { string: 'version' }).version;

  // Change the version in relevant files
  return gulp.src(['package.json'], {base: "./"})
      .pipe(replace('0.0.0-dev', version))
      .pipe(gulp.dest('./'));

});

gulp.task('start-neo4j', ['download-neo4j'], function() {
  if(isWin) {
    runPowershell('Install-Neo4jServer -Neo4jServer ' + neo4jHome + ' -Name neo4j-js;' +
                  'Start-Neo4jServer -Neo4jServer ' + neo4jHome + ' -ServiceName neo4j-js');
  }
  else {
    return gulp.src('').pipe(shell([
      'chmod +x ' + neo4jHome + '/bin/neo4j',
      neo4jHome + '/bin/neo4j start',
    ]));
  }
});

gulp.task('stop-neo4j', function() {
  if(isWin) {
    runPowershell('Stop-Neo4jServer -Neo4jServer ' + neo4jHome + ' -ServiceName neo4j-js;' +
                  'Uninstall-Neo4jServer -Neo4jServer ' + neo4jHome + ' -ServiceName neo4j-js');
  } else {
    return gulp.src('').pipe(shell([
      neo4jHome + '/bin/neo4j stop',
    ]));
  }
});

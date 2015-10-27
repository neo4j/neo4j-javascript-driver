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
var gunzip = require('gulp-gunzip');
var untar = require('gulp-untar2');
var shell = require('gulp-shell');
var jasmine = require('gulp-jasmine');
var jasmineBrowser = require('gulp-jasmine-browser');
var reporters = require('jasmine-reporters');
var babelify = require('babelify');
var babel = require('gulp-babel');
var watch = require('gulp-watch');
var batch = require('gulp-batch');
var fs = require("fs");
var runSequence = require('run-sequence');

gulp.task('default', ["test"]);

gulp.task('browser', function(cb){
  runSequence('build-browser-test', 'build-browser', cb);
})

/** Build all-in-one files for use in the browser */
gulp.task('build-browser', function () {
  var browserOutput = 'build/browser';
  // Our app bundler
  var appBundler = browserify({
    entries: ['lib/neo4j.js'],
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
  var browserOutput = 'build/browser';
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
    .pipe(babel({ignore: ['lib/external/**/*.js']}))
    .pipe(gulp.dest(options.dest))
}

gulp.task('nodejs', function(){
  return buildNode({
    src: 'lib/**/*.js',
    dest: 'build/node'
    });
})

gulp.task('all', function(cb){
  runSequence('nodejs', 'browser', cb);
});

gulp.task('test', function(cb){
  runSequence('test-nodejs', 'test-browser', cb);
});

gulp.task('start-neo4j', ['download-neo4j'], shell.task([
  'chmod +x build/neo4j-enterprise*/bin/neo4j',
  'build/neo4j-enterprise*/bin/neo4j start',
]));

gulp.task('stop-neo4j', shell.task([
  'build/neo4j-enterprise*/bin/neo4j stop',
]));

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
  return gulp.src('build/browser/neo4j-web.test.js')
    .pipe(jasmineBrowser.specRunner({console: true}))
    .pipe(jasmineBrowser.headless())
});

gulp.task('watch', function () {
    watch('lib/**/*.js', batch(function (events, done) {
        gulp.start('all', done);
    }));
});

gulp.task('download-neo4j', function() {
  if( !fs.existsSync('./build/neo4j-enterprise-3.0.0-alpha') ) {
    // Need to download
    return download("http://alpha.neohq.net/dist/neo4j-enterprise-3.0.0-M01-NIGHTLY-unix.tar.gz")
          .pipe(gunzip())
          .pipe(untar())
          .pipe(gulp.dest('./build'));
  }
});

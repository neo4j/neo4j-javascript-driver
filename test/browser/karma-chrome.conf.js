module.exports = function(config) {
  config.set({
    frameworks: ['jasmine'],
    basePath: '../../',
    files: ['lib/browser/neo4j-web.test.js'],
    reporters: ['spec'],
    port: 9876,  // karma web server port
    colors: true,
    logLevel: config.LOG_DEBUG,
    browsers: ['ChromeHeadless'],
    autoWatch: false,
    singleRun: true,
    concurrency: 1,
    browserNoActivityTimeout: 30 * 60 * 1000,
  })
}

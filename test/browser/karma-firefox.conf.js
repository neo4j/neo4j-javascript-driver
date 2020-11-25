/**
 * Copyright (c) 2002-2020 "Neo4j,"
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
module.exports = function (config) {
  config.set({
    basePath: '../../',
    browserify: {
      debug: true,
      transform: ['babelify', './support/inject-browser-transform']
    },
    files: [
      'src/**/!(node)/*.js',
      'test/**/!(node)/*.test.js',
      'test/!(examples).test.js'
    ],
    preprocessors: {
      'src/**/*.js': ['browserify'],
      'test/**/*.test.js': ['browserify']
    },
    frameworks: ['browserify', 'source-map-support', 'jasmine'],
    reporters: ['spec'],
    port: 9876, // karma web server port
    colors: true,
    logLevel: config.LOG_ERROR,
    browsers: ['FirefoxHeadless'],
    autoWatch: false,
    singleRun: true,
    concurrency: 1,
    browserNoActivityTimeout: 30 * 60 * 1000,
    customLaunchers: {
      FirefoxHeadless: {
        base: 'Firefox',
        flags: ['-headless'],
        prefs: {
          'network.websocket.max-connections': 256 // as in Chrome
        }
      }
    },
    client: {
      env: process.env
    }
  })
}

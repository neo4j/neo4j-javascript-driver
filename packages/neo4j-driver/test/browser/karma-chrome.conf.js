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
module.exports = function (config) {
  config.set({
    basePath: '../../',
    karmaTypescriptConfig: {
      compilerOptions: {
        target: 'ES5',
        lib: ['ES6'],
        noImplicitAny: true,
        noImplicitReturns: true,
        strictNullChecks: true,
        esModuleInterop: true,
        moduleResolution: 'node',
        downlevelIteration: true,
        allowJs: true,
        isolatedModules: true,
        types: ['jasmine']
      },
      bundlerOptions: {
        transforms: [
          require('karma-typescript-es6-transform')()
        ]
      }
    },
    preprocessors: {
      'src/**/*.js': ['karma-typescript'],
      'test/**/*.test.js': ['karma-typescript']
    },
    frameworks: ['karma-typescript', 'source-map-support', 'jasmine'],
    reporters: ['spec'],
    port: 9876, // karma web server port
    colors: true,
    logLevel: config.LOG_DEBUG,
    browsers: ['ChromeHeadless'],
    autoWatch: false,
    singleRun: true,
    concurrency: 1,
    browserNoActivityTimeout: 30 * 60 * 1000,
    client: {
      env: process.env
    }
  })
}

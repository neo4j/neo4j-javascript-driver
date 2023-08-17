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
const { TestEnvironment: NodeEnvironment } = require('jest-environment-node')
const WebSocket = require('isomorphic-ws')
const Config = require('./config')

class BrowserEnvironment extends NodeEnvironment {
  async setup () {
    await super.setup()
    this.global.WebSocket = WebSocket
    this.global.window = globalThis
    this.global.window.navigator = {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
    }
    await Config.default.startNeo4j()
    this.global.process.env = process.env
    this.global.process.env.TEST_CONTAINERS_DISABLED = 'TRUE'
  }

  async teardown () {
    await Config.default.stopNeo4j()
    this.global.process.env.TEST_CONTAINERS_DISABLED = 'FALSE'
    await super.teardown()
  }
}

module.exports = BrowserEnvironment

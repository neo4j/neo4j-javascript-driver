/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [https://neo4j.com]
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
import Neo4jContainer from './neo4j-container'

const env = process.env

const username = env.TEST_NEO4J_USER ?? 'neo4j'
const password = env.TEST_NEO4J_PASS ?? 'password'
const hostname = env.TEST_NEO4J_HOST ?? 'localhost'
const scheme = env.TEST_NEO4J_SCHEME ?? 'bolt'
const version = env.TEST_NEO4J_VERSION ?? '5'
const httpPort = env.TEST_NEO4J_HTTP_PORT ?? 7474
const boltPort = env.TEST_NEO4J_BOLT_PORT ?? 7687
const edition = env.TEST_NEO4J_EDITION ?? 'enterprise'
const testcontainersDisabled = env.TEST_CONTAINERS_DISABLED !== undefined
  ? env.TEST_CONTAINERS_DISABLED.toUpperCase() === 'TRUE'
  : false

const cluster = env.TEST_NEO4J_IS_CLUSTER === '1'

const neo4jContainer = new Neo4jContainer(username, password, version, edition, testcontainersDisabled, false)

export default {
  username,
  password,
  hostname,
  scheme,
  cluster,
  get testNonClusterSafe () {
    return cluster ? test.skip.bind(test) : test
  },
  get httpPort (): string {
    return neo4jContainer.getHttpPort(httpPort).toString()
  },
  get boltPort (): string {
    return neo4jContainer.getBoltPort(boltPort).toString()
  },
  async startNeo4j () {
    await neo4jContainer.start()
    // @ts-expect-error
    if (global.window == null) {
      process.env.TEST_NEO4J_BOLT_PORT = neo4jContainer.getBoltPort(boltPort).toString()
      process.env.TEST_NEO4J_HTTP_PORT = neo4jContainer.getHttpPort(httpPort).toString()
    }
  },
  async stopNeo4j () {
    await neo4jContainer.stop()
  }
}

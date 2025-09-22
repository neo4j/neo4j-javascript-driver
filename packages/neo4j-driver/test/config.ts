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
const env = process.env

const username = env.TEST_NEO4J_USER ?? 'neo4j'
const password = env.TEST_NEO4J_PASS ?? 'password'
const hostname = env.TEST_NEO4J_HOST ?? 'localhost'
const scheme = env.TEST_NEO4J_SCHEME ?? 'bolt'
const httpPort = env.TEST_NEO4J_HTTP_PORT ?? 7474
const boltPort = env.TEST_NEO4J_BOLT_PORT ?? 7687

const cluster = env.TEST_NEO4J_IS_CLUSTER === '1'

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
    return httpPort.toString()
  },
  get boltPort (): string {
    return boltPort.toString()
  },
  async startNeo4j () {
    process.env.TEST_NEO4J_BOLT_PORT = boltPort.toString()
    process.env.TEST_NEO4J_HTTP_PORT = httpPort.toString()
  },
  async stopNeo4j () {
  }
}

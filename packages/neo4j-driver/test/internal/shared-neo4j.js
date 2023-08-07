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
import neo4j from '../../src'
import Neo4jContainer from './neo4j-container'

const env = global.__karma__ ? global.__karma__.config.env : process.env

const username = env.TEST_NEO4J_USER || 'neo4j'
const password = env.TEST_NEO4J_PASS || 'password'
const hostname = env.TEST_NEO4J_HOST || 'localhost'
const scheme = env.TEST_NEO4J_SCHEME || 'bolt'
const version = env.TEST_NEO4J_VERSION || '5.8'
const httpPort = env.TEST_NEO4J_HTTP_PORT || 7474
const boltPort = env.TEST_NEO4J_BOLT_PORT || 7687

const testcontainersDisabled = env.TEST_CONTAINERS_DISABLED !== undefined
  ? env.TEST_CONTAINERS_DISABLED.toUpperCase() === 'TRUE'
  : false

const cluster =
  env.TEST_NEO4J_IS_CLUSTER !== undefined
    ? env.TEST_NEO4J_IS_CLUSTER === '1'
    : false
const edition = env.TEST_NEO4J_EDITION || 'enterprise'
const ipv6Enabled =
  env.TEST_NEO4J_IPV6_ENABLED !== undefined
    ? env.TEST_NEO4J_IPV6_ENABLED.toUpperCase() === 'TRUE'
    : true
const authToken = neo4j.auth.basic(username, password)

const neo4jContainer = new Neo4jContainer({
  user: username,
  password,
  containerLogs: false,
  version,
  edition,
  disabled: testcontainersDisabled
})

async function start () {
  await neo4jContainer.start()
  if (global.process) {
    global.process.env.TEST_NEO4J_BOLT_PORT = neo4jContainer.getBoltPort(boltPort)
    global.process.env.TEST_NEO4J_HTTP_PORT = neo4jContainer.getHttpPort(httpPort)
  }
}

async function stop () {
  await neo4jContainer.stop()
}

async function restart (configOverride) {
  await stop()
  await start()
}

async function cleanupAndGetProtocolVersionAndBookmarks (driver) {
  const session = driver.session({ defaultAccessMode: neo4j.session.WRITE })
  try {
    const result = await session.writeTransaction(tx =>
      tx.run('MATCH (n) DETACH DELETE n')
    )
    return [result.summary.server.protocolVersion, session.lastBookmarks()]
  } finally {
    await session.close()
  }
}

async function cleanupAndGetProtocolVersion (driver) {
  const [protocolVersion] = await cleanupAndGetProtocolVersionAndBookmarks(
    driver
  )
  return protocolVersion
}

async function getEdition (driver) {
  const session = driver.session({ defaultAccessMode: neo4j.session.READ })
  try {
    const result = await session.readTransaction(tx =>
      tx.run('CALL dbms.components() YIELD edition')
    )
    const singleRecord = result.records[0]
    return singleRecord.get(0)
  } finally {
    await session.close()
  }
}

const debugLogging = {
  level: 'debug',
  logger: (level, message) => console.warn(`${level}: ${message}`)
}

export default {
  start: start,
  stop: stop,
  restart: restart,
  username: username,
  password: password,
  authToken: authToken,
  logging: debugLogging,
  cleanupAndGetProtocolVersion: cleanupAndGetProtocolVersion,
  cleanupAndGetProtocolVersionAndBookmarks,
  getEdition: getEdition,
  hostname: hostname,
  get hostnameWithBoltPort () {
    return `${hostname}:${neo4jContainer.getBoltPort(boltPort)}`
  },
  get hostnameWithHttpPort () {
    return `${hostname}:${neo4jContainer.getHttpPort(httpPort)}`
  },
  get boltPort () {
    return neo4jContainer.getBoltPort(boltPort)
  },
  get httpPort () {
    return neo4jContainer.getHttpPort(httpPort)
  },
  isTestContainer: true,
  ipv6Enabled: ipv6Enabled,
  edition: edition,
  scheme: scheme,
  cluster: cluster
}

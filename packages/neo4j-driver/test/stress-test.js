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

import neo4j from '../src'
import { READ, WRITE } from '../src/driver'
import parallelLimit from 'async/parallelLimit'
import _ from 'lodash'
import sharedNeo4j from './internal/shared-neo4j'

const TEST_MODES = {
  fastest: {
    commandsCount: 10000,
    parallelism: 24
  },
  fast: {
    commandsCount: 5000,
    parallelism: 8
  },
  extended: {
    commandsCount: 2000000,
    parallelism: 16
  }
}

const READ_QUERY = 'MATCH (n) RETURN n LIMIT 1'
const WRITE_QUERY =
  'CREATE (person:Person:Employee {name: $name, salary: $salary}) RETURN person'

const TEST_MODE = modeFromEnvOrDefault('STRESS_TEST_MODE')
const DATABASE_URI = fromEnvOrDefault(
  'STRESS_TEST_DATABASE_URI',
  `${sharedNeo4j.scheme}://${sharedNeo4j.hostname}:${sharedNeo4j.port}`
)

const RUNNING_TIME_IN_SECONDS = parseInt(
  fromEnvOrDefault('RUNNING_TIME_IN_SECONDS', 0)
)

export default async function execute () {
  const USERNAME = fromEnvOrDefault(
    'NEO4J_USERNAME',
    sharedNeo4j.authToken.principal
  )
  const PASSWORD = fromEnvOrDefault(
    'NEO4J_PASSWORD',
    sharedNeo4j.authToken.credentials
  )

  const LOGGING_ENABLED = fromEnvOrDefault('STRESS_TEST_LOGGING_ENABLED', false)

  const config = {
    logging: neo4j.logging.console(LOGGING_ENABLED ? 'debug' : 'info')
  }

  if (isSslSchemeNotSet(DATABASE_URI)) {
    config.encrypted = isRemoteCluster()
  }

  const driver = neo4j.driver(
    DATABASE_URI,
    neo4j.auth.basic(USERNAME, PASSWORD),
    config
  )
  const [
    protocolVersion,
    bookmarks
  ] = await sharedNeo4j.cleanupAndGetProtocolVersionAndBookmark(driver)
  console.time('Basic-stress-test')
  const printStats = () => {
    console.timeEnd('Basic-stress-test')

    console.log('Read statistics: ', context.readServersWithQueryCount)
    console.log('Write statistics: ', context.writeServersWithQueryCount)
  }

  const context = new Context(
    driver,
    LOGGING_ENABLED,
    protocolVersion,
    bookmarks
  )

  try {
    await runWhileNotTimeout(async () => {
      const commands = createCommands(context)
      await parallelLimit(commands, TEST_MODE.parallelism)
      await verifyServers(context)
      verifyCommandsRun(context)
      await verifyNodeCount(context)
    }, RUNNING_TIME_IN_SECONDS)
  } catch (error) {
    context.error = error
  } finally {
    printStats()
    await closeDriver(driver)
    if (context.error) {
      console.error(context.error)
      process.exit(1)
    }
  }
}

function closeDriver (driver) {
  return driver.close().catch(error => {
    console.error('Could not close the connection', error)
    return error
  })
}

async function runWhileNotTimeout (asyncFunc, timeoutInSeconds) {
  let shoulKeepRunning = () => true
  setTimeout(() => {
    shoulKeepRunning = () => false
  }, timeoutInSeconds * 1000)
  do {
    await asyncFunc()
  } while (shoulKeepRunning())
}

function isRemoteCluster () {
  return fromEnvOrDefault('STRESS_TEST_DATABASE_URI') !== undefined
}

function isSslSchemeNotSet (uri) {
  function extractScheme (scheme) {
    if (scheme) {
      scheme = scheme.trim()
      if (scheme.charAt(scheme.length - 1) === ':') {
        scheme = scheme.substring(0, scheme.length - 1)
      }
      return scheme
    }
    return null
  }
  const scheme = extractScheme(uri)
  return scheme === null || scheme === 'bolt' || scheme === 'neo4j'
}

function isCluster () {
  return sharedNeo4j.cluster || isRemoteCluster()
}

function createCommands (context) {
  const uniqueCommands = createUniqueCommands(context)

  const commands = []
  for (let i = 0; i < TEST_MODE.commandsCount; i++) {
    const randomCommand = _.sample(uniqueCommands)
    commands.push(randomCommand)
  }

  context.expectedCommandsRun += TEST_MODE.commandsCount
  console.log(`Generated ${TEST_MODE.commandsCount} commands`)

  return commands
}

function createUniqueCommands (context) {
  const clusterSafeCommands = [
    readQueryInTxFunctionCommand(context),
    readQueryInTxFunctionWithBookmarkCommand(context),
    writeQueryInTxFunctionWithBookmarkCommand(context),
    writeQueryInTxFunctionCommand(context)
  ]

  if (isCluster()) {
    return clusterSafeCommands
  }

  return [
    ...clusterSafeCommands,
    readQueryCommand(context),
    readQueryWithBookmarkCommand(context),
    readQueryInTxCommand(context),
    readQueryInTxWithBookmarkCommand(context),
    writeQueryCommand(context),
    writeQueryWithBookmarkCommand(context),
    writeQueryInTxCommand(context),
    writeQueryInTxWithBookmarkCommand(context)
  ]
}

function readQueryCommand (context) {
  return queryCommand(context, READ_QUERY, () => noParams(), READ, false)
}

function readQueryWithBookmarkCommand (context) {
  return queryCommand(context, READ_QUERY, () => noParams(), READ, true)
}

function readQueryInTxCommand (context) {
  return queryInTxCommand(context, READ_QUERY, () => noParams(), READ, false)
}

function readQueryInTxFunctionCommand (context) {
  return queryInTxFunctionCommand(
    context,
    READ_QUERY,
    () => noParams(),
    READ,
    false
  )
}

function readQueryInTxWithBookmarkCommand (context) {
  return queryInTxCommand(context, READ_QUERY, () => noParams(), READ, true)
}

function readQueryInTxFunctionWithBookmarkCommand (context) {
  return queryInTxFunctionCommand(
    context,
    READ_QUERY,
    () => noParams(),
    READ,
    true
  )
}

function writeQueryCommand (context) {
  return queryCommand(context, WRITE_QUERY, () => randomParams(), WRITE, false)
}

function writeQueryWithBookmarkCommand (context) {
  return queryCommand(context, WRITE_QUERY, () => randomParams(), WRITE, true)
}

function writeQueryInTxCommand (context) {
  return queryInTxCommand(
    context,
    WRITE_QUERY,
    () => randomParams(),
    WRITE,
    false
  )
}

function writeQueryInTxFunctionCommand (context) {
  return queryInTxFunctionCommand(
    context,
    WRITE_QUERY,
    () => randomParams(),
    WRITE,
    false
  )
}

function writeQueryInTxWithBookmarkCommand (context) {
  return queryInTxCommand(
    context,
    WRITE_QUERY,
    () => randomParams(),
    WRITE,
    true
  )
}

function writeQueryInTxFunctionWithBookmarkCommand (context) {
  return queryInTxFunctionCommand(
    context,
    WRITE_QUERY,
    () => randomParams(),
    WRITE,
    true
  )
}

function queryCommand (context, query, paramsSupplier, accessMode, useBookmark) {
  return callback => {
    const commandId = context.nextCommandId()
    if (isCluster()) {
      console.log(
        'SKIPPED: session.run is not safe to in clusters environments'
      )
      callback()
      return
    }
    const session = newSession(context, accessMode, useBookmark)
    const params = paramsSupplier()

    context.log(commandId, `About to run ${accessMode} query`)

    session
      .run(query, params)
      .then(result => {
        context.queryCompleted(result, accessMode)
        context.log(commandId, 'Query completed successfully')

        return session.close().then(() => {
          const possibleError = verifyQueryResult(result, context)
          callback(possibleError)
        })
      })
      .catch(error => {
        context.log(
          commandId,
          `Query failed with error ${JSON.stringify(error)}`
        )
        callback(error)
      })
  }
}

function queryInTxFunctionCommand (
  context,
  query,
  paramsSupplier,
  accessMode,
  useBookmark
) {
  return callback => {
    const commandId = context.nextCommandId()
    const params = paramsSupplier()
    const session = newSession(context, accessMode, useBookmark)

    context.log(commandId, `About to run ${accessMode} query in TX function`)

    let resultPromise
    if (accessMode === READ) {
      resultPromise = session.readTransaction(tx => tx.run(query, params))
    } else {
      resultPromise = session.writeTransaction(tx => tx.run(query, params))
    }

    resultPromise
      .then(result => {
        context.queryCompleted(result, accessMode, session.lastBookmark())
        context.log(commandId, 'Transaction function executed successfully')

        return session
          .close()
          .then(() => {
            const possibleError = verifyQueryResult(result, context)
            callback(possibleError)
          })
          .catch(error => {
            context.log(
              commandId,
              `Error closing the session ${JSON.stringify(error)}`
            )
            callback(error)
          })
      })
      .catch(error => {
        context.log(
          commandId,
          `Transaction function failed with error ${JSON.stringify(error)}`
        )
        callback(error)
      })
  }
}

function queryInTxCommand (
  context,
  query,
  paramsSupplier,
  accessMode,
  useBookmark
) {
  return callback => {
    const commandId = context.nextCommandId()
    if (isCluster()) {
      console.log(
        'SKIPPED: session.begintTransaction is not safe to in clusters environments'
      )
      callback()
      return
    }
    const session = newSession(context, accessMode, useBookmark)
    const tx = session.beginTransaction()
    const params = paramsSupplier()

    context.log(commandId, `About to run ${accessMode} query in TX`)

    tx.run(query, params)
      .then(result => {
        let commandError = verifyQueryResult(result, context)

        tx.commit()
          .catch(commitError => {
            context.log(
              commandId,
              `Transaction commit failed with error ${JSON.stringify(
                commitError
              )}`
            )
            if (!commandError) {
              commandError = commitError
            }
          })
          .then(() => {
            context.queryCompleted(result, accessMode, session.lastBookmark())
            context.log(commandId, 'Transaction committed successfully')

            return session.close().then(() => {
              callback(commandError)
            })
          })
      })
      .catch(error => {
        context.log(
          commandId,
          `Query failed with error ${JSON.stringify(error)}`
        )
        callback(error)
      })
  }
}

function verifyQueryResult (result, context) {
  if (!result) {
    return new Error('Received undefined result')
  } else if (
    result.records.length === 0 &&
    context.writeCommandsRun < TEST_MODE.parallelism
  ) {
    // it is ok to receive no nodes back for read queries at the beginning of the test
    return null
  } else if (result.records.length === 1) {
    const record = result.records[0]
    return verifyRecord(record)
  } else {
    return new Error(
      `Unexpected amount of records received: ${JSON.stringify(result)}`
    )
  }
}

function verifyRecord (record) {
  const node = record.get(0)

  if (!arraysEqual(['Person', 'Employee'], node.labels)) {
    return new Error(`Unexpected labels in node: ${JSON.stringify(node)}`)
  }

  const propertyKeys = _.keys(node.properties)
  if (
    !_.isEmpty(propertyKeys) &&
    !arraysEqual(['name', 'salary'], propertyKeys)
  ) {
    return new Error(
      `Unexpected property keys in node: ${JSON.stringify(node)}`
    )
  }

  return null
}

function verifyCommandsRun (context) {
  if (context.commandsRun !== context.expectedCommandsRun) {
    throw new Error(
      `Unexpected commands run: ${context.commandsRun}, expected: ${context.expectedCommandsRun}`
    )
  }
}

function verifyNodeCount (context) {
  const expectedNodeCount = context.createdNodesCount

  const session = context.driver.session()
  return session
    .writeTransaction(tx => tx.run('MATCH (n) RETURN count(n)'))
    .then(result => {
      const record = result.records[0]
      const count = record.get(0).toNumber()

      if (count !== expectedNodeCount) {
        throw new Error(
          `Unexpected node count: ${count}, expected: ${expectedNodeCount}`
        )
      }
    })
}

function verifyServers (context) {
  const routing = DATABASE_URI.indexOf('neo4j') === 0

  if (routing && isCluster()) {
    return Promise.resolve()
  }

  return verifySingleInstance(context)
}

function verifySingleInstance (context) {
  return new Promise(resolve => {
    const readServerAddresses = context.readServerAddresses()
    const writeServerAddresses = context.writeServerAddresses()

    if (readServerAddresses.length !== 1) {
      throw Error(
        `Expect readServerAddresses.length to be 1 but it is ${readServerAddresses.length}`
      )
    }
    if (writeServerAddresses.length !== 1) {
      throw Error(
        `Expect writeServerAddresses.length to be 1 but it is ${writeServerAddresses.length}`
      )
    }
    if (!arraysEqual(readServerAddresses, writeServerAddresses)) {
      throw Error(
        `Expect readServerAddresses (${JSON.stringify(
          readServerAddresses
        )}) to be equal to writeServerAddresses (${JSON.stringify(
          writeServerAddresses
        )}).`
      )
    }

    const address = readServerAddresses[0]
    if (context.readServersWithQueryCount[address] <= 1) {
      throw Error(
        `Expect context.readServersWithQueryCount[address] to be greater then 1, but it is ${context.readServersWithQueryCount[address]}`
      )
    }
    if (context.writeServersWithQueryCount[address] <= 1) {
      throw Error(
        `Expect context.writeServersWithQueryCount[address] to be greater then 1, but it is ${context.writeServersWithQueryCount[address]}`
      )
    }

    resolve()
  })
}

function randomParams () {
  return {
    name: `Person-${Date.now()}`,
    salary: Date.now()
  }
}

function noParams () {
  return {}
}

function newSession (context, accessMode, useBookmark) {
  if (useBookmark || isCluster()) {
    return context.driver.session({
      defaultAccessMode: accessMode,
      bookmarks: context.bookmark
    })
  }
  return context.driver.session({ defaultAccessMode: accessMode })
}

function modeFromEnvOrDefault (envVariableName) {
  const modeName = fromEnvOrDefault(envVariableName, 'fast')
  const mode = TEST_MODES[modeName]
  if (!mode) {
    throw new Error(`Unknown test mode: ${modeName}`)
  }
  console.log(`Selected '${modeName}' mode for the stress test`)
  return mode
}

function fromEnvOrDefault (envVariableName, defaultValue = undefined) {
  if (process && process.env && process.env[envVariableName]) {
    return process.env[envVariableName]
  }
  return defaultValue
}

function arraysEqual (array1, array2) {
  return _.difference(array1, array2).length === 0
}

class Context {
  constructor (driver, loggingEnabled, protocolVersion, bookmark) {
    this.driver = driver
    this.bookmark = bookmark
    this.createdNodesCount = 0
    this._commandIdCouter = 0
    this._loggingEnabled = loggingEnabled
    this.readServersWithQueryCount = {}
    this.writeServersWithQueryCount = {}
    this.protocolVersion = protocolVersion
    this.expectedCommandsRun = 0
  }

  get commandsRun () {
    return [
      ...Object.values(this.readServersWithQueryCount),
      ...Object.values(this.writeServersWithQueryCount)
    ].reduce((a, b) => a + b, 0)
  }

  get writeCommandsRun () {
    return [...Object.values(this.writeServersWithQueryCount)].reduce(
      (a, b) => a + b,
      0
    )
  }

  queryCompleted (result, accessMode, bookmark) {
    const serverInfo = result.summary.server
    this.protocolVersion = serverInfo.protocolVersion

    const serverAddress = serverInfo.address
    if (accessMode === WRITE) {
      this.createdNodesCount++
      this.writeServersWithQueryCount[serverAddress] =
        (this.writeServersWithQueryCount[serverAddress] || 0) + 1
    } else {
      this.readServersWithQueryCount[serverAddress] =
        (this.readServersWithQueryCount[serverAddress] || 0) + 1
    }

    if (bookmark) {
      this.bookmark = bookmark
    }
  }

  nextCommandId () {
    return this._commandIdCouter++
  }

  readServerAddresses () {
    return Object.keys(this.readServersWithQueryCount)
  }

  writeServerAddresses () {
    return Object.keys(this.writeServersWithQueryCount)
  }

  log (commandId, message) {
    if (this._loggingEnabled) {
      console.log(`Command [${commandId}]: ${message}`)
    }
  }
}

module.exports = execute

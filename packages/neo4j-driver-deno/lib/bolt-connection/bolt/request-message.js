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

import { int, internal, json } from '../../core/index.ts'

const {
  constants: { ACCESS_MODE_READ, FETCH_ALL },
  util: { assertString }
} = internal

/* eslint-disable no-unused-vars */
// Signature bytes for each request message type
const INIT = 0x01 // 0000 0001 // INIT <user_agent> <authentication_token>
const ACK_FAILURE = 0x0e // 0000 1110 // ACK_FAILURE - unused
const RESET = 0x0f // 0000 1111 // RESET
const RUN = 0x10 // 0001 0000 // RUN <query> <parameters>
const DISCARD_ALL = 0x2f // 0010 1111 // DISCARD_ALL - unused
const PULL_ALL = 0x3f // 0011 1111 // PULL_ALL

const HELLO = 0x01 // 0000 0001 // HELLO <metadata>
const GOODBYE = 0x02 // 0000 0010 // GOODBYE
const BEGIN = 0x11 // 0001 0001 // BEGIN <metadata>
const COMMIT = 0x12 // 0001 0010 // COMMIT
const ROLLBACK = 0x13 // 0001 0011 // ROLLBACK
const ROUTE = 0x66 // 0110 0110 // ROUTE

const LOGON = 0x6A // LOGON
const LOGOFF = 0x6B // LOGOFF

const DISCARD = 0x2f // 0010 1111 // DISCARD
const PULL = 0x3f // 0011 1111 // PULL

const READ_MODE = 'r'
/* eslint-enable no-unused-vars */

const NO_STATEMENT_ID = -1

const SIGNATURES = Object.freeze({
  INIT,
  RESET,
  RUN,
  PULL_ALL,
  HELLO,
  GOODBYE,
  BEGIN,
  COMMIT,
  ROLLBACK,
  ROUTE,
  LOGON,
  LOGOFF,
  DISCARD,
  PULL
})

export default class RequestMessage {
  constructor (signature, fields, toString) {
    this.signature = signature
    this.fields = fields
    this.toString = toString
  }

  /**
   * Create a new INIT message.
   * @param {string} clientName the client name.
   * @param {Object} authToken the authentication token.
   * @return {RequestMessage} new INIT message.
   */
  static init (clientName, authToken) {
    return new RequestMessage(
      INIT,
      [clientName, authToken],
      () => `INIT ${clientName} {...}`
    )
  }

  /**
   * Create a new RUN message.
   * @param {string} query the cypher query.
   * @param {Object} parameters the query parameters.
   * @return {RequestMessage} new RUN message.
   */
  static run (query, parameters) {
    return new RequestMessage(
      RUN,
      [query, parameters],
      () => `RUN ${query} ${json.stringify(parameters)}`
    )
  }

  /**
   * Get a PULL_ALL message.
   * @return {RequestMessage} the PULL_ALL message.
   */
  static pullAll () {
    return PULL_ALL_MESSAGE
  }

  /**
   * Get a RESET message.
   * @return {RequestMessage} the RESET message.
   */
  static reset () {
    return RESET_MESSAGE
  }

  /**
   * Create a new HELLO message.
   * @param {string} userAgent the user agent.
   * @param {Object} authToken the authentication token.
   * @param {Object} optional server side routing, set to routing context to turn on server side routing (> 4.1)
   * @return {RequestMessage} new HELLO message.
   */
  static hello (userAgent, authToken, routing = null, patchs = null) {
    const metadata = Object.assign({ user_agent: userAgent }, authToken)
    if (routing) {
      metadata.routing = routing
    }
    if (patchs) {
      metadata.patch_bolt = patchs
    }
    return new RequestMessage(
      HELLO,
      [metadata],
      () => `HELLO {user_agent: '${userAgent}', ...}`
    )
  }

  /**
   * Create a new HELLO message.
   * @param {string} userAgent the user agent.
   * @param {Object} optional server side routing, set to routing context to turn on server side routing (> 4.1)
   * @return {RequestMessage} new HELLO message.
   */
  static hello5x1 (userAgent, routing = null) {
    const metadata = { user_agent: userAgent }
    if (routing) {
      metadata.routing = routing
    }

    return new RequestMessage(
      HELLO,
      [metadata],
      () => `HELLO {user_agent: '${userAgent}', ...}`
    )
  }

  /**
   * Create a new LOGON message.
   *
   * @param {object} authToken The auth token
   * @returns {RequestMessage} new LOGON message
   */
  static logon (authToken) {
    return new RequestMessage(
      LOGON,
      [authToken],
      () => 'LOGON { ... }'
    )
  }

  /**
   * Create a new LOGOFF message.
   *
   * @returns {RequestMessage} new LOGOFF message
   */
  static logoff () {
    return new RequestMessage(
      LOGOFF,
      [],
      () => 'LOGOFF'
    )
  }

  /**
   * Create a new BEGIN message.
   * @param {Bookmarks} bookmarks the bookmarks.
   * @param {TxConfig} txConfig the configuration.
   * @param {string} database the database name.
   * @param {string} mode the access mode.
   * @param {string} impersonatedUser the impersonated user.
   * @return {RequestMessage} new BEGIN message.
   */
  static begin ({ bookmarks, txConfig, database, mode, impersonatedUser } = {}) {
    const metadata = buildTxMetadata(bookmarks, txConfig, database, mode, impersonatedUser)
    return new RequestMessage(
      BEGIN,
      [metadata],
      () => `BEGIN ${json.stringify(metadata)}`
    )
  }

  /**
   * Get a COMMIT message.
   * @return {RequestMessage} the COMMIT message.
   */
  static commit () {
    return COMMIT_MESSAGE
  }

  /**
   * Get a ROLLBACK message.
   * @return {RequestMessage} the ROLLBACK message.
   */
  static rollback () {
    return ROLLBACK_MESSAGE
  }

  /**
   * Create a new RUN message with additional metadata.
   * @param {string} query the cypher query.
   * @param {Object} parameters the query parameters.
   * @param {Bookmarks} bookmarks the bookmarks.
   * @param {TxConfig} txConfig the configuration.
   * @param {string} database the database name.
   * @param {string} mode the access mode.
   * @param {string} impersonatedUser the impersonated user.
   * @return {RequestMessage} new RUN message with additional metadata.
   */
  static runWithMetadata (
    query,
    parameters,
    { bookmarks, txConfig, database, mode, impersonatedUser } = {}
  ) {
    const metadata = buildTxMetadata(bookmarks, txConfig, database, mode, impersonatedUser)
    return new RequestMessage(
      RUN,
      [query, parameters, metadata],
      () =>
        `RUN ${query} ${json.stringify(parameters)} ${json.stringify(metadata)}`
    )
  }

  /**
   * Get a GOODBYE message.
   * @return {RequestMessage} the GOODBYE message.
   */
  static goodbye () {
    return GOODBYE_MESSAGE
  }

  /**
   * Generates a new PULL message with additional metadata.
   * @param {Integer|number} stmtId
   * @param {Integer|number} n
   * @return {RequestMessage} the PULL message.
   */
  static pull ({ stmtId = NO_STATEMENT_ID, n = FETCH_ALL } = {}) {
    const metadata = buildStreamMetadata(
      stmtId === null || stmtId === undefined ? NO_STATEMENT_ID : stmtId,
      n || FETCH_ALL
    )
    return new RequestMessage(
      PULL,
      [metadata],
      () => `PULL ${json.stringify(metadata)}`
    )
  }

  /**
   * Generates a new DISCARD message with additional metadata.
   * @param {Integer|number} stmtId
   * @param {Integer|number} n
   * @return {RequestMessage} the PULL message.
   */
  static discard ({ stmtId = NO_STATEMENT_ID, n = FETCH_ALL } = {}) {
    const metadata = buildStreamMetadata(
      stmtId === null || stmtId === undefined ? NO_STATEMENT_ID : stmtId,
      n || FETCH_ALL
    )
    return new RequestMessage(
      DISCARD,
      [metadata],
      () => `DISCARD ${json.stringify(metadata)}`
    )
  }

  /**
   * Generate the ROUTE message, this message is used to fetch the routing table from the server
   *
   * @param {object} routingContext The routing context used to define the routing table. Multi-datacenter deployments is one of its use cases
   * @param {string[]} bookmarks The list of the bookmarks should be used
   * @param {string} databaseName The name of the database to get the routing table for.
   * @return {RequestMessage} the ROUTE message.
   */
  static route (routingContext = {}, bookmarks = [], databaseName = null) {
    return new RequestMessage(
      ROUTE,
      [routingContext, bookmarks, databaseName],
      () =>
        `ROUTE ${json.stringify(routingContext)} ${json.stringify(
          bookmarks
        )} ${databaseName}`
    )
  }

  /**
   * Generate the ROUTE message, this message is used to fetch the routing table from the server
   *
   * @param {object} routingContext The routing context used to define the routing table. Multi-datacenter deployments is one of its use cases
   * @param {string[]} bookmarks The list of the bookmarks should be used
   * @param {object} databaseContext The context inforamtion of the database to get the routing table for.
   * @param {string} databaseContext.databaseName The name of the database to get the routing table.
   * @param {string} databaseContext.impersonatedUser The name of the user to impersonation when getting the routing table.
   * @return {RequestMessage} the ROUTE message.
   */
  static routeV4x4 (routingContext = {}, bookmarks = [], databaseContext = {}) {
    const dbContext = {}

    if (databaseContext.databaseName) {
      dbContext.db = databaseContext.databaseName
    }

    if (databaseContext.impersonatedUser) {
      dbContext.imp_user = databaseContext.impersonatedUser
    }

    return new RequestMessage(
      ROUTE,
      [routingContext, bookmarks, dbContext],
      () =>
        `ROUTE ${json.stringify(routingContext)} ${json.stringify(
          bookmarks
        )} ${json.stringify(dbContext)}`
    )
  }
}

/**
 * Create an object that represent transaction metadata.
 * @param {Bookmarks} bookmarks the bookmarks.
 * @param {TxConfig} txConfig the configuration.
 * @param {string} database the database name.
 * @param {string} mode the access mode.
 * @param {string} impersonatedUser the impersonated user mode.
 * @return {Object} a metadata object.
 */
function buildTxMetadata (bookmarks, txConfig, database, mode, impersonatedUser) {
  const metadata = {}
  if (!bookmarks.isEmpty()) {
    metadata.bookmarks = bookmarks.values()
  }
  if (txConfig.timeout !== null) {
    metadata.tx_timeout = txConfig.timeout
  }
  if (txConfig.metadata) {
    metadata.tx_metadata = txConfig.metadata
  }
  if (database) {
    metadata.db = assertString(database, 'database')
  }
  if (impersonatedUser) {
    metadata.imp_user = assertString(impersonatedUser, 'impersonatedUser')
  }
  if (mode === ACCESS_MODE_READ) {
    metadata.mode = READ_MODE
  }
  return metadata
}

/**
 * Create an object that represents streaming metadata.
 * @param {Integer|number} stmtId The query id to stream its results.
 * @param {Integer|number} n The number of records to stream.
 * @returns {Object} a metadata object.
 */
function buildStreamMetadata (stmtId, n) {
  const metadata = { n: int(n) }
  if (stmtId !== NO_STATEMENT_ID) {
    metadata.qid = int(stmtId)
  }
  return metadata
}

// constants for messages that never change
const PULL_ALL_MESSAGE = new RequestMessage(PULL_ALL, [], () => 'PULL_ALL')
const RESET_MESSAGE = new RequestMessage(RESET, [], () => 'RESET')
const COMMIT_MESSAGE = new RequestMessage(COMMIT, [], () => 'COMMIT')
const ROLLBACK_MESSAGE = new RequestMessage(ROLLBACK, [], () => 'ROLLBACK')
const GOODBYE_MESSAGE = new RequestMessage(GOODBYE, [], () => 'GOODBYE')

export {
  SIGNATURES
}

/**
 * Copyright (c) 2002-2019 "Neo4j,"
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

import { ACCESS_MODE_READ } from './constants'
import { int } from '../integer'
import { assertString } from './util'

/* eslint-disable no-unused-vars */
// Signature bytes for each request message type
const INIT = 0x01 // 0000 0001 // INIT <user_agent> <authentication_token>
const ACK_FAILURE = 0x0e // 0000 1110 // ACK_FAILURE - unused
const RESET = 0x0f // 0000 1111 // RESET
const RUN = 0x10 // 0001 0000 // RUN <statement> <parameters>
const DISCARD_ALL = 0x2f // 0010 1111 // DISCARD_ALL - unused
const PULL_ALL = 0x3f // 0011 1111 // PULL_ALL

const HELLO = 0x01 // 0000 0001 // HELLO <metadata>
const GOODBYE = 0x02 // 0000 0010 // GOODBYE
const BEGIN = 0x11 // 0001 0001 // BEGIN <metadata>
const COMMIT = 0x12 // 0001 0010 // COMMIT
const ROLLBACK = 0x13 // 0001 0011 // ROLLBACK

const DISCARD = 0x2f // 0010 1111 // DISCARD
const PULL = 0x3f // 0011 1111 // PULL

const READ_MODE = 'r'
/* eslint-enable no-unused-vars */

const NO_STATEMENT_ID = -1
const ALL = -1

export default class RequestMessage {
  constructor (signature, fields, toString) {
    this.signature = signature
    this.fields = fields
    this.toString = toString
  }

  /**
   * Create a new INIT message.
   * @param {string} clientName the client name.
   * @param {object} authToken the authentication token.
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
   * @param {string} statement the cypher statement.
   * @param {object} parameters the statement parameters.
   * @return {RequestMessage} new RUN message.
   */
  static run (statement, parameters) {
    return new RequestMessage(
      RUN,
      [statement, parameters],
      () => `RUN ${statement} ${JSON.stringify(parameters)}`
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
   * @param {object} authToken the authentication token.
   * @return {RequestMessage} new HELLO message.
   */
  static hello (userAgent, authToken) {
    const metadata = Object.assign({ user_agent: userAgent }, authToken)
    return new RequestMessage(
      HELLO,
      [metadata],
      () => `HELLO {user_agent: '${userAgent}', ...}`
    )
  }

  /**
   * Create a new BEGIN message.
   * @param {Bookmark} bookmark the bookmark.
   * @param {TxConfig} txConfig the configuration.
   * @param {string} db the database name.
   * @param {string} mode the access mode.
   * @return {RequestMessage} new BEGIN message.
   */
  static begin ({ bookmark, txConfig, db, mode } = {}) {
    const metadata = buildTxMetadata(bookmark, txConfig, db, mode)
    return new RequestMessage(
      BEGIN,
      [metadata],
      () => `BEGIN ${JSON.stringify(metadata)}`
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
   * @param {string} statement the cypher statement.
   * @param {object} parameters the statement parameters.
   * @param {Bookmark} bookmark the bookmark.
   * @param {TxConfig} txConfig the configuration.
   * @param {string} db the database name.
   * @param {string} mode the access mode.
   * @return {RequestMessage} new RUN message with additional metadata.
   */
  static runWithMetadata (
    statement,
    parameters,
    { bookmark, txConfig, db, mode } = {}
  ) {
    const metadata = buildTxMetadata(bookmark, txConfig, db, mode)
    return new RequestMessage(
      RUN,
      [statement, parameters, metadata],
      () =>
        `RUN ${statement} ${JSON.stringify(parameters)} ${JSON.stringify(
          metadata
        )}`
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
  static pull ({ stmtId = NO_STATEMENT_ID, n = ALL } = {}) {
    const metadata = buildStreamMetadata(stmtId, n)
    return new RequestMessage(
      PULL,
      [metadata],
      () => `PULL ${JSON.stringify(metadata)}`
    )
  }

  /**
   * Generates a new DISCARD message with additional metadata.
   * @param {Integer|number} stmtId
   * @param {Integer|number} n
   * @return {RequestMessage} the PULL message.
   */
  static discard ({ stmtId = NO_STATEMENT_ID, n = ALL } = {}) {
    const metadata = buildStreamMetadata(stmtId, n)
    return new RequestMessage(
      DISCARD,
      [metadata],
      () => `DISCARD ${JSON.stringify(metadata)}`
    )
  }
}

/**
 * Create an object that represent transaction metadata.
 * @param {Bookmark} bookmark the bookmark.
 * @param {TxConfig} txConfig the configuration.
 * @param {string} db the database name.
 * @param {string} mode the access mode.
 * @return {object} a metadata object.
 */
function buildTxMetadata (bookmark, txConfig, db, mode) {
  const metadata = {}
  if (!bookmark.isEmpty()) {
    metadata['bookmarks'] = bookmark.values()
  }
  if (txConfig.timeout) {
    metadata['tx_timeout'] = txConfig.timeout
  }
  if (txConfig.metadata) {
    metadata['tx_metadata'] = txConfig.metadata
  }
  if (db) {
    metadata['db'] = assertString(db, 'db')
  }
  if (mode === ACCESS_MODE_READ) {
    metadata['mode'] = READ_MODE
  }
  return metadata
}

/**
 * Create an object that represents streaming metadata.
 * @param {Integer|number} stmtId The statement id to stream its results.
 * @param {Integer|number} n The number of records to stream.
 * @returns {object} a metadata object.
 */
function buildStreamMetadata (stmtId, n) {
  const metadata = { n: int(n) }
  if (stmtId !== NO_STATEMENT_ID) {
    metadata['stmt_id'] = int(stmtId)
  }
  return metadata
}

// constants for messages that never change
const PULL_ALL_MESSAGE = new RequestMessage(PULL_ALL, [], () => 'PULL_ALL')
const RESET_MESSAGE = new RequestMessage(RESET, [], () => 'RESET')
const COMMIT_MESSAGE = new RequestMessage(COMMIT, [], () => 'COMMIT')
const ROLLBACK_MESSAGE = new RequestMessage(ROLLBACK, [], () => 'ROLLBACK')
const GOODBYE_MESSAGE = new RequestMessage(GOODBYE, [], () => 'GOODBYE')

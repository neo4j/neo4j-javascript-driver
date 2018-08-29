/**
 * Copyright (c) 2002-2018 "Neo4j,"
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

// Signature bytes for each request message type
const INIT = 0x01;            // 0000 0001 // INIT <user_agent> <authentication_token>
const ACK_FAILURE = 0x0E;     // 0000 1110 // ACK_FAILURE - unused
const RESET = 0x0F;           // 0000 1111 // RESET
const RUN = 0x10;             // 0001 0000 // RUN <statement> <parameters>
const DISCARD_ALL = 0x2F;     // 0010 1111 // DISCARD_ALL - unused
const PULL_ALL = 0x3F;        // 0011 1111 // PULL_ALL

const HELLO = 0x01;           // 0000 0001 // HELLO <metadata>
const BEGIN = 0x11;           // 0001 0001 // BEGIN <metadata>
const COMMIT = 0x12;          // 0001 0010 // COMMIT
const ROLLBACK = 0x13;        // 0001 0011 // ROLLBACK

export default class RequestMessage {

  constructor(signature, fields, toString) {
    this.signature = signature;
    this.fields = fields;
    this.toString = toString;
  }

  /**
   * Create a new INIT message.
   * @param {string} clientName the client name.
   * @param {object} authToken the authentication token.
   * @return {RequestMessage} new INIT message.
   */
  static init(clientName, authToken) {
    return new RequestMessage(INIT, [clientName, authToken], () => `INIT ${clientName} {...}`);
  }

  /**
   * Create a new RUN message.
   * @param {string} statement the cypher statement.
   * @param {object} parameters the statement parameters.
   * @return {RequestMessage} new RUN message.
   */
  static run(statement, parameters) {
    return new RequestMessage(RUN, [statement, parameters], () => `RUN ${statement} ${JSON.stringify(parameters)}`);
  }

  /**
   * Get a PULL_ALL message.
   * @return {RequestMessage} the PULL_ALL message.
   */
  static pullAll() {
    return PULL_ALL_MESSAGE;
  }

  /**
   * Get a RESET message.
   * @return {RequestMessage} the RESET message.
   */
  static reset() {
    return RESET_MESSAGE;
  }

  /**
   * Create a new HELLO message.
   * @param {string} userAgent the user agent.
   * @param {object} authToken the authentication token.
   * @return {RequestMessage} new HELLO message.
   */
  static hello(userAgent, authToken) {
    const metadata = Object.assign({user_agent: userAgent}, authToken);
    return new RequestMessage(HELLO, [metadata], () => `HELLO {user_agent: '${userAgent}', ...}`);
  }

  /**
   * Create a new BEGIN message.
   * @param {Bookmark} bookmark the bookmark.
   * @param {TxConfig} txConfig the configuration.
   * @return {RequestMessage} new BEGIN message.
   */
  static begin(bookmark, txConfig) {
    const metadata = buildTxMetadata(bookmark, txConfig);
    return new RequestMessage(BEGIN, [metadata], () => `BEGIN ${JSON.stringify(metadata)}`);
  }

  /**
   * Get a COMMIT message.
   * @return {RequestMessage} the COMMIT message.
   */
  static commit() {
    return COMMIT_MESSAGE;
  }

  /**
   * Get a ROLLBACK message.
   * @return {RequestMessage} the ROLLBACK message.
   */
  static rollback() {
    return ROLLBACK_MESSAGE;
  }

  /**
   * Create a new RUN message with additional metadata.
   * @param {string} statement the cypher statement.
   * @param {object} parameters the statement parameters.
   * @param {Bookmark} bookmark the bookmark.
   * @param {TxConfig} txConfig the configuration.
   * @return {RequestMessage} new RUN message with additional metadata.
   */
  static runWithMetadata(statement, parameters, bookmark, txConfig) {
    const metadata = buildTxMetadata(bookmark, txConfig);
    return new RequestMessage(RUN, [statement, parameters, metadata],
      () => `RUN ${statement} ${JSON.stringify(parameters)} ${JSON.stringify(metadata)}`);
  }
}

/**
 * Create an object that represent transaction metadata.
 * @param {Bookmark} bookmark the bookmark.
 * @param {TxConfig} txConfig the configuration.
 * @return {object} a metadata object.
 */
function buildTxMetadata(bookmark, txConfig) {
  const metadata = {};
  if (!bookmark.isEmpty()) {
    metadata['bookmarks'] = bookmark.values();
  }
  if (txConfig.timeout) {
    metadata['tx_timeout'] = txConfig.timeout;
  }
  if (txConfig.metadata) {
    metadata['tx_metadata'] = txConfig.metadata;
  }
  return metadata;
}

// constants for messages that never change
const PULL_ALL_MESSAGE = new RequestMessage(PULL_ALL, [], () => 'PULL_ALL');
const RESET_MESSAGE = new RequestMessage(RESET, [], () => 'RESET');
const COMMIT_MESSAGE = new RequestMessage(COMMIT, [], () => 'COMMIT');
const ROLLBACK_MESSAGE = new RequestMessage(ROLLBACK, [], () => 'ROLLBACK');

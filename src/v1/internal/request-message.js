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
const INIT = 0x01;            // 0000 0001 // INIT <user_agent>
const ACK_FAILURE = 0x0E;     // 0000 1110 // ACK_FAILURE - unused
const RESET = 0x0F;           // 0000 1111 // RESET
const RUN = 0x10;             // 0001 0000 // RUN <statement> <parameters>
const DISCARD_ALL = 0x2F;     // 0010 1111 // DISCARD * - unused
const PULL_ALL = 0x3F;        // 0011 1111 // PULL *

export default class RequestMessage {

  constructor(signature, fields, isInitializationMessage, toString) {
    this.signature = signature;
    this.fields = fields;
    this.isInitializationMessage = isInitializationMessage;
    this.toString = toString;
  }

  /**
   * Create a new INIT message.
   * @param {string} clientName the client name.
   * @param {object} authToken the authentication token.
   * @return {RequestMessage} new INIT message.
   */
  static init(clientName, authToken) {
    return new RequestMessage(INIT, [clientName, authToken], true, () => `INIT ${clientName} {...}`);
  }

  /**
   * Create a new RUN message.
   * @param {string} statement the cypher statement.
   * @param {object} parameters the statement parameters.
   * @return {RequestMessage} new RUN message.
   */
  static run(statement, parameters) {
    return new RequestMessage(RUN, [statement, parameters], false, () => `RUN ${statement} ${JSON.stringify(parameters)}`);
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
}

// constants for messages that never change
const PULL_ALL_MESSAGE = new RequestMessage(PULL_ALL, [], false, () => 'PULL_ALL');
const RESET_MESSAGE = new RequestMessage(RESET, [], false, () => 'RESET');

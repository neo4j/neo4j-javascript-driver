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
import RequestMessage from './request-message';

export default class BoltProtocol {

  /**
   * @constructor
   * @param {Connection} connection the connection.
   * @param {Packer} packer the packer.
   * @param {Unpacker} unpacker the unpacker.
   */
  constructor(connection, packer, unpacker) {
    this._connection = connection;
    this._packer = packer;
    this._unpacker = unpacker;
  }

  /**
   * Get the packer.
   * @return {Packer} the protocol's packer.
   */
  packer() {
    return this._packer;
  }

  /**
   * Get the unpacker.
   * @return {Unpacker} the protocol's unpacker.
   */
  unpacker() {
    return this._unpacker;
  }

  /**
   * Perform initialization and authentication of the underlying connection.
   * @param {string} clientName the client name.
   * @param {object} authToken the authentication token.
   * @param {StreamObserver} observer the response observer.
   */
  initialize(clientName, authToken, observer) {
    const message = RequestMessage.init(clientName, authToken);
    this._connection.write(message, observer, true);
  }

  /**
   * Send a Cypher statement through the underlying connection.
   * @param {string} statement the cypher statement.
   * @param {object} parameters the statement parameters.
   * @param {StreamObserver} observer the response observer.
   */
  run(statement, parameters, observer) {
    const runMessage = RequestMessage.run(statement, parameters);
    const pullAllMessage = RequestMessage.pullAll();

    this._connection.write(runMessage, observer, false);
    this._connection.write(pullAllMessage, observer, true);
  }

  /**
   * Send a RESET through the underlying connection.
   * @param {StreamObserver} observer the response observer.
   */
  reset(observer) {
    const message = RequestMessage.reset();
    this._connection.write(message, observer, true);
  }
}

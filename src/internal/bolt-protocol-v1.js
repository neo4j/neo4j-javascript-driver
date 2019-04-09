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
import RequestMessage from './request-message'
import * as v1 from './packstream-v1'
import Bookmark from './bookmark'
import TxConfig from './tx-config'
import { ACCESS_MODE_WRITE } from './constants'
import { assertDbIsEmpty, assertTxConfigIsEmpty } from './bolt-protocol-util'

export default class BoltProtocol {
  /**
   * @constructor
   * @param {Connection} connection the connection.
   * @param {Chunker} chunker the chunker.
   * @param {boolean} disableLosslessIntegers if this connection should convert all received integers to native JS numbers.
   */
  constructor (connection, chunker, disableLosslessIntegers) {
    this._connection = connection
    this._packer = this._createPacker(chunker)
    this._unpacker = this._createUnpacker(disableLosslessIntegers)
  }

  /**
   * Get the packer.
   * @return {Packer} the protocol's packer.
   */
  packer () {
    return this._packer
  }

  /**
   * Get the unpacker.
   * @return {Unpacker} the protocol's unpacker.
   */
  unpacker () {
    return this._unpacker
  }

  /**
   * Transform metadata received in SUCCESS message before it is passed to the handler.
   * @param {object} metadata the received metadata.
   * @return {object} transformed metadata.
   */
  transformMetadata (metadata) {
    return metadata
  }

  /**
   * Perform initialization and authentication of the underlying connection.
   * @param {string} clientName the client name.
   * @param {object} authToken the authentication token.
   * @param {StreamObserver} observer the response observer.
   */
  initialize (clientName, authToken, observer) {
    const message = RequestMessage.init(clientName, authToken)
    this._connection.write(message, observer, true)
  }

  prepareToClose (observer) {
    // no need to notify the database in this protocol version
  }

  /**
   * Begin an explicit transaction.
   * @param {StreamObserver} observer the response observer.
   * @param {Bookmark} bookmark the bookmark.
   * @param {TxConfig} txConfig the configuration.
   * @param {string} db the target database name.
   * @param {string} mode the access mode.
   */
  beginTransaction (observer, { bookmark, txConfig, db, mode }) {
    assertTxConfigIsEmpty(txConfig, this._connection, observer)
    assertDbIsEmpty(db, this._connection, observer)

    const runMessage = RequestMessage.run(
      'BEGIN',
      bookmark.asBeginTransactionParameters()
    )
    const pullAllMessage = RequestMessage.pullAll()

    this._connection.write(runMessage, observer, false)
    this._connection.write(pullAllMessage, observer, false)
  }

  /**
   * Commit the explicit transaction.
   * @param {StreamObserver} observer the response observer.
   */
  commitTransaction (observer) {
    // WRITE access mode is used as a place holder here, it has
    // no effect on behaviour for Bolt V1 & V2
    this.run('COMMIT', {}, observer, {
      bookmark: Bookmark.empty(),
      txConfig: TxConfig.empty(),
      mode: ACCESS_MODE_WRITE
    })
  }

  /**
   * Rollback the explicit transaction.
   * @param {StreamObserver} observer the response observer.
   */
  rollbackTransaction (observer) {
    // WRITE access mode is used as a place holder here, it has
    // no effect on behaviour for Bolt V1 & V2
    this.run('ROLLBACK', {}, observer, {
      bookmark: Bookmark.empty(),
      txConfig: TxConfig.empty(),
      mode: ACCESS_MODE_WRITE
    })
  }

  /**
   * Send a Cypher statement through the underlying connection.
   * @param {string} statement the cypher statement.
   * @param {object} parameters the statement parameters.
   * @param {StreamObserver} observer the response observer.
   * @param {Bookmark} bookmark the bookmark.
   * @param {TxConfig} txConfig the auto-commit transaction configuration.
   * @param {string} db the target database name.
   * @param {string} mode the access mode.
   */
  run (statement, parameters, observer, { bookmark, txConfig, db, mode }) {
    // bookmark and mode are ignored in this version of the protocol
    assertTxConfigIsEmpty(txConfig, this._connection, observer)
    // passing in a db name on this protocol version throws an error
    assertDbIsEmpty(db, this._connection, observer)

    const runMessage = RequestMessage.run(statement, parameters)
    const pullAllMessage = RequestMessage.pullAll()

    this._connection.write(runMessage, observer, false)
    this._connection.write(pullAllMessage, observer, true)
  }

  /**
   * Send a RESET through the underlying connection.
   * @param {StreamObserver} observer the response observer.
   */
  reset (observer) {
    const message = RequestMessage.reset()
    this._connection.write(message, observer, true)
  }

  _createPacker (chunker) {
    return new v1.Packer(chunker)
  }

  _createUnpacker (disableLosslessIntegers) {
    return new v1.Unpacker(disableLosslessIntegers)
  }
}

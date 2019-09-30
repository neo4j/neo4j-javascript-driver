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
import {
  assertDatabaseIsEmpty,
  assertTxConfigIsEmpty
} from './bolt-protocol-util'
import Bookmark from './bookmark'
import { Chunker } from './chunking'
import Connection from './connection'
import { ACCESS_MODE_WRITE, BOLT_PROTOCOL_V1 } from './constants'
import * as v1 from './packstream-v1'
import { Packer } from './packstream-v1'
import RequestMessage from './request-message'
import {
  LoginObserver,
  ResetObserver,
  ResultStreamObserver,
  StreamObserver
} from './stream-observers'
import TxConfig from './tx-config'

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
   * Returns the numerical version identifier for this protocol
   */
  get version () {
    return BOLT_PROTOCOL_V1
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
   * @param {Object} metadata the received metadata.
   * @return {Object} transformed metadata.
   */
  transformMetadata (metadata) {
    return metadata
  }

  /**
   * Perform initialization and authentication of the underlying connection.
   * @param {Object} param
   * @param {string} param.userAgent the user agent.
   * @param {Object} param.authToken the authentication token.
   * @param {function(err: Error)} param.onError the callback to invoke on error.
   * @param {function()} param.onComplete the callback to invoke on completion.
   * @returns {StreamObserver} the stream observer that monitors the corresponding server response.
   */
  initialize ({ userAgent, authToken, onError, onComplete } = {}) {
    const observer = new LoginObserver({
      connection: this._connection,
      afterError: onError,
      afterComplete: onComplete
    })

    this._connection.write(
      RequestMessage.init(userAgent, authToken),
      observer,
      true
    )

    return observer
  }

  /**
   * Perform protocol related operations for closing this connection
   */
  prepareToClose () {
    // no need to notify the database in this protocol version
  }

  /**
   * Begin an explicit transaction.
   * @param {Object} param
   * @param {Bookmark} param.bookmark the bookmark.
   * @param {TxConfig} param.txConfig the configuration.
   * @param {string} param.database the target database name.
   * @param {string} param.mode the access mode.
   * @param {function(err: Error)} param.beforeError the callback to invoke before handling the error.
   * @param {function(err: Error)} param.afterError the callback to invoke after handling the error.
   * @param {function()} param.beforeComplete the callback to invoke before handling the completion.
   * @param {function()} param.afterComplete the callback to invoke after handling the completion.
   * @returns {StreamObserver} the stream observer that monitors the corresponding server response.
   */
  beginTransaction ({
    bookmark,
    txConfig,
    database,
    mode,
    beforeError,
    afterError,
    beforeComplete,
    afterComplete
  } = {}) {
    return this.run(
      'BEGIN',
      bookmark ? bookmark.asBeginTransactionParameters() : {},
      {
        bookmark: bookmark,
        txConfig: txConfig,
        database,
        mode,
        beforeError,
        afterError,
        beforeComplete,
        afterComplete,
        flush: false
      }
    )
  }

  /**
   * Commit the explicit transaction.
   * @param {Object} param
   * @param {function(err: Error)} param.beforeError the callback to invoke before handling the error.
   * @param {function(err: Error)} param.afterError the callback to invoke after handling the error.
   * @param {function()} param.beforeComplete the callback to invoke before handling the completion.
   * @param {function()} param.afterComplete the callback to invoke after handling the completion.
   * @returns {StreamObserver} the stream observer that monitors the corresponding server response.
   */
  commitTransaction ({
    beforeError,
    afterError,
    beforeComplete,
    afterComplete
  } = {}) {
    // WRITE access mode is used as a place holder here, it has
    // no effect on behaviour for Bolt V1 & V2
    return this.run(
      'COMMIT',
      {},
      {
        bookmark: Bookmark.empty(),
        txConfig: TxConfig.empty(),
        mode: ACCESS_MODE_WRITE,
        beforeError,
        afterError,
        beforeComplete,
        afterComplete
      }
    )
  }

  /**
   * Rollback the explicit transaction.
   * @param {Object} param
   * @param {function(err: Error)} param.beforeError the callback to invoke before handling the error.
   * @param {function(err: Error)} param.afterError the callback to invoke after handling the error.
   * @param {function()} param.beforeComplete the callback to invoke before handling the completion.
   * @param {function()} param.afterComplete the callback to invoke after handling the completion.
   * @returns {StreamObserver} the stream observer that monitors the corresponding server response.
   */
  rollbackTransaction ({
    beforeError,
    afterError,
    beforeComplete,
    afterComplete
  } = {}) {
    // WRITE access mode is used as a place holder here, it has
    // no effect on behaviour for Bolt V1 & V2
    return this.run(
      'ROLLBACK',
      {},
      {
        bookmark: Bookmark.empty(),
        txConfig: TxConfig.empty(),
        mode: ACCESS_MODE_WRITE,
        beforeError,
        afterError,
        beforeComplete,
        afterComplete
      }
    )
  }

  /**
   * Send a Cypher statement through the underlying connection.
   * @param {string} statement the cypher statement.
   * @param {Object} parameters the statement parameters.
   * @param {Object} param
   * @param {Bookmark} param.bookmark the bookmark.
   * @param {TxConfig} param.txConfig the transaction configuration.
   * @param {string} param.database the target database name.
   * @param {string} param.mode the access mode.
   * @param {function(keys: string[])} param.beforeKeys the callback to invoke before handling the keys.
   * @param {function(keys: string[])} param.afterKeys the callback to invoke after handling the keys.
   * @param {function(err: Error)} param.beforeError the callback to invoke before handling the error.
   * @param {function(err: Error)} param.afterError the callback to invoke after handling the error.
   * @param {function()} param.beforeComplete the callback to invoke before handling the completion.
   * @param {function()} param.afterComplete the callback to invoke after handling the completion.
   * @param {boolean} param.flush whether to flush the buffered messages.
   * @returns {StreamObserver} the stream observer that monitors the corresponding server response.
   */
  run (
    statement,
    parameters,
    {
      bookmark,
      txConfig,
      database,
      mode,
      beforeKeys,
      afterKeys,
      beforeError,
      afterError,
      beforeComplete,
      afterComplete,
      flush = true
    } = {}
  ) {
    const observer = new ResultStreamObserver({
      connection: this._connection,
      beforeKeys,
      afterKeys,
      beforeError,
      afterError,
      beforeComplete,
      afterComplete
    })

    // bookmark and mode are ignored in this version of the protocol
    assertTxConfigIsEmpty(txConfig, this._connection, observer)
    // passing in a database name on this protocol version throws an error
    assertDatabaseIsEmpty(database, this._connection, observer)

    this._connection.write(
      RequestMessage.run(statement, parameters),
      observer,
      false
    )
    this._connection.write(RequestMessage.pullAll(), observer, flush)

    return observer
  }

  /**
   * Send a RESET through the underlying connection.
   * @param {Object} param
   * @param {function(err: Error)} param.onError the callback to invoke on error.
   * @param {function()} param.onComplete the callback to invoke on completion.
   * @returns {StreamObserver} the stream observer that monitors the corresponding server response.
   */
  reset ({ onError, onComplete } = {}) {
    const observer = new ResetObserver({
      connection: this._connection,
      onError,
      onComplete
    })

    this._connection.write(RequestMessage.reset(), observer, true)

    return observer
  }

  _createPacker (chunker) {
    return new v1.Packer(chunker)
  }

  _createUnpacker (disableLosslessIntegers) {
    return new v1.Unpacker(disableLosslessIntegers)
  }
}

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
import {
  assertDatabaseIsEmpty,
  assertTxConfigIsEmpty,
  assertImpersonatedUserIsEmpty,
  assertNotificationFilterIsEmpty
} from './bolt-protocol-util'
// eslint-disable-next-line no-unused-vars
import { Chunker } from '../channel'
import { structure, v1 } from '../packstream'
import RequestMessage, { SIGNATURES } from './request-message'
import {
  CompletedObserver,
  LoginObserver,
  LogoffObserver,
  ResetObserver,
  ResultStreamObserver,
  // eslint-disable-next-line no-unused-vars
  StreamObserver
} from './stream-observers'
import { internal, newError } from 'neo4j-driver-core'
import transformersFactories from './bolt-protocol-v1.transformer'
import Transformer from './transformer'

const {
  bookmarks: { Bookmarks },
  constants: { ACCESS_MODE_WRITE, BOLT_PROTOCOL_V1 },
  // eslint-disable-next-line no-unused-vars
  logger: { Logger },
  txConfig: { TxConfig }
} = internal

const DEFAULT_DIAGNOSTIC_RECORD = Object.freeze({
  OPERATION: '',
  OPERATION_CODE: '0',
  CURRENT_SCHEMA: '/'
})

export default class BoltProtocol {
  /**
   * @callback CreateResponseHandler Creates the response handler
   * @param {BoltProtocol} protocol The bolt protocol
   * @returns {ResponseHandler} The response handler
   */
  /**
   * @callback OnProtocolError Handles protocol error
   * @param {string} error The description
   */
  /**
   * @constructor
   * @param {Object} server the server informatio.
   * @param {Chunker} chunker the chunker.
   * @param {Object} packstreamConfig Packstream configuration
   * @param {boolean} packstreamConfig.disableLosslessIntegers if this connection should convert all received integers to native JS numbers.
   * @param {boolean} packstreamConfig.useBigInt if this connection should convert all received integers to native BigInt numbers.
   * @param {CreateResponseHandler} createResponseHandler Function which creates the response handler
   * @param {Logger} log the logger
   * @param {OnProtocolError} onProtocolError handles protocol errors
   */
  constructor (
    server,
    chunker,
    { disableLosslessIntegers, useBigInt } = {},
    createResponseHandler = () => null,
    log,
    onProtocolError
  ) {
    this._server = server || {}
    this._chunker = chunker
    this._packer = this._createPacker(chunker)
    this._unpacker = this._createUnpacker(disableLosslessIntegers, useBigInt)
    this._responseHandler = createResponseHandler(this)
    this._log = log
    this._onProtocolError = onProtocolError
    this._fatalError = null
    this._lastMessageSignature = null
    this._config = { disableLosslessIntegers, useBigInt }
  }

  get transformer () {
    if (this._transformer === undefined) {
      this._transformer = new Transformer(Object.values(transformersFactories).map(create => create(this._config, this._log)))
    }
    return this._transformer
  }

  /**
   * Returns the numerical version identifier for this protocol
   */
  get version () {
    return BOLT_PROTOCOL_V1
  }

  /**
   * @property {boolean} supportsReAuth Either if the protocol version supports re-auth or not.
   */
  get supportsReAuth () {
    return false
  }

  /**
   * @property {boolean} initialized Either if the protocol was initialized or not
   */
  get initialized () {
    return !!this._initialized
  }

  /**
   * @property {object} authToken The token used in the last login
   */
  get authToken () {
    return this._authToken
  }

  /**
   * Get the packer.
   * @return {Packer} the protocol's packer.
   */
  packer () {
    return this._packer
  }

  /**
   * Creates a packable function out of the provided value
   * @param x the value to pack
   * @returns Function
   */
  packable (x) {
    return this._packer.packable(x, this.transformer.toStructure)
  }

  /**
   * Get the unpacker.
   * @return {Unpacker} the protocol's unpacker.
   */
  unpacker () {
    return this._unpacker
  }

  /**
   * Unpack a buffer
   * @param {Buffer} buf
   * @returns {any|null} The unpacked value
   */
  unpack (buf) {
    return this._unpacker.unpack(buf, this.transformer.fromStructure)
  }

  /**
   * Transform metadata received in SUCCESS message before it is passed to the handler.
   * @param {Object} metadata the received metadata.
   * @return {Object} transformed metadata.
   */
  transformMetadata (metadata) {
    return metadata
  }

  enrichErrorMetadata (metadata) {
    return {
      ...metadata,
      diagnostic_record: metadata.diagnostic_record !== null ? { ...DEFAULT_DIAGNOSTIC_RECORD, ...metadata.diagnostic_record } : null
    }
  }

  /**
   * Perform initialization and authentication of the underlying connection.
   * @param {Object} param
   * @param {string} param.userAgent the user agent.
   * @param {Object} param.authToken the authentication token.
   * @param {NotificationFilter} param.notificationFilter the notification filter.
   * @param {function(err: Error)} param.onError the callback to invoke on error.
   * @param {function()} param.onComplete the callback to invoke on completion.
   * @returns {StreamObserver} the stream observer that monitors the corresponding server response.
   */
  initialize ({ userAgent, boltAgent, authToken, notificationFilter, onError, onComplete } = {}) {
    const observer = new LoginObserver({
      onError: error => this._onLoginError(error, onError),
      onCompleted: metadata => this._onLoginCompleted(metadata, onComplete)
    })

    // passing notification filter on this protocol version throws an error
    assertNotificationFilterIsEmpty(notificationFilter, this._onProtocolError, observer)

    this.write(RequestMessage.init(userAgent, authToken), observer, true)

    return observer
  }

  /**
   * Performs logoff of the underlying connection
   *
   * @param {Object} param
   * @param {function(err: Error)} param.onError the callback to invoke on error.
   * @param {function()} param.onComplete the callback to invoke on completion.
   * @param {boolean} param.flush whether to flush the buffered messages.
   *
   * @returns {StreamObserver} the stream observer that monitors the corresponding server response.
   */
  logoff ({ onComplete, onError, flush } = {}) {
    const observer = new LogoffObserver({
      onCompleted: onComplete,
      onError
    })

    // TODO: Verify the Neo4j version in the message
    const error = newError(
      'Driver is connected to a database that does not support logoff. ' +
        'Please upgrade to Neo4j 5.5.0 or later in order to use this functionality.'
    )

    // unsupported API was used, consider this a fatal error for the current connection
    this._onProtocolError(error.message)
    observer.onError(error)
    throw error
  }

  /**
   * Performs login of the underlying connection
   *
   * @param {Object} args
   * @param {Object} args.authToken the authentication token.
   * @param {function(err: Error)} args.onError the callback to invoke on error.
   * @param {function()} args.onComplete the callback to invoke on completion.
   * @param {boolean} args.flush whether to flush the buffered messages.
   *
   * @returns {StreamObserver} the stream observer that monitors the corresponding server response.
   */
  logon ({ authToken, onComplete, onError, flush } = {}) {
    const observer = new LoginObserver({
      onCompleted: () => this._onLoginCompleted({}, authToken, onComplete),
      onError: (error) => this._onLoginError(error, onError)
    })

    // TODO: Verify the Neo4j version in the message
    const error = newError(
      'Driver is connected to a database that does not support logon. ' +
        'Please upgrade to Neo4j 5.5.0 or later in order to use this functionality.'
    )

    // unsupported API was used, consider this a fatal error for the current connection
    this._onProtocolError(error.message)
    observer.onError(error)
    throw error
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
   * @param {Bookmarks} param.bookmarks the bookmarks.
   * @param {TxConfig} param.txConfig the configuration.
   * @param {string} param.database the target database name.
   * @param {string} param.mode the access mode.
   * @param {string} param.impersonatedUser the impersonated user
   * @param {NotificationFilter} param.notificationFilter the notification filter.
   * @param {function(err: Error)} param.beforeError the callback to invoke before handling the error.
   * @param {function(err: Error)} param.afterError the callback to invoke after handling the error.
   * @param {function()} param.beforeComplete the callback to invoke before handling the completion.
   * @param {function()} param.afterComplete the callback to invoke after handling the completion.
   * @returns {StreamObserver} the stream observer that monitors the corresponding server response.
   */
  beginTransaction ({
    bookmarks,
    txConfig,
    database,
    mode,
    impersonatedUser,
    notificationFilter,
    beforeError,
    afterError,
    beforeComplete,
    afterComplete
  } = {}) {
    return this.run(
      'BEGIN',
      bookmarks ? bookmarks.asBeginTransactionParameters() : {},
      {
        bookmarks,
        txConfig,
        database,
        mode,
        impersonatedUser,
        notificationFilter,
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
        bookmarks: Bookmarks.empty(),
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
        bookmarks: Bookmarks.empty(),
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
   * Send a Cypher query through the underlying connection.
   * @param {string} query the cypher query.
   * @param {Object} parameters the query parameters.
   * @param {Object} param
   * @param {Bookmarks} param.bookmarks the bookmarks.
   * @param {TxConfig} param.txConfig the transaction configuration.
   * @param {string} param.database the target database name.
   * @param {string} param.impersonatedUser the impersonated user
   * @param {NotificationFilter} param.notificationFilter the notification filter.
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
    query,
    parameters,
    {
      bookmarks,
      txConfig,
      database,
      mode,
      impersonatedUser,
      notificationFilter,
      beforeKeys,
      afterKeys,
      beforeError,
      afterError,
      beforeComplete,
      afterComplete,
      flush = true,
      highRecordWatermark = Number.MAX_VALUE,
      lowRecordWatermark = Number.MAX_VALUE
    } = {}
  ) {
    const observer = new ResultStreamObserver({
      server: this._server,
      beforeKeys,
      afterKeys,
      beforeError,
      afterError,
      beforeComplete,
      afterComplete,
      highRecordWatermark,
      lowRecordWatermark
    })

    // bookmarks and mode are ignored in this version of the protocol
    assertTxConfigIsEmpty(txConfig, this._onProtocolError, observer)
    // passing in a database name on this protocol version throws an error
    assertDatabaseIsEmpty(database, this._onProtocolError, observer)
    // passing impersonated user on this protocol version throws an error
    assertImpersonatedUserIsEmpty(impersonatedUser, this._onProtocolError, observer)
    // passing notification filter on this protocol version throws an error
    assertNotificationFilterIsEmpty(notificationFilter, this._onProtocolError, observer)

    this.write(RequestMessage.run(query, parameters), observer, false)
    this.write(RequestMessage.pullAll(), observer, flush)

    return observer
  }

  get currentFailure () {
    return this._responseHandler.currentFailure
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
      onProtocolError: this._onProtocolError,
      onError,
      onComplete
    })

    this.write(RequestMessage.reset(), observer, true)

    return observer
  }

  /**
   * Send a TELEMETRY through the underlying connection.
   *
   * @param {object} param0 Message params
   * @param {number} param0.api The API called
   * @param {object} param1 Configuration and callbacks
   * @param {function()} param1.onCompleted Called when completed
   * @param {function()} param1.onError Called when error
   * @return {StreamObserver} the stream observer that monitors the corresponding server response.
   */
  telemetry ({ api }, { onError, onCompleted } = {}) {
    const observer = new CompletedObserver()
    if (onCompleted) {
      onCompleted()
    }
    return observer
  }

  _createPacker (chunker) {
    return new v1.Packer(chunker)
  }

  _createUnpacker (disableLosslessIntegers, useBigInt) {
    return new v1.Unpacker(disableLosslessIntegers, useBigInt)
  }

  /**
   * Write a message to the network channel.
   * @param {RequestMessage} message the message to write.
   * @param {StreamObserver} observer the response observer.
   * @param {boolean} flush `true` if flush should happen after the message is written to the buffer.
   */
  write (message, observer, flush) {
    const queued = this.queueObserverIfProtocolIsNotBroken(observer)

    if (queued) {
      if (this._log.isDebugEnabled()) {
        this._log.debug(`C: ${message}`)
      }

      this._lastMessageSignature = message.signature
      const messageStruct = new structure.Structure(message.signature, message.fields)

      this.packable(messageStruct)()

      this._chunker.messageBoundary()
      if (flush) {
        this._chunker.flush()
      }
    }
  }

  isLastMessageLogon () {
    return this._lastMessageSignature === SIGNATURES.HELLO ||
      this._lastMessageSignature === SIGNATURES.LOGON
  }

  isLastMessageReset () {
    return this._lastMessageSignature === SIGNATURES.RESET
  }

  /**
   * Notifies faltal erros to the observers and mark the protocol in the fatal error state.
   * @param {Error} error The error
   */
  notifyFatalError (error) {
    this._fatalError = error
    return this._responseHandler._notifyErrorToObservers(error)
  }

  /**
   * Updates the the current observer with the next one on the queue.
   */
  updateCurrentObserver () {
    return this._responseHandler._updateCurrentObserver()
  }

  /**
   * Checks if exist an ongoing observable requests
   * @return {boolean}
   */
  hasOngoingObservableRequests () {
    return this._responseHandler.hasOngoingObservableRequests()
  }

  /**
   * Enqueue the observer if the protocol is not broken.
   * In case it's broken, the observer will be notified about the error.
   *
   * @param {StreamObserver} observer The observer
   * @returns {boolean} if it was queued
   */
  queueObserverIfProtocolIsNotBroken (observer) {
    if (this.isBroken()) {
      this.notifyFatalErrorToObserver(observer)
      return false
    }

    return this._responseHandler._queueObserver(observer)
  }

  /**
   * Veritfy the protocol is not broken.
   * @returns {boolean}
   */
  isBroken () {
    return !!this._fatalError
  }

  /**
   * Notifies the current fatal error to the observer
   *
   * @param {StreamObserver} observer The observer
   */
  notifyFatalErrorToObserver (observer) {
    if (observer && observer.onError) {
      observer.onError(this._fatalError)
    }
  }

  /**
   * Reset current failure on the observable response handler to null.
   */
  resetFailure () {
    this._responseHandler._resetFailure()
  }

  _onLoginCompleted (metadata, authToken, onCompleted) {
    this._initialized = true
    this._authToken = authToken
    if (metadata) {
      const serverVersion = metadata.server
      if (!this._server.version) {
        this._server.version = serverVersion
      }
    }
    if (onCompleted) {
      onCompleted(metadata)
    }
  }

  _onLoginError (error, onError) {
    this._onProtocolError(error.message)
    if (onError) {
      onError(error)
    }
  }
}

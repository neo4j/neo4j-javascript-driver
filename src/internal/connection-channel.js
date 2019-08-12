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

import { Channel } from './node'
import { Chunker, Dechunker } from './chunking'
import { newError, PROTOCOL_ERROR } from '../error'
import ChannelConfig from './channel-config'
import ProtocolHandshaker from './protocol-handshaker'
import Connection from './connection'
import BoltProtocol from './bolt-protocol-v1'
import { ResultStreamObserver } from './stream-observers'

// Signature bytes for each response message type
const SUCCESS = 0x70 // 0111 0000 // SUCCESS <metadata>
const RECORD = 0x71 // 0111 0001 // RECORD <value>
const IGNORED = 0x7e // 0111 1110 // IGNORED <metadata>
const FAILURE = 0x7f // 0111 1111 // FAILURE <metadata>

function NO_OP () {}

const NO_OP_OBSERVER = {
  onNext: NO_OP,
  onCompleted: NO_OP,
  onError: NO_OP
}

let idGenerator = 0

export default class ChannelConnection extends Connection {
  /**
   * @constructor
   * @param {Channel} channel - channel with a 'write' function and a 'onmessage' callback property.
   * @param {ConnectionErrorHandler} errorHandler the error handler.
   * @param {ServerAddress} address - the server address to connect to.
   * @param {Logger} log - the configured logger.
   * @param {boolean} disableLosslessIntegers if this connection should convert all received integers to native JS numbers.
   */
  constructor (
    channel,
    errorHandler,
    address,
    log,
    disableLosslessIntegers = false
  ) {
    super(errorHandler)

    this._id = idGenerator++
    this._address = address
    this._server = { address: address.asHostPort() }
    this.creationTimestamp = Date.now()
    this._disableLosslessIntegers = disableLosslessIntegers
    this._pendingObservers = []
    this._currentObserver = undefined
    this._ch = channel
    this._dechunker = new Dechunker()
    this._chunker = new Chunker(channel)
    this._log = log

    // connection from the database, returned in response for HELLO message and might not be available
    this._dbConnectionId = null

    // bolt protocol is initially not initialized
    /**
     * @private
     * @type {BoltProtocol}
     */
    this._protocol = null

    // error extracted from a FAILURE message
    this._currentFailure = null

    // Set to true on fatal errors, to get this out of connection pool.
    this._isBroken = false

    if (this._log.isDebugEnabled()) {
      this._log.debug(`${this} created towards ${address}`)
    }
  }

  /**
   * Crete new connection to the provided address. Returned connection is not connected.
   * @param {ServerAddress} address - the Bolt endpoint to connect to.
   * @param {Object} config - the driver configuration.
   * @param {ConnectionErrorHandler} errorHandler - the error handler for connection errors.
   * @param {Logger} log - configured logger.
   * @return {Connection} - new connection.
   */
  static create (address, config, errorHandler, log) {
    const channelConfig = new ChannelConfig(
      address,
      config,
      errorHandler.errorCode()
    )
    return new ChannelConnection(
      new Channel(channelConfig),
      errorHandler,
      address,
      log,
      config.disableLosslessIntegers
    )
  }

  get id () {
    return this._id
  }

  get databaseId () {
    return this._dbConnectionId
  }

  set databaseId (value) {
    this._dbConnectionId = value
  }

  /**
   * Connect to the target address, negotiate Bolt protocol and send initialization message.
   * @param {string} userAgent the user agent for this driver.
   * @param {Object} authToken the object containing auth information.
   * @return {Promise<Connection>} promise resolved with the current connection if connection is successful. Rejected promise otherwise.
   */
  connect (userAgent, authToken) {
    return this._negotiateProtocol().then(() =>
      this._initialize(userAgent, authToken)
    )
  }

  /**
   * Execute Bolt protocol handshake to initialize the protocol version.
   * @return {Promise<Connection>} promise resolved with the current connection if handshake is successful. Rejected promise otherwise.
   */
  _negotiateProtocol () {
    const protocolHandshaker = new ProtocolHandshaker(
      this,
      this._ch,
      this._chunker,
      this._disableLosslessIntegers,
      this._log
    )

    return new Promise((resolve, reject) => {
      const handshakeErrorHandler = error => {
        this._handleFatalError(error)
        reject(error)
      }

      this._ch.onerror = handshakeErrorHandler.bind(this)
      if (this._ch._error) {
        // channel is already broken
        handshakeErrorHandler(this._ch._error)
      }

      this._ch.onmessage = buffer => {
        try {
          // read the response buffer and initialize the protocol
          this._protocol = protocolHandshaker.createNegotiatedProtocol(buffer)

          // reset the error handler to just handle errors and forget about the handshake promise
          this._ch.onerror = this._handleFatalError.bind(this)

          // Ok, protocol running. Simply forward all messages to the dechunker
          this._ch.onmessage = buf => this._dechunker.write(buf)

          // setup dechunker to dechunk messages and forward them to the message handler
          this._dechunker.onmessage = buf => {
            this._handleMessage(this._protocol.unpacker().unpack(buf))
          }
          // forward all pending bytes to the dechunker
          if (buffer.hasRemaining()) {
            this._dechunker.write(buffer.readSlice(buffer.remaining()))
          }

          resolve(this)
        } catch (e) {
          this._handleFatalError(e)
          reject(e)
        }
      }

      protocolHandshaker.writeHandshakeRequest()
    })
  }

  /**
   * Perform protocol-specific initialization which includes authentication.
   * @param {string} userAgent the user agent for this driver.
   * @param {Object} authToken the object containing auth information.
   * @return {Promise<Connection>} promise resolved with the current connection if initialization is successful. Rejected promise otherwise.
   */
  _initialize (userAgent, authToken) {
    const self = this
    return new Promise((resolve, reject) => {
      this._protocol.initialize({
        userAgent,
        authToken,
        onError: err => reject(err),
        onComplete: () => resolve(self)
      })
    })
  }

  /**
   * Get the Bolt protocol for the connection.
   * @return {BoltProtocol} the protocol.
   */
  protocol () {
    return this._protocol
  }

  get address () {
    return this._address
  }

  /**
   * Get the version of the connected server.
   * Available only after initialization
   *
   * @returns {ServerVersion} version
   */
  get version () {
    return this._server.version
  }

  set version (value) {
    this._server.version = value
  }

  get server () {
    return this._server
  }

  /**
   * Write a message to the network channel.
   * @param {RequestMessage} message the message to write.
   * @param {ResultStreamObserver} observer the response observer.
   * @param {boolean} flush `true` if flush should happen after the message is written to the buffer.
   */
  write (message, observer, flush) {
    const queued = this._queueObserver(observer)

    if (queued) {
      if (this._log.isDebugEnabled()) {
        this._log.debug(`${this} C: ${message}`)
      }

      this._protocol
        .packer()
        .packStruct(
          message.signature,
          message.fields.map(field => this._packable(field))
        )

      this._chunker.messageBoundary()

      if (flush) {
        this._chunker.flush()
      }
    }
  }

  /**
   * "Fatal" means the connection is dead. Only call this if something
   * happens that cannot be recovered from. This will lead to all subscribers
   * failing, and the connection getting ejected from the session pool.
   *
   * @param error an error object, forwarded to all current and future subscribers
   */
  _handleFatalError (error) {
    this._isBroken = true
    this._error = this.handleAndTransformError(error, this._address)

    if (this._log.isErrorEnabled()) {
      this._log.error(
        `${this} experienced a fatal error ${JSON.stringify(this._error)}`
      )
    }

    if (this._currentObserver && this._currentObserver.onError) {
      this._currentObserver.onError(this._error)
    }
    while (this._pendingObservers.length > 0) {
      let observer = this._pendingObservers.shift()
      if (observer && observer.onError) {
        observer.onError(this._error)
      }
    }
  }

  _handleMessage (msg) {
    if (this._isBroken) {
      // ignore all incoming messages when this connection is broken. all previously pending observers failed
      // with the fatal error. all future observers will fail with same fatal error.
      return
    }

    const payload = msg.fields[0]

    switch (msg.signature) {
      case RECORD:
        if (this._log.isDebugEnabled()) {
          this._log.debug(`${this} S: RECORD ${JSON.stringify(msg)}`)
        }
        this._currentObserver.onNext(payload)
        break
      case SUCCESS:
        if (this._log.isDebugEnabled()) {
          this._log.debug(`${this} S: SUCCESS ${JSON.stringify(msg)}`)
        }
        try {
          const metadata = this._protocol.transformMetadata(payload)
          this._currentObserver.onCompleted(metadata)
        } finally {
          this._updateCurrentObserver()
        }
        break
      case FAILURE:
        if (this._log.isDebugEnabled()) {
          this._log.debug(`${this} S: FAILURE ${JSON.stringify(msg)}`)
        }
        try {
          const error = newError(payload.message, payload.code)
          this._currentFailure = this.handleAndTransformError(
            error,
            this._address
          )
          this._currentObserver.onError(this._currentFailure)
        } finally {
          this._updateCurrentObserver()
          // Things are now broken. Pending observers will get FAILURE messages routed until we are done handling this failure.
          this._resetOnFailure()
        }
        break
      case IGNORED:
        if (this._log.isDebugEnabled()) {
          this._log.debug(`${this} S: IGNORED ${JSON.stringify(msg)}`)
        }
        try {
          if (this._currentFailure && this._currentObserver.onError) {
            this._currentObserver.onError(this._currentFailure)
          } else if (this._currentObserver.onError) {
            this._currentObserver.onError(
              newError('Ignored either because of an error or RESET')
            )
          }
        } finally {
          this._updateCurrentObserver()
        }
        break
      default:
        this._handleFatalError(
          newError('Unknown Bolt protocol message: ' + msg)
        )
    }
  }

  /**
   * Send a RESET-message to the database. Message is immediately flushed to the network.
   * @return {Promise<void>} promise resolved when SUCCESS-message response arrives, or failed when other response messages arrives.
   */
  resetAndFlush () {
    return new Promise((resolve, reject) => {
      this._protocol.reset({
        onError: error => {
          if (this._isBroken) {
            // handling a fatal error, no need to raise a protocol violation
            reject(error)
          } else {
            const neo4jError = this._handleProtocolError(
              'Received FAILURE as a response for RESET: ' + error
            )
            reject(neo4jError)
          }
        },
        onComplete: () => {
          resolve()
        }
      })
    })
  }

  _resetOnFailure () {
    this._protocol.reset({
      onError: () => {
        this._currentFailure = null
      },
      onComplete: () => {
        this._currentFailure = null
      }
    })
  }

  _queueObserver (observer) {
    if (this._isBroken) {
      if (observer && observer.onError) {
        observer.onError(this._error)
      }
      return false
    }
    observer = observer || NO_OP_OBSERVER
    observer.onCompleted = observer.onCompleted || NO_OP
    observer.onError = observer.onError || NO_OP
    observer.onNext = observer.onNext || NO_OP
    if (this._currentObserver === undefined) {
      this._currentObserver = observer
    } else {
      this._pendingObservers.push(observer)
    }
    return true
  }

  /*
   * Pop next pending observer form the list of observers and make it current observer.
   * @protected
   */
  _updateCurrentObserver () {
    this._currentObserver = this._pendingObservers.shift()
  }

  /** Check if this connection is in working condition */
  isOpen () {
    return !this._isBroken && this._ch._open
  }

  /**
   * Call close on the channel.
   * @param {function} cb - Function to call on close.
   */
  close (cb = () => null) {
    if (this._log.isDebugEnabled()) {
      this._log.debug(`${this} closing`)
    }

    if (this._protocol && this.isOpen()) {
      // protocol has been initialized and this connection is healthy
      // notify the database about the upcoming close of the connection
      this._protocol.prepareToClose()
    }

    this._ch.close(() => {
      if (this._log.isDebugEnabled()) {
        this._log.debug(`${this} closed`)
      }
      cb()
    })
  }

  toString () {
    return `Connection [${this.id}][${this.databaseId || ''}]`
  }

  _packable (value) {
    return this._protocol.packer().packable(value)
  }

  _handleProtocolError (message) {
    this._currentFailure = null
    this._updateCurrentObserver()
    const error = newError(message, PROTOCOL_ERROR)
    this._handleFatalError(error)
    return error
  }
}

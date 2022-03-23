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

import { Chunker, Dechunker, ChannelConfig, Channel } from '../channel'
import { newError, error, json, internal, toNumber } from 'neo4j-driver-core'
import Connection from './connection'
import Bolt from '../bolt'

const { PROTOCOL_ERROR } = error
const {
  logger: { Logger }
} = internal

let idGenerator = 0

/**
 * Crete new connection to the provided address. Returned connection is not connected.
 * @param {ServerAddress} address - the Bolt endpoint to connect to.
 * @param {Object} config - the driver configuration.
 * @param {ConnectionErrorHandler} errorHandler - the error handler for connection errors.
 * @param {Logger} log - configured logger.
 * @return {Connection} - new connection.
 */
export function createChannelConnection (
  address,
  config,
  errorHandler,
  log,
  serversideRouting = null,
  createChannel = channelConfig => new Channel(channelConfig)
) {
  const channelConfig = new ChannelConfig(
    address,
    config,
    errorHandler.errorCode()
  )

  const channel = createChannel(channelConfig)

  return Bolt.handshake(channel)
    .then(({ protocolVersion: version, consumeRemainingBuffer }) => {
      const chunker = new Chunker(channel)
      const dechunker = new Dechunker()
      const createProtocol = conn =>
        Bolt.create({
          version,
          channel,
          chunker,
          dechunker,
          disableLosslessIntegers: config.disableLosslessIntegers,
          useBigInt: config.useBigInt,
          serversideRouting,
          server: conn.server,
          log: conn.logger,
          observer: {
            onPendingObserversChange: conn._handleOngoingRequestsNumberChange.bind(conn),
            onError: conn._handleFatalError.bind(conn),
            onFailure: conn._resetOnFailure.bind(conn),
            onProtocolError: conn._handleProtocolError.bind(conn),
            onErrorApplyTransformation: error =>
              conn.handleAndTransformError(error, conn._address)
          }
        })

      const connection = new ChannelConnection(
        channel,
        errorHandler,
        address,
        log,
        config.disableLosslessIntegers,
        serversideRouting,
        chunker,
        createProtocol
      )

      // forward all pending bytes to the dechunker
      consumeRemainingBuffer(buffer => dechunker.write(buffer))

      return connection
    })
    .catch(reason =>
      channel.close().then(() => {
        throw reason
      })
    )
}
export default class ChannelConnection extends Connection {
  /**
   * @constructor
   * @param {Channel} channel - channel with a 'write' function and a 'onmessage' callback property.
   * @param {ConnectionErrorHandler} errorHandler the error handler.
   * @param {ServerAddress} address - the server address to connect to.
   * @param {Logger} log - the configured logger.
   * @param {boolean} disableLosslessIntegers if this connection should convert all received integers to native JS numbers.
   * @param {Chunker} chunker the chunker
   * @param protocolSupplier Bolt protocol supplier
   */
  constructor (
    channel,
    errorHandler,
    address,
    log,
    disableLosslessIntegers = false,
    serversideRouting = null,
    chunker, // to be removed,
    protocolSupplier
  ) {
    super(errorHandler)

    this._id = idGenerator++
    this._address = address
    this._server = { address: address.asHostPort() }
    this.creationTimestamp = Date.now()
    this._disableLosslessIntegers = disableLosslessIntegers
    this._ch = channel
    this._chunker = chunker
    this._log = createConnectionLogger(this, log)
    this._serversideRouting = serversideRouting

    // connection from the database, returned in response for HELLO message and might not be available
    this._dbConnectionId = null

    // bolt protocol is initially not initialized
    /**
     * @private
     * @type {BoltProtocol}
     */
    this._protocol = protocolSupplier(this)

    // Set to true on fatal errors, to get this out of connection pool.
    this._isBroken = false

    if (this._log.isDebugEnabled()) {
      this._log.debug(`created towards ${address}`)
    }
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
   * Send initialization message.
   * @param {string} userAgent the user agent for this driver.
   * @param {Object} authToken the object containing auth information.
   * @return {Promise<Connection>} promise resolved with the current connection if connection is successful. Rejected promise otherwise.
   */
  connect (userAgent, authToken) {
    return this._initialize(userAgent, authToken)
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
        onComplete: metadata => {
          if (metadata) {
            // read server version from the response metadata, if it is available
            const serverVersion = metadata.server
            if (!this.version || serverVersion) {
              this.version = serverVersion
            }

            // read database connection id from the response metadata, if it is available
            const dbConnectionId = metadata.connection_id
            if (!this.databaseId) {
              this.databaseId = dbConnectionId
            }

            if (metadata.hints) {
              const receiveTimeoutRaw =
                metadata.hints['connection.recv_timeout_seconds']
              if (
                receiveTimeoutRaw !== null &&
                receiveTimeoutRaw !== undefined
              ) {
                const receiveTimeoutInSeconds = toNumber(receiveTimeoutRaw)
                if (
                  Number.isInteger(receiveTimeoutInSeconds) &&
                  receiveTimeoutInSeconds > 0
                ) {
                  this._ch.setupReceiveTimeout(receiveTimeoutInSeconds * 1000)
                } else {
                  this._log.info(
                    `Server located at ${this._address} supplied an invalid connection receive timeout value (${receiveTimeoutInSeconds}). ` +
                      'Please, verify the server configuration and status because this can be the symptom of a bigger issue.'
                  )
                }
              }
            }
          }
          resolve(self)
        }
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

  get logger () {
    return this._log
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
    this._error = this.handleAndTransformError(
      this._protocol.currentFailure || error,
      this._address
    )

    if (this._log.isErrorEnabled()) {
      this._log.error(
        `experienced a fatal error caused by ${this._error} (${json.stringify(this._error)})`
      )
    }

    this._protocol.notifyFatalError(this._error)
  }

  /**
   * This method still here because it's used by the {@link PooledConnectionProvider}
   *
   * @param {any} observer
   */
  _queueObserver (observer) {
    return this._protocol.queueObserverIfProtocolIsNotBroken(observer)
  }

  hasOngoingObservableRequests () {
    return this._protocol.hasOngoingObservableRequests()
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
    if (!this.isOpen()) {
      return
    }

    this._protocol.reset({
      onError: () => {
        this._protocol.resetFailure()
      },
      onComplete: () => {
        this._protocol.resetFailure()
      }
    })
  }

  /*
   * Pop next pending observer form the list of observers and make it current observer.
   * @protected
   */
  _updateCurrentObserver () {
    this._protocol.updateCurrentObserver()
  }

  /** Check if this connection is in working condition */
  isOpen () {
    return !this._isBroken && this._ch._open
  }

  /**
   * Starts and stops the receive timeout timer.
   * @param {number} requestsNumber Ongoing requests number
   */
  _handleOngoingRequestsNumberChange(requestsNumber) {
    if (requestsNumber === 0) {
      this._ch.stopReceiveTimeout()
    } else {
      this._ch.startReceiveTimeout()
    }
  }

  /**
   * Call close on the channel.
   * @returns {Promise<void>} - A promise that will be resolved when the underlying channel is closed.
   */
  async close () {
    if (this._log.isDebugEnabled()) {
      this._log.debug('closing')
    }

    if (this._protocol && this.isOpen()) {
      // protocol has been initialized and this connection is healthy
      // notify the database about the upcoming close of the connection
      this._protocol.prepareToClose()
    }

    await this._ch.close()

    if (this._log.isDebugEnabled()) {
      this._log.debug('closed')
    }
  }

  toString () {
    return `Connection [${this.id}][${this.databaseId || ''}]`
  }

  _handleProtocolError (message) {
    this._protocol.resetFailure()
    this._updateCurrentObserver()
    const error = newError(message, PROTOCOL_ERROR)
    this._handleFatalError(error)
    return error
  }
}

/**
 * Creates a log with the connection info as prefix
 * @param {Connection} connection The connection
 * @param {Logger} logger The logger
 * @returns {Logger} The new logger with enriched messages
 */
function createConnectionLogger (connection, logger) {
  return new Logger(logger._level, (level, message) =>
    logger._loggerFunction(level, `${connection} ${message}`)
  )
}

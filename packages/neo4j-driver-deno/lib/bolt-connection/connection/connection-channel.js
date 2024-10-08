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

import { Chunker, Dechunker, ChannelConfig, Channel } from '../channel/index.js'
import { newError, error, json, internal, toNumber } from '../../core/index.ts'
import Connection from './connection.js'
import Bolt from '../bolt/index.js'

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
 * @param {clientCertificate} clientCertificate - configured client certificate
 * @return {Connection} - new connection.
 */
export function createChannelConnection (
  address,
  config,
  errorHandler,
  log,
  clientCertificate,
  serversideRouting = null,
  createChannel = channelConfig => new Channel(channelConfig)
) {
  const channelConfig = new ChannelConfig(
    address,
    config,
    errorHandler.errorCode(),
    clientCertificate
  )

  const channel = createChannel(channelConfig)

  return Bolt.handshake(channel, log)
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
            onObserversCountChange: conn._handleOngoingRequestsNumberChange.bind(conn),
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
        config.notificationFilter,
        createProtocol,
        config.telemetryDisabled
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
    notificationFilter,
    protocolSupplier,
    telemetryDisabled
  ) {
    super(errorHandler)
    this._authToken = null
    this._idle = false
    this._reseting = false
    this._resetObservers = []
    this._id = idGenerator++
    this._address = address
    this._server = { address: address.asHostPort() }
    this._creationTimestamp = Date.now()
    this._disableLosslessIntegers = disableLosslessIntegers
    this._ch = channel
    this._chunker = chunker
    this._log = createConnectionLogger(this, log)
    this._serversideRouting = serversideRouting
    this._notificationFilter = notificationFilter
    this._telemetryDisabledDriverConfig = telemetryDisabled === true
    this._telemetryDisabledConnection = true

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

  beginTransaction (config) {
    this._sendTelemetryIfEnabled(config)
    return this._protocol.beginTransaction(config)
  }

  run (query, parameters, config) {
    this._sendTelemetryIfEnabled(config)
    return this._protocol.run(query, parameters, config)
  }

  _sendTelemetryIfEnabled (config) {
    if (this._telemetryDisabledConnection ||
        this._telemetryDisabledDriverConfig ||
        config == null ||
        config.apiTelemetryConfig == null) {
      return
    }

    this._protocol.telemetry({
      api: config.apiTelemetryConfig.api
    }, {
      onCompleted: config.apiTelemetryConfig.onTelemetrySuccess,
      onError: config.beforeError
    })
  }

  commitTransaction (config) {
    return this._protocol.commitTransaction(config)
  }

  rollbackTransaction (config) {
    return this._protocol.rollbackTransaction(config)
  }

  getProtocolVersion () {
    return this._protocol.version
  }

  get authToken () {
    return this._authToken
  }

  set authToken (value) {
    this._authToken = value
  }

  get supportsReAuth () {
    return this._protocol.supportsReAuth
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

  set idleTimestamp (value) {
    this._idleTimestamp = value
  }

  get idleTimestamp () {
    return this._idleTimestamp
  }

  get creationTimestamp () {
    return this._creationTimestamp
  }

  /**
   * Send initialization message.
   * @param {string} userAgent the user agent for this driver.
   * @param {Object} boltAgent the bolt agent for this driver.
   * @param {Object} authToken the object containing auth information.
   * @param {boolean} waitReAuth whether ot not the connection will wait for re-authentication to happen
   * @return {Promise<Connection>} promise resolved with the current connection if connection is successful. Rejected promise otherwise.
   */
  async connect (userAgent, boltAgent, authToken, waitReAuth) {
    if (this._protocol.initialized && !this._protocol.supportsReAuth) {
      throw newError('Connection does not support re-auth')
    }

    this._authToken = authToken

    if (!this._protocol.initialized) {
      return await this._initialize(userAgent, boltAgent, authToken)
    }

    if (waitReAuth) {
      return await new Promise((resolve, reject) => {
        this._protocol.logoff({
          onError: reject
        })

        this._protocol.logon({
          authToken,
          onError: reject,
          onComplete: () => resolve(this),
          flush: true
        })
      })
    }

    this._protocol.logoff()
    this._protocol.logon({ authToken, flush: true })

    return this
  }

  /**
   * Perform protocol-specific initialization which includes authentication.
   * @param {string} userAgent the user agent for this driver.
   * @param {string} boltAgent the bolt agent for this driver.
   * @param {Object} authToken the object containing auth information.
   * @return {Promise<Connection>} promise resolved with the current connection if initialization is successful. Rejected promise otherwise.
   */
  _initialize (userAgent, boltAgent, authToken) {
    const self = this
    return new Promise((resolve, reject) => {
      this._protocol.initialize({
        userAgent,
        boltAgent,
        authToken,
        notificationFilter: this._notificationFilter,
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

              const telemetryEnabledHint = metadata.hints['telemetry.enabled']
              if (telemetryEnabledHint === true) {
                this._telemetryDisabledConnection = false
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
   * This method is used by the {@link PooledConnectionProvider}
   *
   * @param {any} observer
   */
  _setIdle (observer) {
    this._idle = true
    this._ch.stopReceiveTimeout()
    this._protocol.queueObserverIfProtocolIsNotBroken(observer)
  }

  /**
   * This method is used by the {@link PooledConnectionProvider}
   */
  _unsetIdle () {
    this._idle = false
    this._updateCurrentObserver()
  }

  /**
   * This method still here because of the connection-channel.tests.js
   *
   * @param {any} observer
   */
  _queueObserver (observer) {
    return this._protocol.queueObserverIfProtocolIsNotBroken(observer)
  }

  hasOngoingObservableRequests () {
    return !this._idle && this._protocol.hasOngoingObservableRequests()
  }

  /**
   * Send a RESET-message to the database. Message is immediately flushed to the network.
   * @return {Promise<void>} promise resolved when SUCCESS-message response arrives, or failed when other response messages arrives.
   */
  resetAndFlush () {
    return new Promise((resolve, reject) => {
      this._reset({
        onError: error => {
          if (this._isBroken) {
            // handling a fatal error, no need to raise a protocol violation
            reject(error)
          } else {
            const neo4jError = this._handleProtocolError(
              `Received FAILURE as a response for RESET: ${error}`
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

    this._reset({
      onError: () => {
        this._protocol.resetFailure()
      },
      onComplete: () => {
        this._protocol.resetFailure()
      }
    })
  }

  _reset (observer) {
    if (this._reseting) {
      if (!this._protocol.isLastMessageReset()) {
        this._protocol.reset({
          onError: error => {
            observer.onError(error)
          },
          onComplete: () => {
            observer.onComplete()
          }
        })
      } else {
        this._resetObservers.push(observer)
      }
      return
    }

    this._resetObservers.push(observer)
    this._reseting = true

    const notifyFinish = (notify) => {
      this._reseting = false
      const observers = this._resetObservers
      this._resetObservers = []
      observers.forEach(notify)
    }

    this._protocol.reset({
      onError: error => {
        notifyFinish(obs => obs.onError(error))
      },
      onComplete: () => {
        notifyFinish(obs => obs.onComplete())
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
  _handleOngoingRequestsNumberChange (requestsNumber) {
    if (this._idle) {
      return
    }
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

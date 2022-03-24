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
import net from 'net'
import tls from 'tls'
import fs from 'fs'
import ChannelBuffer from '../channel-buf'
import { newError, internal } from 'neo4j-driver-core'

const {
  util: { ENCRYPTION_OFF, ENCRYPTION_ON, isEmptyObjectOrNull }
} = internal

let _CONNECTION_IDGEN = 0

const TrustStrategy = {
  TRUST_CUSTOM_CA_SIGNED_CERTIFICATES: function (config, onSuccess, onFailure) {
    if (
      !config.trustedCertificates ||
      config.trustedCertificates.length === 0
    ) {
      onFailure(
        newError(
          'You are using TRUST_CUSTOM_CA_SIGNED_CERTIFICATES as the method ' +
            'to verify trust for encrypted  connections, but have not configured any ' +
            'trustedCertificates. You  must specify the path to at least one trusted ' +
            'X.509 certificate for this to work. Two other alternatives is to use ' +
            'TRUST_ALL_CERTIFICATES or to disable encryption by setting encrypted="' +
            ENCRYPTION_OFF +
            '"' +
            'in your driver configuration.'
        )
      )
      return
    }

    const tlsOpts = newTlsOptions(
      config.address.host(),
      config.trustedCertificates.map(f => fs.readFileSync(f))
    )
    const socket = tls.connect(
      config.address.port(),
      config.address.resolvedHost(),
      tlsOpts,
      function () {
        if (!socket.authorized) {
          onFailure(
            newError(
              'Server certificate is not trusted. If you trust the database you are connecting to, add' +
                ' the signing certificate, or the server certificate, to the list of certificates trusted by this driver' +
                " using `neo4j.driver(.., { trustedCertificates:['path/to/certificate.crt']}). This " +
                ' is a security measure to protect against man-in-the-middle attacks. If you are just trying ' +
                ' Neo4j out and are not concerned about encryption, simply disable it using `encrypted="' +
                ENCRYPTION_OFF +
                '"`' +
                ' in the driver options. Socket responded with: ' +
                socket.authorizationError
            )
          )
        } else {
          onSuccess()
        }
      }
    )
    socket.on('error', onFailure)
    return configureSocket(socket)
  },
  TRUST_SYSTEM_CA_SIGNED_CERTIFICATES: function (config, onSuccess, onFailure) {
    const tlsOpts = newTlsOptions(config.address.host())
    const socket = tls.connect(
      config.address.port(),
      config.address.resolvedHost(),
      tlsOpts,
      function () {
        if (!socket.authorized) {
          onFailure(
            newError(
              'Server certificate is not trusted. If you trust the database you are connecting to, use ' +
                'TRUST_CUSTOM_CA_SIGNED_CERTIFICATES and add' +
                ' the signing certificate, or the server certificate, to the list of certificates trusted by this driver' +
                " using `neo4j.driver(.., { trustedCertificates:['path/to/certificate.crt']}). This " +
                ' is a security measure to protect against man-in-the-middle attacks. If you are just trying ' +
                ' Neo4j out and are not concerned about encryption, simply disable it using `encrypted="' +
                ENCRYPTION_OFF +
                '"`' +
                ' in the driver options. Socket responded with: ' +
                socket.authorizationError
            )
          )
        } else {
          onSuccess()
        }
      }
    )
    socket.on('error', onFailure)
    return configureSocket(socket)
  },
  TRUST_ALL_CERTIFICATES: function (config, onSuccess, onFailure) {
    const tlsOpts = newTlsOptions(config.address.host())
    const socket = tls.connect(
      config.address.port(),
      config.address.resolvedHost(),
      tlsOpts,
      function () {
        const certificate = socket.getPeerCertificate()
        if (isEmptyObjectOrNull(certificate)) {
          onFailure(
            newError(
              'Secure connection was successful but server did not return any valid ' +
                'certificates. Such connection can not be trusted. If you are just trying ' +
                ' Neo4j out and are not concerned about encryption, simply disable it using ' +
                '`encrypted="' +
                ENCRYPTION_OFF +
                '"` in the driver options. ' +
                'Socket responded with: ' +
                socket.authorizationError
            )
          )
        } else {
          onSuccess()
        }
      }
    )
    socket.on('error', onFailure)
    return configureSocket(socket)
  }
}

/**
 * Connect using node socket.
 * @param {ChannelConfig} config - configuration of this channel.
 * @param {function} onSuccess - callback to execute on connection success.
 * @param {function} onFailure - callback to execute on connection failure.
 * @return {*} socket connection.
 */
function _connect (config, onSuccess, onFailure = () => null) {
  const trustStrategy = trustStrategyName(config)
  if (!isEncrypted(config)) {
    const socket = net.connect(
      config.address.port(),
      config.address.resolvedHost(),
      onSuccess
    )
    socket.on('error', onFailure)
    return configureSocket(socket)
  } else if (TrustStrategy[trustStrategy]) {
    return TrustStrategy[trustStrategy](config, onSuccess, onFailure)
  } else {
    onFailure(
      newError(
        'Unknown trust strategy: ' +
          config.trust +
          '. Please use either ' +
          "trust:'TRUST_CUSTOM_CA_SIGNED_CERTIFICATES' or trust:'TRUST_ALL_CERTIFICATES' in your driver " +
          'configuration. Alternatively, you can disable encryption by setting ' +
          '`encrypted:"' +
          ENCRYPTION_OFF +
          '"`. There is no mechanism to use encryption without trust verification, ' +
          'because this incurs the overhead of encryption without improving security. If ' +
          'the driver does not verify that the peer it is connected to is really Neo4j, it ' +
          'is very easy for an attacker to bypass the encryption by pretending to be Neo4j.'
      )
    )
  }
}

function isEncrypted (config) {
  const encryptionNotConfigured =
    config.encrypted == null || config.encrypted === undefined
  if (encryptionNotConfigured) {
    // default to using encryption if trust-all-certificates is available
    return false
  }
  return config.encrypted === true || config.encrypted === ENCRYPTION_ON
}

function trustStrategyName (config) {
  if (config.trust) {
    return config.trust
  }
  return 'TRUST_SYSTEM_CA_SIGNED_CERTIFICATES'
}

/**
 * Create a new configuration options object for the {@code tls.connect()} call.
 * @param {string} hostname the target hostname.
 * @param {string|undefined} ca an optional CA.
 * @return {Object} a new options object.
 */
function newTlsOptions (hostname, ca = undefined) {
  return {
    rejectUnauthorized: false, // we manually check for this in the connect callback, to give a more helpful error to the user
    servername: hostname, // server name for the SNI (Server Name Indication) TLS extension
    ca: ca // optional CA useful for TRUST_CUSTOM_CA_SIGNED_CERTIFICATES trust mode
  }
}

/**
 * Update socket options for the newly created socket. Accepts either `net.Socket` or its subclass `tls.TLSSocket`.
 * @param {net.Socket} socket the socket to configure.
 * @return {net.Socket} the given socket.
 */
function configureSocket (socket) {
  socket.setKeepAlive(true)
  return socket
}

/**
 * In a Node.js environment the 'net' module is used
 * as transport.
 * @access private
 */
export default class NodeChannel {
  /**
   * Create new instance
   * @param {ChannelConfig} config - configuration for this channel.
   */
  constructor (config, connect = _connect) {
    const self = this

    this.id = _CONNECTION_IDGEN++
    this._pending = []
    this._open = true
    this._error = null
    this._handleConnectionError = this._handleConnectionError.bind(this)
    this._handleConnectionTerminated = this._handleConnectionTerminated.bind(
      this
    )
    this._connectionErrorCode = config.connectionErrorCode
    this._receiveTimeout = null
    this._receiveTimeoutStarted = false

    this._conn = connect(
      config,
      () => {
        if (!self._open) {
          return
        }

        self._conn.on('data', buffer => {
          if (self.onmessage) {
            self.onmessage(new ChannelBuffer(buffer))
          }
        })

        self._conn.on('error', self._handleConnectionError)
        self._conn.on('end', self._handleConnectionTerminated)

        // Drain all pending messages
        const pending = self._pending
        self._pending = null
        for (let i = 0; i < pending.length; i++) {
          self.write(pending[i])
        }
      },
      this._handleConnectionError
    )

    this._setupConnectionTimeout(config, this._conn)
  }

  _handleConnectionError (err) {
    let msg =
      'Failed to connect to server. ' +
      'Please ensure that your database is listening on the correct host and port ' +
      'and that you have compatible encryption settings both on Neo4j server and driver. ' +
      'Note that the default encryption setting has changed in Neo4j 4.0.'
    if (err.message) msg += ' Caused by: ' + err.message
    this._error = newError(msg, this._connectionErrorCode)
    if (this.onerror) {
      this.onerror(this._error)
    }
  }

  _handleConnectionTerminated () {
    this._open = false
    this._error = newError(
      'Connection was closed by server',
      this._connectionErrorCode
    )
    if (this.onerror) {
      this.onerror(this._error)
    }
  }

  /**
   * Setup connection timeout on the socket, if configured.
   * @param {ChannelConfig} config - configuration of this channel.
   * @param {Object} socket - `net.Socket` or `tls.TLSSocket` object.
   * @private
   */
  _setupConnectionTimeout (config, socket) {
    const timeout = config.connectionTimeout
    if (timeout) {
      const connectListener = () => {
        // connected - clear connection timeout
        socket.setTimeout(0)
      }

      const timeoutListener = () => {
        // timeout fired - not connected within configured time. cancel timeout and destroy socket
        socket.setTimeout(0)
        socket.destroy(
          newError(
            `Failed to establish connection in ${timeout}ms`,
            config.connectionErrorCode
          )
        )
      }

      socket.on('connect', connectListener)
      socket.on('timeout', timeoutListener)

      this._removeConnectionTimeoutListeners = () => {
        this._conn.off('connect', connectListener)
        this._conn.off('timeout', timeoutListener)
      }

      socket.setTimeout(timeout)
    }
  }

  /**
   * Setup the receive timeout for the channel.
   *
   * @param {number} receiveTimeout How long the channel will wait for receiving data before timing out (ms)
   * @returns {void}
   */
  setupReceiveTimeout (receiveTimeout) {
    if (this._removeConnectionTimeoutListeners) {
      this._removeConnectionTimeoutListeners()
    }

    this._conn.on('timeout', () => {
      this._conn.destroy(
        newError(
          `Connection lost. Server didn't respond in ${receiveTimeout}ms`,
          this._connectionErrorCode
        )
      )
    })

    this._receiveTimeout = receiveTimeout
  }

  /**
   * Stops the receive timeout for the channel.
   */
  stopReceiveTimeout() {
    if (this._receiveTimeout !== null && this._receiveTimeoutStarted) {
      this._receiveTimeoutStarted = false
      this._conn.setTimeout(0)
    }
  }

  /**
   * Start the receive timeout for the channel.
   */
  startReceiveTimeout () {
    if (this._receiveTimeout !== null && !this._receiveTimeoutStarted) {
      this._receiveTimeoutStarted = true
      this._conn.setTimeout(this._receiveTimeout)
    }
  }

  /**
   * Write the passed in buffer to connection
   * @param {ChannelBuffer} buffer - Buffer to write
   */
  write (buffer) {
    // If there is a pending queue, push this on that queue. This means
    // we are not yet connected, so we queue things locally.
    if (this._pending !== null) {
      this._pending.push(buffer)
    } else if (buffer instanceof ChannelBuffer) {
      this._conn.write(buffer._buffer)
    } else {
      throw newError("Don't know how to write: " + buffer)
    }
  }

  /**
   * Close the connection
   * @returns {Promise} A promise that will be resolved after channel is closed
   */
  close () {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        if (!this._conn.destroyed) {
          this._conn.destroy()
        }

        resolve()
      }

      if (this._open) {
        this._open = false
        this._conn.removeListener('end', this._handleConnectionTerminated)
        this._conn.on('end', () => cleanup())
        this._conn.on('close', () => cleanup())
        this._conn.end()
        this._conn.destroy()
      } else {
        cleanup()
      }
    })
  }
}

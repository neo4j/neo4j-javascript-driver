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
/* eslint-disable */
import ChannelBuffer from '../channel-buf.js'
import { newError, internal } from '../../../core/index.ts'
import { iterateReader } from 'https://deno.land/std@0.157.0/streams/conversion.ts';

const {
  util: { ENCRYPTION_OFF, ENCRYPTION_ON }
} = internal

let _CONNECTION_IDGEN = 0
/**
 * Create a new DenoChannel to be used in Deno runtime.
 * @access private
 */
export default class DenoChannel {
  /**
   * Create new instance
   * @param {ChannelConfig} config - configuration for this channel.
   */
  constructor (
    config,
    connect = _connect
  ) {
    this.id = _CONNECTION_IDGEN++
    this._conn = null
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
    this._receiveTimeoutId = null

    this._config = config

    connect(config)
      .then(conn => {
        this._clearConnectionTimeout()
        if (!this._open) {
          return conn.close()
        }
        this._conn = conn

        setupReader(this)
          .catch(this._handleConnectionError)

        const pending = this._pending
        this._pending = null
        for (let i = 0; i < pending.length; i++) {
          this.write(pending[i])
        }
      })
      .catch(this._handleConnectionError)

    this._connectionTimeoutFired = false
    this._connectionTimeoutId = this._setupConnectionTimeout()
  }

  _setupConnectionTimeout () {
    const timeout = this._config.connectionTimeout
    if (timeout) {
      return setTimeout(() => {
        this._connectionTimeoutFired = true
        this.close()
          .then(e => this._handleConnectionError(newError(`Connection timeout after ${timeout} ms`)))
          .catch(this._handleConnectionError)
      }, timeout)
    }
    return null
  }

  /**
   * Remove active connection timeout, if any.
   * @private
   */
   _clearConnectionTimeout () {
    const timeoutId = this._connectionTimeoutId
    if (timeoutId !== null) {
      this._connectionTimeoutFired = false
      this._connectionTimeoutId = null
      clearTimeout(timeoutId)
    }
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
   * Write the passed in buffer to connection
   * @param {ChannelBuffer} buffer - Buffer to write
   */
  write (buffer) {
    if (this._pending !== null) {
      this._pending.push(buffer)
    } else if (buffer instanceof ChannelBuffer) {
      this._conn.write(buffer._buffer).catch(this._handleConnectionError)
    } else {
      throw newError("Don't know how to send buffer: " + buffer)
    }
  }

  /**
   * Close the connection
   * @returns {Promise} A promise that will be resolved after channel is closed
   */
  async close () {
    if (this._open) {
      this._open = false 
      this.stopReceiveTimeout()
      if (this._conn != null) {
        await this._conn.close()
      }
    }
  }

  /**
   * Setup the receive timeout for the channel.
   *
   * Not supported for the browser channel.
   *
   * @param {number} receiveTimeout The amount of time the channel will keep without receive any data before timeout (ms)
   * @returns {void}
   */
  setupReceiveTimeout (receiveTimeout) {
    this._receiveTimeout = receiveTimeout
  }

  /**
   * Stops the receive timeout for the channel.
   */
  stopReceiveTimeout () {
    if (this._receiveTimeout !== null && this._receiveTimeoutStarted) {
      this._receiveTimeoutStarted = false
      if (this._receiveTimeoutId != null) {
        clearTimeout(this._receiveTimeoutId)
      }
      this._receiveTimeoutId = null
    }
  }

  /**
   * Start the receive timeout for the channel.
   */
  startReceiveTimeout () {
    if (this._open && this._receiveTimeout !== null && !this._receiveTimeoutStarted) {
      this._receiveTimeoutStarted = true
      this._resetTimeout()
    }
  }

  _resetTimeout () {
    if (!this._receiveTimeoutStarted) {
      return
    }

    if (this._receiveTimeoutId !== null) {
      clearTimeout(this._receiveTimeoutId)
    }

    this._receiveTimeoutId = setTimeout(() => {
      this._receiveTimeoutId = null
      this.stopReceiveTimeout()
      this._error = newError(
        `Connection lost. Server didn't respond in ${this._receiveTimeout}ms`,
        this._config.connectionErrorCode
      )

      this.close()
        .catch(() => {
          // ignoring error during the close timeout connections since they
          // not valid 
        })
        .finally(() => {
          if (this.onerror) {
            this.onerror(this._error)
          }
        })
    }, this._receiveTimeout)
  }
}

const TrustStrategy = {
  TRUST_CUSTOM_CA_SIGNED_CERTIFICATES: async function (config) {
    if (
      !config.trustedCertificates ||
      config.trustedCertificates.length === 0
    ) {
      throw newError(
          'You are using TRUST_CUSTOM_CA_SIGNED_CERTIFICATES as the method ' +
            'to verify trust for encrypted  connections, but have not configured any ' +
            'trustedCertificates. You  must specify the path to at least one trusted ' +
            'X.509 certificate for this to work. Two other alternatives is to use ' +
            'TRUST_ALL_CERTIFICATES or to disable encryption by setting encrypted="' +
            ENCRYPTION_OFF +
            '"' +
            'in your driver configuration.'
      );
    }

    const caCerts = await Promise.all(
      config.trustedCertificates.map(f => Deno.readTextFile(f))
    )

    return Deno.connectTls({ 
      hostname: config.address.resolvedHost(), 
      port: config.address.port(),
      caCerts
    })
  },
  TRUST_SYSTEM_CA_SIGNED_CERTIFICATES: function (config) {
    return Deno.connectTls({ 
      hostname: config.address.resolvedHost(), 
      port: config.address.port()
    })
  },
  TRUST_ALL_CERTIFICATES: function (config) {
    throw newError(
      `"${config.trust}" is not available in DenoJS. ` +
      'For trust in any certificates, you should use the DenoJS flag ' +
      '"--unsafely-ignore-certificate-errors". '+ 
      'See, https://deno.com/blog/v1.13#disable-tls-verification'
    )
  }
}

async function _connect (config) {
  if (!isEncrypted(config)) {
    return Deno.connect({ 
      hostname: config.address.resolvedHost(), 
      port: config.address.port() 
    })
  }
  const trustStrategyName = getTrustStrategyName(config)
  const trustStrategy = TrustStrategy[trustStrategyName]

  if (trustStrategy != null) {
    return await trustStrategy(config)
  }
  
  throw newError(
    'Unknown trust strategy: ' +
    config.trust +
    '. Please use either ' +
    "trust:'TRUST_CUSTOM_CA_SIGNED_CERTIFICATES' configuration " +
    'or the System CA. ' +
    'Alternatively, you can disable encryption by setting ' +
    '`encrypted:"' +
    ENCRYPTION_OFF +
    '"`. There is no mechanism to use encryption without trust verification, ' +
    'because this incurs the overhead of encryption without improving security. If ' +
    'the driver does not verify that the peer it is connected to is really Neo4j, it ' +
    'is very easy for an attacker to bypass the encryption by pretending to be Neo4j.'

  )
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

function getTrustStrategyName (config) {
  if (config.trust) {
    return config.trust
  }
  return 'TRUST_SYSTEM_CA_SIGNED_CERTIFICATES'
}

async function setupReader (channel) {
  try {
    for await (const message of iterateReader(channel._conn)) {
      channel._resetTimeout()
  
      if (!channel._open) {
        return
      }
      if (channel.onmessage) {
        channel.onmessage(new ChannelBuffer(message))
      }
    }
    channel._handleConnectionTerminated()
  } catch (error) {
    if (channel._open) {
      channel._handleConnectionError(error)
    }
  }
}


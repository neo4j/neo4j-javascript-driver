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
/* eslint-env browser */
import ChannelBuffer from '../channel-buf.js'
import { newError, internal } from '../../../core/index.ts'

const {
  util: { ENCRYPTION_OFF, ENCRYPTION_ON }
} = internal

let _CONNECTION_IDGEN = 0
/**
 * Create a new DenoChannel to be used in web browsers.
 * @access private
 */
export default class DenoChannel {
  /**
   * Create new instance
   * @param {ChannelConfig} config - configuration for this channel.
   * @param {function(): string} protocolSupplier - function that detects protocol of the web page. Should only be used in tests.
   */
  constructor (
    config
  ) {
    this.id = _CONNECTION_IDGEN++
    this._conn = null
    this._pending = []
    this._error = null
    this._open = true
    this._config = config

    this._receiveTimeout = null
    this._receiveTimeoutStarted = false
    this._receiveTimeoutId = null

    this._connectionErrorCode = config.connectionErrorCode
    this._handleConnectionError = this._handleConnectionError.bind(this)
    this._handleConnectionTerminated = this._handleConnectionTerminated.bind(
      this
    )

    this._socketPromise =  Deno.connect({ 
      hostname: config.address.host(), 
      port: config.address.port() 
    })
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
      this._conn.write(buffer._buffer)
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
    if (this._receiveTimeout !== null && !this._receiveTimeoutStarted) {
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
      this._timedout = true
      this.stopReceiveTimeout()
      this._error = newError(
        `Connection lost. Server didn't respond in ${this._receiveTimeout}ms`,
        this._config.connectionErrorCode
      )

      this.close()
      if (this.onerror) {
        this.onerror(this._error)
      }
    }, this._receiveTimeout)
  }
}

async function setupReader (channel) {
  try {
    for await (const message of Deno.iter(channel._conn)) {
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

/**
 * @param {ChannelConfig} config - configuration for the channel.
 * @return {boolean} `true` if encryption enabled in the config, `false` otherwise.
 */
function isEncryptionExplicitlyTurnedOn (config) {
  return config.encrypted === true || config.encrypted === ENCRYPTION_ON
}

/**
 * @param {ChannelConfig} config - configuration for the channel.
 * @return {boolean} `true` if encryption disabled in the config, `false` otherwise.
 */
function isEncryptionExplicitlyTurnedOff (config) {
  return config.encrypted === false || config.encrypted === ENCRYPTION_OFF
}

/**
 * @param {function(): string} protocolSupplier - function that detects protocol of the web page.
 * @return {boolean} `true` if protocol returned by the given function is secure, `false` otherwise.
 */
function isProtocolSecure (protocolSupplier) {
  const protocol =
    typeof protocolSupplier === 'function' ? protocolSupplier() : ''
  return protocol && protocol.toLowerCase().indexOf('https') >= 0
}

function verifyEncryptionSettings (encryptionOn, encryptionOff, secureProtocol) {
  if (secureProtocol === null) {
    // do nothing sice the protocol could not be identified
  } else if (encryptionOn && !secureProtocol) {
    // encryption explicitly turned on for a driver used on a HTTP web page
    console.warn(
      'Neo4j driver is configured to use secure WebSocket on a HTTP web page. ' +
        'WebSockets might not work in a mixed content environment. ' +
        'Please consider configuring driver to not use encryption.'
    )
  } else if (encryptionOff && secureProtocol) {
    // encryption explicitly turned off for a driver used on a HTTPS web page
    console.warn(
      'Neo4j driver is configured to use insecure WebSocket on a HTTPS web page. ' +
        'WebSockets might not work in a mixed content environment. ' +
        'Please consider configuring driver to use encryption.'
    )
  }
}

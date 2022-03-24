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

import ChannelBuffer from '../channel-buf'
import { newError, internal } from 'neo4j-driver-core'

const {
  util: { ENCRYPTION_OFF, ENCRYPTION_ON }
} = internal

// Just to be sure that these values are with us even after WebSocket is injected
// for tests.
const WS_CONNECTING = 0
const WS_OPEN = 1
const WS_CLOSING = 2
const WS_CLOSED = 3

/**
 * Create a new WebSocketChannel to be used in web browsers.
 * @access private
 */
export default class WebSocketChannel {
  /**
   * Create new instance
   * @param {ChannelConfig} config - configuration for this channel.
   * @param {function(): string} protocolSupplier - function that detects protocol of the web page. Should only be used in tests.
   */
  constructor (
    config,
    protocolSupplier = detectWebPageProtocol,
    socketFactory = url => new WebSocket(url)
  ) {
    this._open = true
    this._pending = []
    this._error = null
    this._handleConnectionError = this._handleConnectionError.bind(this)
    this._config = config

    const { scheme, error } = determineWebSocketScheme(config, protocolSupplier)
    if (error) {
      this._error = error
      return
    }

    this._ws = createWebSocket(scheme, config.address, socketFactory)
    this._ws.binaryType = 'arraybuffer'

    const self = this
    // All connection errors are not sent to the error handler
    // we must also check for dirty close calls
    this._ws.onclose = function (e) {
      if (e && !e.wasClean) {
        self._handleConnectionError()
      }
      self._open = false
    }
    this._ws.onopen = function () {
      // Connected! Cancel the connection timeout
      self._clearConnectionTimeout()

      // Drain all pending messages
      const pending = self._pending
      self._pending = null
      for (let i = 0; i < pending.length; i++) {
        self.write(pending[i])
      }
    }
    this._ws.onmessage = event => {
      if (self.onmessage) {
        const b = new ChannelBuffer(event.data)
        self.onmessage(b)
      }
    }

    this._ws.onerror = this._handleConnectionError

    this._connectionTimeoutFired = false
    this._connectionTimeoutId = this._setupConnectionTimeout()
  }

  _handleConnectionError () {
    if (this._connectionTimeoutFired) {
      // timeout fired - not connected within configured time
      this._error = newError(
        `Failed to establish connection in ${this._config.connectionTimeout}ms`,
        this._config.connectionErrorCode
      )

      if (this.onerror) {
        this.onerror(this._error)
      }
      return
    }

    // onerror triggers on websocket close as well.. don't get me started.
    if (this._open) {
      // http://stackoverflow.com/questions/25779831/how-to-catch-websocket-connection-to-ws-xxxnn-failed-connection-closed-be
      this._error = newError(
        'WebSocket connection failure. Due to security ' +
          'constraints in your web browser, the reason for the failure is not available ' +
          'to this Neo4j Driver. Please use your browsers development console to determine ' +
          'the root cause of the failure. Common reasons include the database being ' +
          'unavailable, using the wrong connection URL or temporary network problems. ' +
          'If you have enabled encryption, ensure your browser is configured to trust the ' +
          'certificate Neo4j is configured to use. WebSocket `readyState` is: ' +
          this._ws.readyState,
        this._config.connectionErrorCode
      )
      if (this.onerror) {
        this.onerror(this._error)
      }
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
      try {
        this._ws.send(buffer._buffer)
      } catch (error) {
        if (this._ws.readyState !== WS_OPEN) {
          // Websocket has been closed
          this._handleConnectionError()
        } else {
          // Some other error occured
          throw error
        }
      }
    } else {
      throw newError("Don't know how to send buffer: " + buffer)
    }
  }

  /**
   * Close the connection
   * @returns {Promise} A promise that will be resolved after channel is closed
   */
  close () {
    return new Promise((resolve, reject) => {
      if (this._ws && this._ws.readyState !== WS_CLOSED) {
        this._open = false
        this._clearConnectionTimeout()
        this._ws.onclose = () => resolve()
        this._ws.close()
      } else {
        resolve()
      }
    })
  }

  /**
   * Setup the receive timeout for the channel.
   *
   * Not supported for the browser channel.
   *
   * @param {number} receiveTimeout The amount of time the channel will keep without receive any data before timeout (ms)
   * @returns {void}
   */
  setupReceiveTimeout (receiveTimeout) {}

  /**
   * Stops the receive timeout for the channel.
   */
  stopReceiveTimeout() {
  }

  /**
   * Start the receive timeout for the channel.
   */
  startReceiveTimeout () {
  }

  /**
   * Set connection timeout on the given WebSocket, if configured.
   * @return {number} the timeout id or null.
   * @private
   */
  _setupConnectionTimeout () {
    const timeout = this._config.connectionTimeout
    if (timeout) {
      const webSocket = this._ws

      return setTimeout(() => {
        if (webSocket.readyState !== WS_OPEN) {
          this._connectionTimeoutFired = true
          webSocket.close()
        }
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
    if (timeoutId || timeoutId === 0) {
      this._connectionTimeoutFired = false
      this._connectionTimeoutId = null
      clearTimeout(timeoutId)
    }
  }
}

function createWebSocket (scheme, address, socketFactory) {
  const url = scheme + '://' + address.asHostPort()

  try {
    return socketFactory(url)
  } catch (error) {
    if (isIPv6AddressIssueOnWindows(error, address)) {
      // WebSocket in IE and Edge browsers on Windows do not support regular IPv6 address syntax because they contain ':'.
      // It's an invalid character for UNC (https://en.wikipedia.org/wiki/IPv6_address#Literal_IPv6_addresses_in_UNC_path_names)
      // and Windows requires IPv6 to be changes in the following way:
      //   1) replace all ':' with '-'
      //   2) replace '%' with 's' for link-local address
      //   3) append '.ipv6-literal.net' suffix
      // only then resulting string can be considered a valid IPv6 address. Yes, this is extremely weird!
      // For more details see:
      //   https://social.msdn.microsoft.com/Forums/ie/en-US/06cca73b-63c2-4bf9-899b-b229c50449ff/whether-ie10-websocket-support-ipv6?forum=iewebdevelopment
      //   https://www.itdojo.com/ipv6-addresses-and-unc-path-names-overcoming-illegal/
      // Creation of WebSocket with unconverted address results in SyntaxError without message or stacktrace.
      // That is why here we "catch" SyntaxError and rewrite IPv6 address if needed.

      const windowsFriendlyUrl = asWindowsFriendlyIPv6Address(scheme, address)
      return socketFactory(windowsFriendlyUrl)
    } else {
      throw error
    }
  }
}

function isIPv6AddressIssueOnWindows (error, address) {
  return error.name === 'SyntaxError' && isIPv6Address(address.asHostPort())
}

function isIPv6Address (hostAndPort) {
  return hostAndPort.charAt(0) === '[' && hostAndPort.indexOf(']') !== -1
}

function asWindowsFriendlyIPv6Address (scheme, address) {
  // replace all ':' with '-'
  const hostWithoutColons = address.host().replace(new RegExp(':', 'g'), '-')

  // replace '%' with 's' for link-local IPv6 address like 'fe80::1%lo0'
  const hostWithoutPercent = hostWithoutColons.replace('%', 's')

  // append magic '.ipv6-literal.net' suffix
  const ipv6Host = hostWithoutPercent + '.ipv6-literal.net'

  return `${scheme}://${ipv6Host}:${address.port()}`
}

/**
 * @param {ChannelConfig} config - configuration for the channel.
 * @param {function(): string} protocolSupplier - function that detects protocol of the web page.
 * @return {{scheme: string|null, error: Neo4jError|null}} object containing either scheme or error.
 */
function determineWebSocketScheme (config, protocolSupplier) {
  const encryptionOn = isEncryptionExplicitlyTurnedOn(config)
  const encryptionOff = isEncryptionExplicitlyTurnedOff(config)
  const trust = config.trust
  const secureProtocol = isProtocolSecure(protocolSupplier)
  verifyEncryptionSettings(encryptionOn, encryptionOff, secureProtocol)

  if (encryptionOff) {
    // encryption explicitly turned off in the config
    return { scheme: 'ws', error: null }
  }

  if (secureProtocol) {
    // driver is used in a secure https web page, use 'wss'
    return { scheme: 'wss', error: null }
  }

  if (encryptionOn) {
    // encryption explicitly requested in the config
    if (!trust || trust === 'TRUST_SYSTEM_CA_SIGNED_CERTIFICATES') {
      // trust strategy not specified or the only supported strategy is specified
      return { scheme: 'wss', error: null }
    } else {
      const error = newError(
        'The browser version of this driver only supports one trust ' +
          "strategy, 'TRUST_SYSTEM_CA_SIGNED_CERTIFICATES'. " +
          trust +
          ' is not supported. Please ' +
          'either use TRUST_SYSTEM_CA_SIGNED_CERTIFICATES or disable encryption by setting ' +
          '`encrypted:"' +
          ENCRYPTION_OFF +
          '"` in the driver configuration.'
      )
      return { scheme: null, error: error }
    }
  }

  // default to unencrypted web socket
  return { scheme: 'ws', error: null }
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

function detectWebPageProtocol () {
  return typeof window !== 'undefined' && window.location
    ? window.location.protocol
    : null
}

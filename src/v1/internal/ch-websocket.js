/**
 * Copyright (c) 2002-2018 "Neo4j,"
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

import {HeapBuffer} from './buf';
import {newError} from './../error';
import {ENCRYPTION_OFF, ENCRYPTION_ON} from './util';

/**
 * Create a new WebSocketChannel to be used in web browsers.
 * @access private
 */
class WebSocketChannel {

  /**
   * Create new instance
   * @param {ChannelConfig} config - configuration for this channel.
   * @param {function(): string} protocolSupplier - function that detects protocol of the web page. Should only be used in tests.
   */
  constructor(config, protocolSupplier = detectWebPageProtocol) {

    this._open = true;
    this._pending = [];
    this._error = null;
    this._handleConnectionError = this._handleConnectionError.bind(this);
    this._config = config;

    const {scheme, error} = determineWebSocketScheme(config, protocolSupplier);
    if (error) {
      this._error = error;
      return;
    }

    this._ws = createWebSocket(scheme, config.url);
    this._ws.binaryType = "arraybuffer";

    let self = this;
    //All connection errors are not sent to the error handler
    //we must also check for dirty close calls
    this._ws.onclose = function(e) {
        if (!e.wasClean) {
          self._handleConnectionError();
        }
    };
    this._ws.onopen = function() {
      // Connected! Cancel the connection timeout
      self._clearConnectionTimeout();

      // Drain all pending messages
      let pending = self._pending;
      self._pending = null;
      for (let i = 0; i < pending.length; i++) {
        self.write( pending[i] );
      }
    };
    this._ws.onmessage = (event) => {
      if( self.onmessage ) {
        const b = new HeapBuffer(event.data);
        self.onmessage( b );
      }
    };

    this._ws.onerror = this._handleConnectionError;

    this._connectionTimeoutFired = false;
    this._connectionTimeoutId = this._setupConnectionTimeout();
  }

  _handleConnectionError() {
    if (this._connectionTimeoutFired) {
      // timeout fired - not connected within configured time
      this._error = newError(`Failed to establish connection in ${this._config.connectionTimeout}ms`, this._config.connectionErrorCode);

      if (this.onerror) {
        this.onerror(this._error);
      }
      return;
    }

    // onerror triggers on websocket close as well.. don't get me started.
    if( this._open ) {
      // http://stackoverflow.com/questions/25779831/how-to-catch-websocket-connection-to-ws-xxxnn-failed-connection-closed-be
      this._error = newError( "WebSocket connection failure. Due to security " +
        "constraints in your web browser, the reason for the failure is not available " +
        "to this Neo4j Driver. Please use your browsers development console to determine " +
        "the root cause of the failure. Common reasons include the database being " +
        "unavailable, using the wrong connection URL or temporary network problems. " +
        "If you have enabled encryption, ensure your browser is configured to trust the " +
        'certificate Neo4j is configured to use. WebSocket `readyState` is: ' + this._ws.readyState, this._config.connectionErrorCode);
      if (this.onerror) {
        this.onerror(this._error);
      }
    }
  }

  /**
   * Write the passed in buffer to connection
   * @param {HeapBuffer} buffer - Buffer to write
   */
  write ( buffer ) {
    // If there is a pending queue, push this on that queue. This means
    // we are not yet connected, so we queue things locally.
    if( this._pending !== null ) {
      this._pending.push( buffer );
    } else if( buffer instanceof HeapBuffer ) {
      this._ws.send( buffer._buffer );
    } else {
      throw newError( "Don't know how to send buffer: " + buffer );
    }
  }

  /**
   * Close the connection
   * @param {function} cb - Function to call on close.
   */
  close ( cb = ( () => null )) {
    this._open = false;
    this._clearConnectionTimeout();
    this._ws.close();
    this._ws.onclose = cb;
  }

  /**
   * Set connection timeout on the given WebSocket, if configured.
   * @return {number} the timeout id or null.
   * @private
   */
  _setupConnectionTimeout() {
    const timeout = this._config.connectionTimeout;
    if (timeout) {
      const webSocket = this._ws;

      return setTimeout(() => {
        if (webSocket.readyState !== WebSocket.OPEN) {
          this._connectionTimeoutFired = true;
          webSocket.close();
        }
      }, timeout);
    }
    return null;
  }

  /**
   * Remove active connection timeout, if any.
   * @private
   */
  _clearConnectionTimeout() {
    const timeoutId = this._connectionTimeoutId;
    if (timeoutId || timeoutId === 0) {
      this._connectionTimeoutFired = false;
      this._connectionTimeoutId = null;
      clearTimeout(timeoutId);
    }
  }
}

let available = typeof WebSocket !== 'undefined';
let _websocketChannelModule = {channel: WebSocketChannel, available: available};

function createWebSocket(scheme, parsedUrl) {
  const url = scheme + '://' + parsedUrl.hostAndPort;

  try {
    return new WebSocket(url);
  } catch (error) {
    if (isIPv6AddressIssueOnWindows(error, parsedUrl)) {

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

      const windowsFriendlyUrl = asWindowsFriendlyIPv6Address(scheme, parsedUrl);
      return new WebSocket(windowsFriendlyUrl);
    } else {
      throw error;
    }
  }
}

function isIPv6AddressIssueOnWindows(error, parsedUrl) {
  return error.name === 'SyntaxError' && isIPv6Address(parsedUrl);
}

function isIPv6Address(parsedUrl) {
  const hostAndPort = parsedUrl.hostAndPort;
  return hostAndPort.charAt(0) === '[' && hostAndPort.indexOf(']') !== -1;
}

function asWindowsFriendlyIPv6Address(scheme, parsedUrl) {
  // replace all ':' with '-'
  const hostWithoutColons = parsedUrl.host.replace(new RegExp(':', 'g'), '-');

  // replace '%' with 's' for link-local IPv6 address like 'fe80::1%lo0'
  const hostWithoutPercent = hostWithoutColons.replace('%', 's');

  // append magic '.ipv6-literal.net' suffix
  const ipv6Host = hostWithoutPercent + '.ipv6-literal.net';

  return `${scheme}://${ipv6Host}:${parsedUrl.port}`;
}

/**
 * @param {ChannelConfig} config - configuration for the channel.
 * @param {function(): string} protocolSupplier - function that detects protocol of the web page.
 * @return {{scheme: string|null, error: Neo4jError|null}} object containing either scheme or error.
 */
function determineWebSocketScheme(config, protocolSupplier) {
  const encryptionOn = isEncryptionExplicitlyTurnedOn(config);
  const encryptionOff = isEncryptionExplicitlyTurnedOff(config);
  const trust = config.trust;
  const secureProtocol = isProtocolSecure(protocolSupplier);
  verifyEncryptionSettings(encryptionOn, encryptionOff, secureProtocol);

  if (encryptionOff) {
    // encryption explicitly turned off in the config
    return {scheme: 'ws', error: null};
  }

  if (secureProtocol) {
    // driver is used in a secure https web page, use 'wss'
    return {scheme: 'wss', error: null};
  }

  if (encryptionOn) {
    // encryption explicitly requested in the config
    if (!trust || trust === 'TRUST_CUSTOM_CA_SIGNED_CERTIFICATES') {
      // trust strategy not specified or the only supported strategy is specified
      return {scheme: 'wss', error: null};
    } else {
      const error = newError('The browser version of this driver only supports one trust ' +
        'strategy, \'TRUST_CUSTOM_CA_SIGNED_CERTIFICATES\'. ' + trust + ' is not supported. Please ' +
        'either use TRUST_CUSTOM_CA_SIGNED_CERTIFICATES or disable encryption by setting ' +
        '`encrypted:"' + ENCRYPTION_OFF + '"` in the driver configuration.');
      return {scheme: null, error: error};
    }
  }

  // default to unencrypted web socket
  return {scheme: 'ws', error: null};
}

/**
 * @param {ChannelConfig} config - configuration for the channel.
 * @return {boolean} <code>true</code> if encryption enabled in the config, <code>false</code> otherwise.
 */
function isEncryptionExplicitlyTurnedOn(config) {
  return config.encrypted === true || config.encrypted === ENCRYPTION_ON;
}

/**
 * @param {ChannelConfig} config - configuration for the channel.
 * @return {boolean} <code>true</code> if encryption disabled in the config, <code>false</code> otherwise.
 */
function isEncryptionExplicitlyTurnedOff(config) {
  return config.encrypted === false || config.encrypted === ENCRYPTION_OFF;
}

/**
 * @param {function(): string} protocolSupplier - function that detects protocol of the web page.
 * @return {boolean} <code>true</code> if protocol returned by the given function is secure, <code>false</code> otherwise.
 */
function isProtocolSecure(protocolSupplier) {
  const protocol = typeof protocolSupplier === 'function' ? protocolSupplier() : '';
  return protocol && protocol.toLowerCase().indexOf('https') >= 0;
}

function verifyEncryptionSettings(encryptionOn, encryptionOff, secureProtocol) {
  if (encryptionOn && !secureProtocol) {
    // encryption explicitly turned on for a driver used on a HTTP web page
    console.warn('Neo4j driver is configured to use secure WebSocket on a HTTP web page. ' +
      'WebSockets might not work in a mixed content environment. ' +
      'Please consider configuring driver to not use encryption.');
  } else if (encryptionOff && secureProtocol) {
    // encryption explicitly turned off for a driver used on a HTTPS web page
    console.warn('Neo4j driver is configured to use insecure WebSocket on a HTTPS web page. ' +
      'WebSockets might not work in a mixed content environment. ' +
      'Please consider configuring driver to use encryption.');
  }
}

function detectWebPageProtocol() {
  return window && window.location ? window.location.protocol : null;
}

export default _websocketChannelModule

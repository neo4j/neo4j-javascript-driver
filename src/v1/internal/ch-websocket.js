/**
 * Copyright (c) 2002-2016 "Neo Technology,"
 * Network Engine for Objects in Lund AB [http://neotechnology.com]
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
 
import {debug} from "./log";
import {HeapBuffer} from "./buf";
import {newError} from './../error';

/**
 * Create a new WebSocketChannel to be used in web browsers.
 * @access private
 */
class WebSocketChannel {

  /**
   * Create new instance
   * @param {Object} opts - Options object
   * @param {string} opts.host - The host, including protocol to connect to.
   * @param {Integer} opts.port - The port to use.
   */
  constructor (opts) {

    this._open = true;
    this._pending = [];
    this._error = null;
    this._handleConnectionError = this._handleConnectionError.bind(this);

    let scheme = "ws";
    if( opts.encrypted ) {
      if( (!opts.trust) || opts.trust === "TRUST_SIGNED_CERTIFICATES" ) {
        scheme = "wss";
      } else {
        this._error = newError("The browser version of this driver only supports one trust " +
          "strategy, 'TRUST_SIGNED_CERTIFICATES'. "+opts.trust+" is not supported. Please " +
          "either use TRUST_SIGNED_CERTIFICATES or disable encryption by setting " +
          "`encrypted:false` in the driver configuration.");
        return;
      }
    }
    this._url = scheme + "://" + opts.host + ":" + opts.port;
    this._ws = new WebSocket(this._url);
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
      // Drain all pending messages
      let pending = self._pending;
      self._pending = null;
      for (let i = 0; i < pending.length; i++) {
        self.write( pending[i] );
      }
    };
    this._ws.onmessage = (event) => {
      if( self.onmessage ) {
        var b = new HeapBuffer( event.data );
        self.onmessage( b );
      } 
    };

    this._ws.onerror = this._handleConnectionError;
  }

  _handleConnectionError() {
    // onerror triggers on websocket close as well.. don't get me started.
    if( this._open ) {
      // http://stackoverflow.com/questions/25779831/how-to-catch-websocket-connection-to-ws-xxxnn-failed-connection-closed-be
      this._error = newError( "WebSocket connection failure. Due to security " +
        "constraints in your web browser, the reason for the failure is not available " +
        "to this Neo4j Driver. Please use your browsers development console to determine " +
        "the root cause of the failure. Common reasons include the database being " +
        "unavailable, using the wrong connection URL or temporary network problems. " +
        "If you have enabled encryption, ensure your browser is configured to trust the " +
        "certificate Neo4j is configured to use. WebSocket `readyState` is: " + this._ws.readyState );
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
    this._ws.close();
    this._ws.onclose = cb;
  }
}

let available = typeof WebSocket !== 'undefined';
let _websocketChannelModule = {channel: WebSocketChannel, available: available};

export default _websocketChannelModule

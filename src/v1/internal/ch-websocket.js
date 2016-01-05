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
    this._url = "ws:" + opts.host + ":" + (opts.port || 7687);
    this._ws = new WebSocket(this._url);
    this._ws.binaryType = "arraybuffer";
    this._open = true;
    this._pending = [];

    let self = this;
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
      throw new Error( "Don't know how to send buffer: " + buffer );
    }
  }

  /**
   * Close the connection
   * @param {function} cb - Function to call on close.
   */
  close ( cb ) {
    if(cb) {
      this._ws.onclose(cb);
    }
    this._open = false;
    this._ws.close();
  }
}

let available = typeof WebSocket !== 'undefined';
let _websocketChannelModule = {channel: WebSocketChannel, available: available};

export default _websocketChannelModule

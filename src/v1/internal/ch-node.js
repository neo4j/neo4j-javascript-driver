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
 
import net from 'net';
import {NodeBuffer} from './buf';

let _CONNECTION_IDGEN = 0;

/**
  * In a Node.js environment the 'net' module is used
  * as transport.
  * @access private
  */

class NodeChannel {

  /**
   * Create new instance
   * @param {Object} opts - Options object
   * @param {string} opts.host - The host, including protocol to connect to.
   * @param {Integer} opts.port - The port to use.
   */
  constructor (opts) {
    let _self = this;

    this.id = _CONNECTION_IDGEN++;
    this.available = true;
    this._pending = [];
    this._open = true;
    this._conn = net.connect((opts.port || 7687), opts.host, () => {
      if(!_self._open) {
        return;
      }
      // Drain all pending messages
      let pending = _self._pending;
      _self._pending = null;
      for (let i = 0; i < pending.length; i++) {
        _self.write( pending[i] );
      }
    });

    this._conn.on('data', ( buffer ) => {
      if( _self.onmessage ) {
        _self.onmessage( new NodeBuffer( buffer ) );
      }
    });
  }
  
  /**
   * Write the passed in buffer to connection
   * @param {NodeBuffer} buffer - Buffer to write
   */
  write ( buffer ) {
    // If there is a pending queue, push this on that queue. This means
    // we are not yet connected, so we queue things locally.
    if( this._pending !== null ) {
      this._pending.push( buffer );
    } else if( buffer instanceof NodeBuffer ) {
      // console.log( "[Conn#"+this.id+"] SEND: ", buffer.toString() );
      this._conn.write( buffer._buffer );
    } else {
      throw new Error( "Don't know how to write: " + buffer );
    }
  }

  /**
   * Close the connection
   * @param {function} cb - Function to call on close.
   */
  close(cb) {
    if(cb) {
      this._conn.on('end', cb);
    }
    this._open = false;
    this._conn.end();
  }
}
let _nodeChannelModule = {channel: NodeChannel, available: true};

try {
  // Only define this module if 'net' is available
  require.resolve("net");
} catch(e) {
  _nodeChannelModule = { available : false };
}

export default _nodeChannelModule

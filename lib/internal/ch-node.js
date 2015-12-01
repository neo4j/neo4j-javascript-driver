/**
 * Copyright (c) 2002-2015 "Neo Technology,"
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

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _net = require('net');

var _net2 = _interopRequireDefault(_net);

var _buf = require('./buf');

var _CONNECTION_IDGEN = 0;

/**
  * In a Node.js environment the 'net' module is used
  * as transport.
  * @access private
  */

var NodeChannel = (function () {

  /**
   * Create new instance
   * @param {Object} opts - Options object
   * @param {string} opts.host - The host, including protocol to connect to.
   * @param {Integer} opts.port - The port to use.
   */

  function NodeChannel(opts) {
    _classCallCheck(this, NodeChannel);

    var _self = this;

    this.id = _CONNECTION_IDGEN++;
    this.available = true;
    this._pending = [];
    this._open = true;
    this._conn = _net2['default'].connect(opts.port || 7687, opts.host, function () {
      if (!_self._open) {
        return;
      }
      // Drain all pending messages
      var pending = _self._pending;
      _self._pending = null;
      for (var i = 0; i < pending.length; i++) {
        _self.write(pending[i]);
      }
    });

    this._conn.on('data', function (buffer) {
      if (_self.onmessage) {
        _self.onmessage(new _buf.NodeBuffer(buffer));
      }
    });
  }

  /**
   * Write the passed in buffer to connection
   * @param {NodeBuffer} buffer - Buffer to write
   */

  _createClass(NodeChannel, [{
    key: 'write',
    value: function write(buffer) {
      // If there is a pending queue, push this on that queue. This means
      // we are not yet connected, so we queue things locally.
      if (this._pending !== null) {
        this._pending.push(buffer);
      } else if (buffer instanceof _buf.NodeBuffer) {
        // console.log( "[Conn#"+this.id+"] SEND: ", buffer.toString() );
        this._conn.write(buffer._buffer);
      } else {
        throw new Error("Don't know how to write: " + buffer);
      }
    }

    /**
     * Close the connection
     * @param {function} cb - Function to call on close.
     */
  }, {
    key: 'close',
    value: function close(cb) {
      if (cb) {
        this._conn.on('end', cb);
      }
      this._open = false;
      this._conn.end();
    }
  }]);

  return NodeChannel;
})();

var _nodeChannelModule = { channel: NodeChannel, available: true };

try {
  // Only define this module if 'net' is available
  require.resolve("net");
} catch (e) {
  _nodeChannelModule = { available: false };
}

exports['default'] = _nodeChannelModule;
module.exports = exports['default'];
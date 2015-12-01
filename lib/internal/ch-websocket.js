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

"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _log = require("./log");

var _buf = require("./buf");

/**
 * Create a new WebSocketChannel to be used in web browsers.
 * @access private
 */

var WebSocketChannel = (function () {

  /**
   * Create new instance
   * @param {Object} opts - Options object
   * @param {string} opts.host - The host, including protocol to connect to.
   * @param {Integer} opts.port - The port to use.
   */

  function WebSocketChannel(opts) {
    _classCallCheck(this, WebSocketChannel);

    this._url = "ws:" + opts.host + ":" + (opts.port || 7688);
    this._ws = new WebSocket(this._url);
    this._ws.binaryType = "arraybuffer";
    this._open = true;
    this._pending = [];

    var self = this;
    this._ws.onopen = function () {
      // Drain all pending messages
      var pending = self._pending;
      self._pending = null;
      for (var i = 0; i < pending.length; i++) {
        self.write(pending[i]);
      }
    };
    this._ws.onmessage = function (event) {
      if (self.onmessage) {
        var b = new _buf.HeapBuffer(event.data);
        self.onmessage(b);
      }
    };
  }

  /**
   * Write the passed in buffer to connection
   * @param {HeapBuffer} buffer - Buffer to write
   */

  _createClass(WebSocketChannel, [{
    key: "write",
    value: function write(buffer) {
      // If there is a pending queue, push this on that queue. This means
      // we are not yet connected, so we queue things locally.
      if (this._pending !== null) {
        this._pending.push(buffer);
      } else if (buffer instanceof _buf.HeapBuffer) {
        this._ws.send(buffer._buffer);
      } else {
        throw new Error("Don't know how to send buffer: " + buffer);
      }
    }

    /**
     * Close the connection
     * @param {function} cb - Function to call on close.
     */
  }, {
    key: "close",
    value: function close(cb) {
      if (cb) {
        this._ws.onclose(cb);
      }
      this._open = false;
      this._ws.close();
    }
  }]);

  return WebSocketChannel;
})();

var available = typeof WebSocket !== 'undefined';
var _websocketChannelModule = { channel: WebSocketChannel, available: available };

exports["default"] = _websocketChannelModule;
module.exports = exports["default"];
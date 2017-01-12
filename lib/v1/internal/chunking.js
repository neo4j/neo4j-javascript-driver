'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Dechunker = exports.Chunker = undefined;

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _buf = require('./buf');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _CHUNK_HEADER_SIZE = 2,
    _MESSAGE_BOUNDARY = 0x00,
    _DEFAULT_BUFFER_SIZE = 1400; // http://stackoverflow.com/questions/2613734/maximum-packet-size-for-a-tcp-connection

/**
 * Looks like a writable buffer, chunks output transparently into a channel below.
 * @access private
 */
/**
 * Copyright (c) 2002-2017 "Neo Technology,","
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

var Chunker = function (_BaseBuffer) {
  (0, _inherits3.default)(Chunker, _BaseBuffer);

  function Chunker(channel, bufferSize) {
    (0, _classCallCheck3.default)(this, Chunker);

    var _this = (0, _possibleConstructorReturn3.default)(this, (Chunker.__proto__ || (0, _getPrototypeOf2.default)(Chunker)).call(this, 0));

    _this._bufferSize = bufferSize || _DEFAULT_BUFFER_SIZE;
    _this._ch = channel;
    _this._buffer = (0, _buf.alloc)(_this._bufferSize);
    _this._currentChunkStart = 0;
    _this._chunkOpen = false;
    return _this;
  }

  (0, _createClass3.default)(Chunker, [{
    key: 'putUInt8',
    value: function putUInt8(position, val) {
      this._ensure(1);
      this._buffer.writeUInt8(val);
    }
  }, {
    key: 'putInt8',
    value: function putInt8(position, val) {
      this._ensure(1);
      this._buffer.writeInt8(val);
    }
  }, {
    key: 'putFloat64',
    value: function putFloat64(position, val) {
      this._ensure(8);
      this._buffer.writeFloat64(val);
    }
  }, {
    key: 'putBytes',
    value: function putBytes(position, data) {
      // TODO: If data is larger than our chunk size or so, we're very likely better off just passing this buffer on
      // rather than doing the copy here TODO: *however* note that we need some way to find out when the data has been
      // written (and thus the buffer can be re-used) if we take that approach
      while (data.remaining() > 0) {
        // Ensure there is an open chunk, and that it has at least one byte of space left
        this._ensure(1);
        if (this._buffer.remaining() > data.remaining()) {
          this._buffer.writeBytes(data);
        } else {
          this._buffer.writeBytes(data.readSlice(this._buffer.remaining()));
        }
      }
      return this;
    }
  }, {
    key: 'flush',
    value: function flush() {
      if (this._buffer.position > 0) {
        this._closeChunkIfOpen();

        // Local copy and clear the buffer field. This ensures that the buffer is not re-released if the flush call fails
        var out = this._buffer;
        this._buffer = null;

        this._ch.write(out.getSlice(0, out.position));

        // Alloc a new output buffer. We assume we're using NodeJS's buffer pooling under the hood here!
        this._buffer = (0, _buf.alloc)(this._bufferSize);
        this._chunkOpen = false;
      }
      return this;
    }

    /**
     * Bolt messages are encoded in one or more chunks, and the boundary between two messages
     * is encoded as a 0-length chunk, `00 00`. This inserts such a message boundary, closing
     * any currently open chunk as needed
     */

  }, {
    key: 'messageBoundary',
    value: function messageBoundary() {

      this._closeChunkIfOpen();

      if (this._buffer.remaining() < _CHUNK_HEADER_SIZE) {
        this.flush();
      }

      // Write message boundary
      this._buffer.writeInt16(_MESSAGE_BOUNDARY);
    }

    /** Ensure at least the given size is available for writing */

  }, {
    key: '_ensure',
    value: function _ensure(size) {
      var toWriteSize = this._chunkOpen ? size : size + _CHUNK_HEADER_SIZE;
      if (this._buffer.remaining() < toWriteSize) {
        this.flush();
      }

      if (!this._chunkOpen) {
        this._currentChunkStart = this._buffer.position;
        this._buffer.position = this._buffer.position + _CHUNK_HEADER_SIZE;
        this._chunkOpen = true;
      }
    }
  }, {
    key: '_closeChunkIfOpen',
    value: function _closeChunkIfOpen() {
      if (this._chunkOpen) {
        var chunkSize = this._buffer.position - (this._currentChunkStart + _CHUNK_HEADER_SIZE);
        this._buffer.putUInt16(this._currentChunkStart, chunkSize);
        this._chunkOpen = false;
      }
    }
  }]);
  return Chunker;
}(_buf.BaseBuffer);

/**
 * Combines chunks until a complete message is gathered up, and then forwards that
 * message to an 'onmessage' listener.
 * @access private
 */


var Dechunker = function () {
  function Dechunker() {
    (0, _classCallCheck3.default)(this, Dechunker);

    this._currentMessage = [];
    this._partialChunkHeader = 0;
    this._state = this.AWAITING_CHUNK;
  }

  (0, _createClass3.default)(Dechunker, [{
    key: 'AWAITING_CHUNK',
    value: function AWAITING_CHUNK(buf) {
      if (buf.remaining() >= 2) {
        // Whole header available, read that
        return this._onHeader(buf.readUInt16());
      } else {
        // Only one byte available, read that and wait for the second byte
        this._partialChunkHeader = buf.readUInt8() << 8;
        return this.IN_HEADER;
      }
    }
  }, {
    key: 'IN_HEADER',
    value: function IN_HEADER(buf) {
      // First header byte read, now we read the next one
      return this._onHeader((this._partialChunkHeader | buf.readUInt8()) & 0xFFFF);
    }
  }, {
    key: 'IN_CHUNK',
    value: function IN_CHUNK(buf) {
      if (this._chunkSize <= buf.remaining()) {
        // Current packet is larger than current chunk, or same size:
        this._currentMessage.push(buf.readSlice(this._chunkSize));
        return this.AWAITING_CHUNK;
      } else {
        // Current packet is smaller than the chunk we're reading, split the current chunk itself up
        this._chunkSize -= buf.remaining();
        this._currentMessage.push(buf.readSlice(buf.remaining()));
        return this.IN_CHUNK;
      }
    }
  }, {
    key: 'CLOSED',
    value: function CLOSED(buf) {}
    // no-op


    /** Called when a complete chunk header has been recieved */

  }, {
    key: '_onHeader',
    value: function _onHeader(header) {
      if (header == 0) {
        // Message boundary
        var message = void 0;
        if (this._currentMessage.length == 1) {
          message = this._currentMessage[0];
        } else {
          message = new _buf.CombinedBuffer(this._currentMessage);
        }
        this._currentMessage = [];
        this.onmessage(message);
        return this.AWAITING_CHUNK;
      } else {
        this._chunkSize = header;
        return this.IN_CHUNK;
      }
    }
  }, {
    key: 'write',
    value: function write(buf) {
      while (buf.hasRemaining()) {
        this._state = this._state(buf);
      }
    }
  }]);
  return Dechunker;
}();

exports.Chunker = Chunker;
exports.Dechunker = Dechunker;
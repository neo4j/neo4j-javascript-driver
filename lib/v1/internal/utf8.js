'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _buf = require('./buf');

var _string_decoder = require('string_decoder');

var _error = require('./../error');

var platformObj = {}; /**
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

// This module defines a cross-platform UTF-8 encoder and decoder that works
// with the Buffer API defined in buf.js

try {
  // This will throw an exception is 'buffer' is not available
  require.resolve("buffer");
  var decoder = new _string_decoder.StringDecoder('utf8');
  var node = require("buffer");

  platformObj = {
    "encode": function encode(str) {
      return new _buf.NodeBuffer(new node.Buffer(str, "UTF-8"));
    },
    "decode": function decode(buffer, length) {
      if (buffer instanceof _buf.NodeBuffer) {
        var start = buffer.position,
            end = start + length;
        buffer.position = Math.min(end, buffer.length);
        return buffer._buffer.toString('utf8', start, end);
      } else if (buffer instanceof _buf.CombinedBuffer) {
        var out = streamDecodeCombinedBuffer(buffer, length, function (partBuffer) {
          return decoder.write(partBuffer._buffer);
        }, function () {
          return decoder.end();
        });
        return out;
      } else {
        throw (0, _error.newError)("Don't know how to decode strings from `" + buffer + "`.");
      }
    }
  };
} catch (e) {

  // Not on NodeJS, add shim for WebAPI TextEncoder/TextDecoder
  var textEncoding = require('../../external/text-encoding/index');
  var encoder = new textEncoding.TextEncoder("utf-8");
  var _decoder = new textEncoding.TextDecoder("utf-8");

  platformObj = {
    "encode": function encode(str) {
      return new _buf.HeapBuffer(encoder.encode(str).buffer);
    },
    "decode": function decode(buffer, length) {
      if (buffer instanceof _buf.HeapBuffer) {
        return _decoder.decode(buffer.readView(Math.min(length, buffer.length - buffer.position)));
      } else {
        // Decoding combined buffer is complicated. For simplicity, for now, 
        // we simply copy the combined buffer into a regular buffer and decode that.
        var tmpBuf = (0, _buf.alloc)(length);
        for (var i = 0; i < length; i++) {
          tmpBuf.writeUInt8(buffer.readUInt8());
        }
        tmpBuf.reset();
        return _decoder.decode(tmpBuf.readView(length));
      }
    }
  };
}

var streamDecodeCombinedBuffer = function streamDecodeCombinedBuffer(combinedBuffers, length, decodeFn, endFn) {
  var remainingBytesToRead = length;
  var position = combinedBuffers.position;
  combinedBuffers._updatePos(Math.min(length, combinedBuffers.length - position));
  // Reduce CombinedBuffers to a decoded string
  var out = combinedBuffers._buffers.reduce(function (last, partBuffer) {
    if (remainingBytesToRead <= 0) {
      return last;
    } else if (position >= partBuffer.length) {
      position -= partBuffer.length;
      return '';
    } else {
      partBuffer._updatePos(position - partBuffer.position);
      var bytesToRead = Math.min(partBuffer.length - position, remainingBytesToRead);
      var lastSlice = partBuffer.readSlice(bytesToRead);
      partBuffer._updatePos(bytesToRead);
      remainingBytesToRead = Math.max(remainingBytesToRead - lastSlice.length, 0);
      position = 0;
      return last + decodeFn(lastSlice);
    }
  }, '');
  return out + endFn();
};

exports.default = platformObj;
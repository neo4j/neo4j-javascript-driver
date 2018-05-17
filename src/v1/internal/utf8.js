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

// This module defines a cross-platform UTF-8 encoder and decoder that works
// with the Buffer API defined in buf.js

import {alloc, CombinedBuffer, HeapBuffer, NodeBuffer} from './buf';
import {StringDecoder} from 'string_decoder';
import {newError} from './../error';

let platformObj = {};


try {
  // This will throw an exception is 'buffer' is not available
  require.resolve("buffer");
  const decoder = new StringDecoder('utf8');
  const node = require('buffer');

  // use static factory function present in newer NodeJS versions to create a buffer containing the given string
  // or fallback to the old, potentially deprecated constructor
  const newNodeJSBuffer = typeof node.Buffer.from === 'function'
    ? str => node.Buffer.from(str, 'utf8')
    : str => new node.Buffer(str, 'utf8');

  platformObj = {
    "encode": function (str) {
      return new NodeBuffer(newNodeJSBuffer(str));
    },
    "decode": function (buffer, length) {
      if (buffer instanceof NodeBuffer) {
        let start = buffer.position,
          end = start + length;
        buffer.position = Math.min(end, buffer.length);
        return buffer._buffer.toString('utf8', start, end);
      }
      else if (buffer instanceof CombinedBuffer) {
        let out = streamDecodeCombinedBuffer(buffer, length,
          (partBuffer) => {
            return decoder.write(partBuffer._buffer);
          },
          () => {
            return decoder.end();
          }
        );
        return out;
      }
      else {
        throw newError("Don't know how to decode strings from `" + buffer + "`.");
      }
    }
  }

} catch (e) {

  // Not on NodeJS, add shim for WebAPI TextEncoder/TextDecoder
  var textEncoding = require('../../external/text-encoding/index');
  let encoder = new textEncoding.TextEncoder("utf-8");
  let decoder = new textEncoding.TextDecoder("utf-8");

  platformObj = {
    "encode": function (str) {
      return new HeapBuffer(encoder.encode(str).buffer);
    },
    "decode": function (buffer, length) {
      if (buffer instanceof HeapBuffer) {
        return decoder.decode(buffer.readView(Math.min(length, buffer.length - buffer.position)));
      }
      else {
        // Decoding combined buffer is complicated. For simplicity, for now, 
        // we simply copy the combined buffer into a regular buffer and decode that.
        var tmpBuf = alloc(length);
        for (var i = 0; i < length; i++) {
          tmpBuf.writeUInt8(buffer.readUInt8());
        }
        tmpBuf.reset();
        return decoder.decode(tmpBuf.readView(length));
      }
    }
  }
}

let streamDecodeCombinedBuffer = (combinedBuffers, length, decodeFn, endFn) => {
  let remainingBytesToRead = length;
  let position = combinedBuffers.position;
  combinedBuffers._updatePos(Math.min(length, combinedBuffers.length - position));
  // Reduce CombinedBuffers to a decoded string
  let out = combinedBuffers._buffers.reduce(function (last, partBuffer) {
    if (remainingBytesToRead <= 0) {
      return last;
    } else if (position >= partBuffer.length) {
      position -= partBuffer.length;
      return '';
    } else {
      partBuffer._updatePos(position - partBuffer.position);
      let bytesToRead = Math.min(partBuffer.length - position, remainingBytesToRead);
      let lastSlice = partBuffer.readSlice(bytesToRead);
      partBuffer._updatePos(bytesToRead);
      remainingBytesToRead = Math.max(remainingBytesToRead - lastSlice.length, 0);
      position = 0;
      return last + decodeFn(lastSlice);
    }
  }, '');
  return out + endFn();
};

export default platformObj;

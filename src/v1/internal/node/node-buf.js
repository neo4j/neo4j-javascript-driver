/**
 * Copyright (c) 2002-2019 "Neo4j,"
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

import node from 'buffer';
import BaseBuffer from '../buf/base-buf';

export default class NodeBuffer extends BaseBuffer {

  constructor(arg) {
    const buffer = newNodeJSBuffer(arg);
    super(buffer.length);
    this._buffer = buffer;
  }

  getUInt8(position) {
    return this._buffer.readUInt8(position);
  }

  getInt8(position) {
    return this._buffer.readInt8(position);
  }

  getFloat64(position) {
    return this._buffer.readDoubleBE(position);
  }

  putUInt8(position, val) {
    this._buffer.writeUInt8(val, position);
  }

  putInt8(position, val) {
    this._buffer.writeInt8(val, position);
  }

  putFloat64(position, val) {
    this._buffer.writeDoubleBE(val, position);
  }

  putBytes(position, val) {
    if (val instanceof NodeBuffer) {
      const bytesToCopy = Math.min(val.length - val.position, this.length - position);
      val._buffer.copy(
        this._buffer,
        position,
        val.position,
        val.position + bytesToCopy);
      val.position += bytesToCopy;
    } else {
      super.putBytes(position, val);
    }
  };

  getSlice(start, length) {
    return new NodeBuffer(this._buffer.slice(start, start + length));
  }
}

function newNodeJSBuffer(arg) {
  if (arg instanceof node.Buffer) {
    return arg;
  } else if (typeof arg === 'number' && typeof node.Buffer.alloc === 'function') {
    // use static factory function present in newer NodeJS versions to allocate new buffer with specified size
    return node.Buffer.alloc(arg);
  } else {
    // fallback to the old, potentially deprecated constructor
    return new node.Buffer(arg);
  }
}

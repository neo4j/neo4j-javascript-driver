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

import BaseBuffer from '../buf/base-buf';

export default class HeapBuffer extends BaseBuffer {

  constructor(arg) {
    const buffer = arg instanceof ArrayBuffer ? arg : new ArrayBuffer(arg);
    super(buffer.byteLength);
    this._buffer = buffer;
    this._view = new DataView(this._buffer);
  }

  putUInt8(position, val) {
    this._view.setUint8(position, val);
  }

  getUInt8(position) {
    return this._view.getUint8(position);
  }

  putInt8(position, val) {
    this._view.setInt8(position, val);
  }

  getInt8(position) {
    return this._view.getInt8(position);
  }

  getFloat64(position) {
    return this._view.getFloat64(position);
  }

  putFloat64(position, val) {
    this._view.setFloat64(position, val);
  }

  getSlice(start, length) {
    if (this._buffer.slice) {
      return new HeapBuffer(this._buffer.slice(start, start + length));
    } else {
      // Some platforms (eg. phantomjs) don't support slice, so fall back to a copy
      // We do this rather than return a SliceBuffer, because sliceBuffer cannot
      // be passed to native network write ops etc - we need ArrayBuffer for that
      const copy = new HeapBuffer(length);
      for (let i = 0; i < length; i++) {
        copy.putUInt8(i, this.getUInt8(i + start));
      }
      return copy;
    }
  }

  /**
   * Specific to HeapBuffer, this gets a DataView from the
   * current position and of the specified length.
   */
  readView(length) {
    return new DataView(this._buffer, this._updatePos(length), length);
  }
}

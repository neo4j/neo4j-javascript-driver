/**
 * Copyright (c) "Neo4j"
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

/**
 * Common base with default implementation for most buffer methods.
 * Buffers are stateful - they track a current "position", this helps greatly
 * when reading and writing from them incrementally. You can also ignore the
 * stateful read/write methods.
 * readXXX and writeXXX-methods move the inner position of the buffer.
 * putXXX and getXXX-methods do not.
 * @access private
 */
export default class BaseBuffer {
  /**
   * Create a instance with the injected size.
   * @constructor
   * @param {Integer} size
   */
  constructor (size) {
    this.position = 0
    this.length = size
  }

  getUInt8 (position) {
    throw new Error('Not implemented')
  }

  getInt8 (position) {
    throw new Error('Not implemented')
  }

  getFloat64 (position) {
    throw new Error('Not implemented')
  }

  putUInt8 (position, val) {
    throw new Error('Not implemented')
  }

  putInt8 (position, val) {
    throw new Error('Not implemented')
  }

  putFloat64 (position, val) {
    throw new Error('Not implemented')
  }

  /**
   * @param p
   */
  getInt16 (p) {
    return (this.getInt8(p) << 8) | this.getUInt8(p + 1)
  }

  /**
   * @param p
   */
  getUInt16 (p) {
    return (this.getUInt8(p) << 8) | this.getUInt8(p + 1)
  }

  /**
   * @param p
   */
  getInt32 (p) {
    return (
      (this.getInt8(p) << 24) |
      (this.getUInt8(p + 1) << 16) |
      (this.getUInt8(p + 2) << 8) |
      this.getUInt8(p + 3)
    )
  }

  /**
   * @param p
   */
  getUInt32 (p) {
    return (
      (this.getUInt8(p) << 24) |
      (this.getUInt8(p + 1) << 16) |
      (this.getUInt8(p + 2) << 8) |
      this.getUInt8(p + 3)
    )
  }

  /**
   * @param p
   */
  getInt64 (p) {
    return (
      (this.getInt8(p) << 56) |
      (this.getUInt8(p + 1) << 48) |
      (this.getUInt8(p + 2) << 40) |
      (this.getUInt8(p + 3) << 32) |
      (this.getUInt8(p + 4) << 24) |
      (this.getUInt8(p + 5) << 16) |
      (this.getUInt8(p + 6) << 8) |
      this.getUInt8(p + 7)
    )
  }

  /**
   * Get a slice of this buffer. This method does not copy any data,
   * but simply provides a slice view of this buffer
   * @param start
   * @param length
   */
  getSlice (start, length) {
    return new SliceBuffer(start, length, this)
  }

  /**
   * @param p
   * @param val
   */
  putInt16 (p, val) {
    this.putInt8(p, val >> 8)
    this.putUInt8(p + 1, val & 0xff)
  }

  /**
   * @param p
   * @param val
   */
  putUInt16 (p, val) {
    this.putUInt8(p, (val >> 8) & 0xff)
    this.putUInt8(p + 1, val & 0xff)
  }

  /**
   * @param p
   * @param val
   */
  putInt32 (p, val) {
    this.putInt8(p, val >> 24)
    this.putUInt8(p + 1, (val >> 16) & 0xff)
    this.putUInt8(p + 2, (val >> 8) & 0xff)
    this.putUInt8(p + 3, val & 0xff)
  }

  /**
   * @param p
   * @param val
   */
  putUInt32 (p, val) {
    this.putUInt8(p, (val >> 24) & 0xff)
    this.putUInt8(p + 1, (val >> 16) & 0xff)
    this.putUInt8(p + 2, (val >> 8) & 0xff)
    this.putUInt8(p + 3, val & 0xff)
  }

  /**
   * @param p
   * @param val
   */
  putInt64 (p, val) {
    this.putInt8(p, val >> 48)
    this.putUInt8(p + 1, (val >> 42) & 0xff)
    this.putUInt8(p + 2, (val >> 36) & 0xff)
    this.putUInt8(p + 3, (val >> 30) & 0xff)
    this.putUInt8(p + 4, (val >> 24) & 0xff)
    this.putUInt8(p + 5, (val >> 16) & 0xff)
    this.putUInt8(p + 6, (val >> 8) & 0xff)
    this.putUInt8(p + 7, val & 0xff)
  }

  /**
   * @param position
   * @param other
   */
  putBytes (position, other) {
    for (let i = 0, end = other.remaining(); i < end; i++) {
      this.putUInt8(position + i, other.readUInt8())
    }
  }

  /**
   * Read from state position.
   */
  readUInt8 () {
    return this.getUInt8(this._updatePos(1))
  }

  /**
   * Read from state position.
   */
  readInt8 () {
    return this.getInt8(this._updatePos(1))
  }

  /**
   * Read from state position.
   */
  readUInt16 () {
    return this.getUInt16(this._updatePos(2))
  }

  /**
   * Read from state position.
   */
  readUInt32 () {
    return this.getUInt32(this._updatePos(4))
  }

  /**
   * Read from state position.
   */
  readInt16 () {
    return this.getInt16(this._updatePos(2))
  }

  /**
   * Read from state position.
   */
  readInt32 () {
    return this.getInt32(this._updatePos(4))
  }

  /**
   * Read from state position.
   */
  readInt64 () {
    return this.getInt32(this._updatePos(8))
  }

  /**
   * Read from state position.
   */
  readFloat64 () {
    return this.getFloat64(this._updatePos(8))
  }

  /**
   * Write to state position.
   * @param val
   */
  writeUInt8 (val) {
    this.putUInt8(this._updatePos(1), val)
  }

  /**
   * Write to state position.
   * @param val
   */
  writeInt8 (val) {
    this.putInt8(this._updatePos(1), val)
  }

  /**
   * Write to state position.
   * @param val
   */
  writeInt16 (val) {
    this.putInt16(this._updatePos(2), val)
  }

  /**
   * Write to state position.
   * @param val
   */
  writeInt32 (val) {
    this.putInt32(this._updatePos(4), val)
  }

  /**
   * Write to state position.
   * @param val
   */
  writeUInt32 (val) {
    this.putUInt32(this._updatePos(4), val)
  }

  /**
   * Write to state position.
   * @param val
   */
  writeInt64 (val) {
    this.putInt64(this._updatePos(8), val)
  }

  /**
   * Write to state position.
   * @param val
   */
  writeFloat64 (val) {
    this.putFloat64(this._updatePos(8), val)
  }

  /**
   * Write to state position.
   * @param val
   */
  writeBytes (val) {
    this.putBytes(this._updatePos(val.remaining()), val)
  }

  /**
   * Get a slice of this buffer. This method does not copy any data,
   * but simply provides a slice view of this buffer
   * @param length
   */
  readSlice (length) {
    return this.getSlice(this._updatePos(length), length)
  }

  _updatePos (length) {
    const p = this.position
    this.position += length
    return p
  }

  /**
   * Get remaining
   */
  remaining () {
    return this.length - this.position
  }

  /**
   * Has remaining
   */
  hasRemaining () {
    return this.remaining() > 0
  }

  /**
   * Reset position state
   */
  reset () {
    this.position = 0
  }

  /**
   * Get string representation of buffer and it's state.
   * @return {string} Buffer as a string
   */
  toString () {
    return (
      this.constructor.name +
      '( position=' +
      this.position +
      ' )\n  ' +
      this.toHex()
    )
  }

  /**
   * Get string representation of buffer.
   * @return {string} Buffer as a string
   */
  toHex () {
    let out = ''
    for (let i = 0; i < this.length; i++) {
      let hexByte = this.getUInt8(i).toString(16)
      if (hexByte.length === 1) {
        hexByte = '0' + hexByte
      }
      out += hexByte
      if (i !== this.length - 1) {
        out += ' '
      }
    }
    return out
  }
}

/**
 * Represents a view as slice of another buffer.
 * @access private
 */
class SliceBuffer extends BaseBuffer {
  constructor (start, length, inner) {
    super(length)
    this._start = start
    this._inner = inner
  }

  putUInt8 (position, val) {
    this._inner.putUInt8(this._start + position, val)
  }

  getUInt8 (position) {
    return this._inner.getUInt8(this._start + position)
  }

  putInt8 (position, val) {
    this._inner.putInt8(this._start + position, val)
  }

  putFloat64 (position, val) {
    this._inner.putFloat64(this._start + position, val)
  }

  getInt8 (position) {
    return this._inner.getInt8(this._start + position)
  }

  getFloat64 (position) {
    return this._inner.getFloat64(this._start + position)
  }
}

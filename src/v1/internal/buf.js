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
 
/** This module defines a common API for dealing with binary data that
  * works for both browsers (via ArrayBuffer/DataView) and for NodeJS
  *(via Buffer API).
  */

let _node = require("buffer");
/**
  * Common base with default implementation for most buffer methods.
  * Buffers are stateful - they track a current "position", this helps greatly
  * when reading and writing from them incrementally. You can also ignore the
  * stateful read/write methods.
  * readXXX and writeXXX-methods move the inner position of the buffer.
  * putXXX and getXXX-methods do not.
  * @access private
  */
class BaseBuffer
{
  /**
   * Create a instance with the injected size.
   * @constructor
   * @param {Integer} size
   */
  constructor (size) {
    this.position = 0;
    this.length = size;
    // Calling these out - this is the required 
    // methods a subclass needs to implement
    let getUInt8 = null;
    let getInt8 = null;
    let getFloat64 = null;
    let getSlice = null;
    let putFloat64 = null;
    let putUInt8 = null;
    let putInt8 = null;
  }

  /**
   * @param p
   */
  getInt16 (p) {
    return this.getInt8(p)      << 8
         | this.getUInt8(p + 1);
  }

  /**
   * @param p
   */
  getUInt16 (p) {
    return this.getUInt8(p)     << 8
         | this.getUInt8(p + 1);
  }

  /**
   * @param p
   */
  getInt32 (p) {
    return this.getInt8(p)     << 24
         | this.getUInt8(p + 1) << 16
         | this.getUInt8(p + 2) << 8
         | this.getUInt8(p + 3);
  }

  /**
   * @param p
   */
  getUInt32 (p) {
    return this.getUInt8(p)     << 24
         | this.getUInt8(p + 1) << 16
         | this.getUInt8(p + 2) << 8
         | this.getUInt8(p + 3);
  }

  /**
   * @param p
   */
  getInt64 (p) {
    return this.getInt8(p)      << 56
         | this.getUInt8(p + 1) << 48
         | this.getUInt8(p + 2) << 40
         | this.getUInt8(p + 3) << 32
         | this.getUInt8(p + 4) << 24
         | this.getUInt8(p + 5) << 16
         | this.getUInt8(p + 6) << 8
         | this.getUInt8(p + 7);
  }

  /**
   * Get a slice of this buffer. This method does not copy any data,
   * but simply provides a slice view of this buffer
   * @param start
   * @param length
   */
  getSlice ( start, length ) {
    return new SliceBuffer( start, length, this );
  }

  /**
   * @param p
   * @param val
   */
  putInt16 ( p, val ) {
    this.putInt8(  p,     val >> 8 );
    this.putUInt8( p + 1, val      & 0xFF );
  }

  /**
   * @param p
   * @param val
   */
  putUInt16 ( p, val ) {
    this.putUInt8( p,     val >> 8 & 0xFF );
    this.putUInt8( p + 1, val      & 0xFF );
  }

  /**
   * @param p
   * @param val
   */
  putInt32 ( p, val ) {
    this.putInt8(  p,     val >> 24 );
    this.putUInt8( p + 1, val >> 16 & 0xFF );
    this.putUInt8( p + 2, val >> 8  & 0xFF );
    this.putUInt8( p + 3, val       & 0xFF );
  }

  /**
   * @param p
   * @param val
   */
  putUInt32 ( p, val ) {
    this.putUInt8( p,     val >> 24 & 0xFF );
    this.putUInt8( p + 1, val >> 16 & 0xFF );
    this.putUInt8( p + 2, val >> 8  & 0xFF );
    this.putUInt8( p + 3, val       & 0xFF );
  }

  /**
   * @param p
   * @param val
   */
  putInt64 ( p, val ) {
    this.putInt8(  p, val >> 48 );
    this.putUInt8( p + 1, val >> 42 & 0xFF );
    this.putUInt8( p + 2, val >> 36 & 0xFF );
    this.putUInt8( p + 3, val >> 30 & 0xFF );
    this.putUInt8( p + 4, val >> 24 & 0xFF );
    this.putUInt8( p + 5, val >> 16 & 0xFF );
    this.putUInt8( p + 6, val >> 8  & 0xFF );
    this.putUInt8( p + 7, val       & 0xFF );
  }

  /**
   * @param position
   * @param other
   */
  putBytes ( position, other ) {
    for (let i = 0, end=other.remaining(); i < end; i++) {
      this.putUInt8( position + i, other.readUInt8() );
    }
  }

  /**
   * Read from state position.
   */
  readUInt8 () {
    return this.getUInt8( this._updatePos(1) );
  }

  /**
   * Read from state position.
   */
  readInt8 () {
    return this.getInt8( this._updatePos(1) );
  }

  /**
   * Read from state position.
   */
  readUInt16 () {
    return this.getUInt16( this._updatePos(2) );
  }

  /**
   * Read from state position.
   */
  readUInt32 () {
    return this.getUInt32( this._updatePos(4) );
  }

  /**
   * Read from state position.
   */
  readInt16 () {
    return this.getInt16( this._updatePos(2) );
  }

  /**
   * Read from state position.
   */
  readInt32 () {
    return this.getInt32( this._updatePos(4) );
  }

  /**
   * Read from state position.
   */
  readInt64 () {
    return this.getInt32( this._updatePos(8) );
  }

  /**
   * Read from state position.
   */
  readFloat64 () {
    return this.getFloat64( this._updatePos(8) );
  }

  /**
   * Write to state position.
   * @param val
   */
  writeUInt8 ( val ) {
    this.putUInt8( this._updatePos(1), val);
  }

  /**
   * Write to state position.
   * @param val
   */
  writeInt8 ( val ) {
    this.putInt8( this._updatePos(1), val);
  }

  /**
   * Write to state position.
   * @param val
   */
  writeInt16 ( val ) {
    this.putInt16( this._updatePos(2), val);
  }

  /**
   * Write to state position.
   * @param val
   */
  writeInt32 ( val ) {
    this.putInt32( this._updatePos(4), val);
  }

  /**
   * Write to state position.
   * @param val
   */
  writeUInt32 ( val ) {
    this.putUInt32( this._updatePos(4), val);
  }

  /**
   * Write to state position.
   * @param val
   */
  writeInt64 ( val ) {
    this.putInt64( this._updatePos(8), val);
  }

  /**
   * Write to state position.
   * @param val
   */
  writeFloat64 ( val ) {
    this.putFloat64( this._updatePos(8), val);
  }

  /**
   * Write to state position.
   * @param val
   */
  writeBytes ( val ) {
    this.putBytes( this._updatePos(val.remaining()), val);
  }

  /**
   * Get a slice of this buffer. This method does not copy any data,
   * but simply provides a slice view of this buffer
   * @param length
   */
  readSlice ( length ) {
    return this.getSlice( this._updatePos( length ), length );
  }

  _updatePos ( length ) {
    let p = this.position;
    this.position += length;
    return p;
  }

  /**
   * Get remaining
   */
  remaining () {
    return this.length - this.position;
  }

  /**
   * Has remaining
   */
  hasRemaining () {
    return this.remaining() > 0;
  }

  /**
   * Reset position state
   */
  reset () {
    this.position = 0;
  }

  /**
   * Get string representation of buffer and it's state.
   * @return {string} Buffer as a string
   */
  toString () {
    return this.constructor.name + "( position="+this.position+" )\n  " + this.toHex();
  }

  /**
   * Get string representation of buffer.
   * @return {string} Buffer as a string
   */
  toHex () {
    // TODO something like StringBuilder?
    let out = "";
    for (let i = 0; i < this.length; i++) {
      let hexByte = this.getUInt8(i).toString(16);
      if( hexByte.length == 1 ) {
        hexByte = "0" + hexByte;
      }
      out += hexByte + " "
    }
    return out;
  }
}

/**
 * Basic buffer implementation that should work in most any modern JS env.
 * @access private
 */
class HeapBuffer extends BaseBuffer {
  constructor (arg) {
    let buffer = arg instanceof ArrayBuffer ? arg : new ArrayBuffer(arg)
    super(buffer.byteLength );
    this._buffer = buffer;
    this._view = new DataView( this._buffer );
  }

  putUInt8 ( position, val ) {
    this._view.setUint8(position, val);
  }

  getUInt8 ( position ) {
    return this._view.getUint8(position);
  }

  putInt8 ( position, val ) {
    this._view.setInt8(position, val);
  }

  getInt8 ( position ) {
    return this._view.getInt8(position);
  }

  getFloat64 ( position ) {
    return this._view.getFloat64(position);
  }

  putFloat64 ( position, val ) {
    this._view.setFloat64( position, val );
  }

  getSlice ( start, length ) {
    if( this._buffer.slice ) {
      return new HeapBuffer( this._buffer.slice( start, start + length ) );
    } else {
      // Some platforms (eg. phantomjs) don't support slice, so fall back to a copy
      // We do this rather than return a SliceBuffer, because sliceBuffer cannot
      // be passed to native network write ops etc - we need ArrayBuffer for that
      let copy = new HeapBuffer(length);
      for (var i = 0; i < length; i++) {
        copy.putUInt8( i, this.getUInt8( i + start ) );
      }
      return copy;
    }
  }

  /** 
   * Specific to HeapBuffer, this gets a DataView from the
   * current position and of the specified length. 
   */
  readView ( length ) {
    return new DataView( this._buffer, this._updatePos(length), length );
  }
}

/**
 * Represents a view as slice of another buffer.
 * @access private
 */
class SliceBuffer extends BaseBuffer {
  constructor( start, length, inner ) {
    super(length);
    this._start = start;
    this._inner = inner;
  }

  putUInt8 ( position, val ) {
    this._inner.putUInt8( this._start + position, val );
  }

  getUInt8 ( position ) {
    return this._inner.getUInt8( this._start + position );
  }

  putInt8 ( position, val ) {
    this._inner.putInt8( this._start + position, val );
  }

  putFloat64 ( position, val ) {
    this._inner.putFloat64( this._start + position, val );
  }

  getInt8 ( position ) {
    return this._inner.getInt8( this._start + position );
  }

  getFloat64 (position) {
    return this._inner.getFloat64( this._start + position );
  }
}

/**
 * Buffer that combines multiple buffers, exposing them as one single buffer.
 * @access private
 */
class CombinedBuffer extends BaseBuffer {
  constructor (buffers) {
    let length = 0;
    for (let i = 0; i < buffers.length; i++) {
      length += buffers[i].length;
    }
    super( length );
    this._buffers = buffers;
  }

  getUInt8 ( position ) {
    // Surely there's a faster way to do this.. some sort of lookup table thing?
    for (let i = 0; i < this._buffers.length; i++) {
      let buffer = this._buffers[i];
      // If the position is not in the current buffer, skip the current buffer
      if( position >= buffer.length ) {
        position -= buffer.length;
      } else {
        return buffer.getUInt8(position);
      }
    }
  }

  getInt8 ( position ) {
    // Surely there's a faster way to do this.. some sort of lookup table thing?
    for (let i = 0; i < this._buffers.length; i++) {
      let buffer = this._buffers[i];
      // If the position is not in the current buffer, skip the current buffer
      if( position >= buffer.length ) {
        position -= buffer.length;
      } else {
        return buffer.getInt8(position);
      }
    }
  }

  getFloat64 ( position ) {
    // At some point, a more efficient impl. For now, we copy the 8 bytes
    // we want to read and depend on the platform impl of IEEE 754.
    let b = alloc(8);
    for (var i = 0; i < 8; i++) { b.putUInt8(i, this.getUInt8( position + i )); };
    return b.getFloat64(0);
  }
}

/**
 * Buffer used in a Node.js environment
 * @access private
 */
class NodeBuffer extends BaseBuffer {
  constructor(arg) {
    const buffer = arg instanceof _node.Buffer ? arg : newNodeJSBuffer(arg);
    super(buffer.length);
    this._buffer = buffer;
  }

  getUInt8 (position) {
    return this._buffer.readUInt8( position );
  }

  getInt8 (position) {
    return this._buffer.readInt8( position );
  }

  getFloat64 (position) {
    return this._buffer.readDoubleBE(position);
  }

  putUInt8 (position, val) {
    this._buffer.writeUInt8( val, position );
  }

  putInt8 (position, val) {
    this._buffer.writeInt8( val, position );
  }

  putFloat64 ( position, val ) {
    this._buffer.writeDoubleBE( val, position );
  }

  putBytes ( position, val ) {
    if( val instanceof NodeBuffer ) {
      let bytesToCopy = Math.min( val.length - val.position, this.length - position );
      val._buffer.copy(
        this._buffer,
        position,
        val.position,
        val.position + bytesToCopy );
      val.position += bytesToCopy;
    } else {
      super.putBytes(position, val);
    }
  };

  getSlice ( start, length ) {
    return new NodeBuffer( this._buffer.slice( start, start + length ) );
  }
}

function newNodeJSBuffer(arg) {
  if (typeof arg === 'number' && typeof _node.Buffer.alloc === 'function') {
    // use static factory function present in newer NodeJS versions to allocate new buffer with specified size
    return _node.Buffer.alloc(arg);
  } else {
    // fallback to the old, potentially deprecated constructor
    return new _node.Buffer(arg);
  }
}

// Use HeapBuffer by default, unless Buffer API is available, see below
let _DefaultBuffer = HeapBuffer;
try {
  // This will throw an exception if we're not running on NodeJS or equivalent
  require.resolve("buffer");
  _DefaultBuffer = NodeBuffer;
} catch(e) {}

/**
 * Allocate a new buffer using whatever mechanism is most sensible for the
 * current platform
 * @access private
 * @param {Integer} size
 * @return new buffer
 */
function alloc (size) {
  return new _DefaultBuffer(size);
}

export {
  BaseBuffer,
  HeapBuffer,
  SliceBuffer,
  CombinedBuffer,
  NodeBuffer,
  alloc
}

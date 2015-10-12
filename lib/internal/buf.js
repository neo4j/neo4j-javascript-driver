
// This module defines a common API for dealing with binary data that
// works for both browsers (via ArrayBuffer/DataView) and for NodeJS
// (via Buffer API).

/**
 * Common base with default implementation for most buffer methods.
 * Buffers are stateful - they track a current "position", this helps greatly
 * when reading and writing from them incrementally. You can also ignore the
 * stateful read/write methods.
 *
 * readXXX and writeXXX-methods move the inner position of the buffer.
 * putXXX and getXXX-methods do not.
 */

let node = require("buffer");

class BaseBuffer
{
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

  getInt16 (p) {
    return this.getInt8(p) << 8
         | this.getUInt8(p + 1) & 0xFF;
  }

  getUInt16 (p) {
    return this.getUInt8(p) << 8
         | this.getUInt8(p + 1) & 0xFF;
  }

  getInt32 (p) {
    return this.getInt8(p)      << 24
         | this.getUInt8(p + 1) << 16 & 0xFF
         | this.getUInt8(p + 2) << 8  & 0xFF
         | this.getUInt8(p + 3)       & 0xFF;
  }

  getUInt32 (p) {
    return this.getUInt8(p)     << 24
         | this.getUInt8(p + 1) << 16 & 0xFF
         | this.getUInt8(p + 2) << 8  & 0xFF
         | this.getUInt8(p + 3)       & 0xFF;
  }

  getInt64 (p) {
    return this.getInt8(p)      << 56
         | this.getUInt8(p + 1) << 48 & 0xFF
         | this.getUInt8(p + 2) << 40 & 0xFF
         | this.getUInt8(p + 3) << 32 & 0xFF
         | this.getUInt8(p + 4) << 24 & 0xFF
         | this.getUInt8(p + 5) << 16 & 0xFF
         | this.getUInt8(p + 6) << 8  & 0xFF
         | this.getUInt8(p + 7)       & 0xFF;
  }

  /**
   * Get a slice of this buffer. This method does not copy any data,
   * but simply provides a slice view of this buffer
   */
  getSlice ( start, length ) {
    return new SliceBuffer( start, length, this );
  }

  putInt16 ( p, val ) {
    this.putInt8(  p,     val >> 8 );
    this.putUInt8( p + 1, val & 0xFF );
  }

  putUInt16 ( p, val ) {
    this.putUInt8( p,     val >> 8 & 0xFF );
    this.putUInt8( p + 1, val      & 0xFF );
  }

  putInt32 ( p, val ) {
    this.putInt8(  p,     val >> 24 );
    this.putUInt8( p + 1, val >> 16 & 0xFF );
    this.putUInt8( p + 2, val >> 8  & 0xFF );
    this.putUInt8( p + 3, val       & 0xFF );
  }

  putUInt32 ( p, val ) {
    this.putUInt8( p,     val >> 24 & 0xFF );
    this.putUInt8( p + 1, val >> 16 & 0xFF );
    this.putUInt8( p + 2, val >> 8  & 0xFF );
    this.putUInt8( p + 3, val       & 0xFF );
  }

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

  putBytes ( position, other ) {
    for (let i = 0, end=other.remaining(); i < end; i++) {
      this.putUInt8( position + i, other.readUInt8() );
    }
  }

  readUInt8 () {
    return this.getUInt8( this._updatePos(1) );
  }

  readInt8 () {
    return this.getInt8( this._updatePos(1) );
  }

  readUInt16 () {
    return this.getUInt16( this._updatePos(2) );
  }

  readInt16 () {
    return this.getInt16( this._updatePos(2) );
  }

  readInt32 () {
    return this.getInt32( this._updatePos(4) );
  }

  readInt64 () {
    return this.getInt32( this._updatePos(8) );
  }

  readFloat64 () {
    return this.getFloat64( this._updatePos(8) );
  }

  writeUInt8 ( val ) {
    this.putUInt8( this._updatePos(1), val);
  }

  writeInt8 ( val ) {
    this.putInt8( this._updatePos(1), val);
  }

  writeInt16 ( val ) {
    this.putInt16( this._updatePos(2), val);
  }

  writeInt32 ( val ) {
    this.putInt32( this._updatePos(4), val);
  }

  writeUInt32 ( val ) {
    this.putUInt32( this._updatePos(4), val);
  }

  writeInt64 ( val ) {
    this.putInt64( this._updatePos(8), val);
  }

  writeFloat64 ( val ) {
    this.putFloat64( this._updatePos(8), val);
  }

  writeBytes ( val ) {
    this.putBytes( this._updatePos(val.remaining()), val);
  }

  /**
   * Get a slice of this buffer. This method does not copy any data,
   * but simply provides a slice view of this buffer
   */
  readSlice ( length ) {
    return this.getSlice( this._updatePos( length ), length );
  }


  _updatePos ( length ) {
    let p = this.position;
    this.position += length;
    return p;
  }

  remaining () {
    return this.length - this.position;
  }

  hasRemaining () {
    return this.remaining() > 0;
  }

  reset () {
    this.position = 0;
  }

  toString () {
    return this.constructor.name + "( position="+this.position+" )\n  " + this.toHex();
  }

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
    return new HeapBuffer( this._buffer.slice( start, start + length ) );
  }

  /** 
   * Specific to HeapBuffer, this gets a DataView from the
   * current position and of the specified length. 
   */
  readView ( length ) {
    return new DataView( this._buffer, this.position, length );
  }
}

/**
 * Represents a view of slice of another buffer.
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
 */
class CombinedBuffer extends BaseBuffer {
  constructor (buffers) {
    let length = 0;
    for (let i = 0; i < buffers.length; i++) {
      length += buffers[i].length;
    };
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
    };
  };

  getInt8 ( position ) {
    // Surely there's a faster way to do this.. some sort of lookup table thing?
    for (let i = 0; i < this._buffers.length; i++) {
      let buffer = this._buffers[i];
      // If the position is not in the current buffer, skip the current buffer
      if( position > buffer.length ) {
        position -= buffer.length;
      } else {
        return buffer.getInt8(position);
      }
    };
  };
}

class NodeBuffer extends BaseBuffer {
  constructor(arg) {
    let buffer = arg instanceof node.Buffer ? arg : new node.Buffer(arg);
    super(buffer.length);
    this._buffer = buffer;
  }

  getUInt8 (position) {
    return this._buffer.readUInt8( position );
  };

  getInt8 (position) {
    return this._buffer.readInt8( position );
  };

  getFloat64 (position) {
    return this._buffer.readDoubleBE(position);
  };

  putUInt8 (position, val) {
    this._buffer.writeUInt8( val, position );
  };

  putInt8 (position, val) {
    this._buffer.writeInt8( val, position );
  };

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
        val.position + bytesToCopy )
      val.position += bytesToCopy;
    } else {
      throw new Error("Copying not yet implemented.");
    }
  };

  getSlice ( start, length ) {
    return new NodeBuffer( this._buffer.slice( start, start + length ) );
  };
}

// Use HeapBuffer by default, unless Buffer API is available, see below
let DefaultBuffer = HeapBuffer;
try {
  // This will throw an exception if we're not running on NodeJS or equivalent
  require.resolve("buffer");
  DefaultBuffer = NodeBuffer;
} catch(e) {}

/**
* Allocate a new buffer using whatever mechanism is most sensible for the
* current platform
*/
let alloc = (size) => {
  return new DefaultBuffer(size);
};

export default {
  BaseBuffer,
  HeapBuffer,
  SliceBuffer,
  CombinedBuffer,
  NodeBuffer,
  alloc
}

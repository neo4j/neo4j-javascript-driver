
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
function BaseBuffer(size) {
  this.position = 0;
  this.length = size;
}

BaseBuffer.prototype.readByte = function() {
  return this.getByte(this.position++);
}

BaseBuffer.prototype.readInt16 = function() {
  return this.readByte() << 8
       | this.readByte();
}

BaseBuffer.prototype.readInt32 = function() {
  return this.readByte() << 24
       | this.readByte() << 16
       | this.readByte() << 8
       | this.readByte();
}

BaseBuffer.prototype.readInt64 = function() {
  return this.readByte() << 56
       | this.readByte() << 48
       | this.readByte() << 40
       | this.readByte() << 32
       | this.readByte() << 24
       | this.readByte() << 16
       | this.readByte() << 8
       | this.readByte();
}

BaseBuffer.prototype.readFloat64 = function() {
  return this.getFloat64(this.position+=8);
}

BaseBuffer.prototype.writeByte = function( val ) {
  this.putByte(this.position++, val);
}

BaseBuffer.prototype.writeBytes = function( val ) {
  this.putBytes(this.position+=(val.length-val.position), val);
}

BaseBuffer.prototype.writeInt16 = function( val ) {
  this.writeByte(val >> 8 & 0xFF );
  this.writeByte(val      & 0xFF );
}

BaseBuffer.prototype.hasRemaining = function() {
  return this.position < this.length - 1;
}

BaseBuffer.prototype.reset = function() {
  this.position = 0;
}

/**
 * Get a slice of this buffer. This method does not copy any data,
 * but simply provides a slice view of this buffer
 */
BaseBuffer.prototype.slice = function( start, length ) {
  return new SliceBuffer( start, length, this );
}

/**
 * Basic buffer implementation that should work in most any modern JS env.
 */
function HeapBuffer(arg) {
  this._buffer = arg instanceof ArrayBuffer ? arg : new ArrayBuffer(arg);
  this._view = new DataView( this._buffer );
  BaseBuffer.call(this, this._buffer.length );
};
HeapBuffer.prototype = Object.create( BaseBuffer.prototype );
HeapBuffer.prototype.constructor = HeapBuffer;

module.exports.HeapBuffer = HeapBuffer;

HeapBuffer.prototype.putByte = function( position, val ) {
  this._view.setUint8(position, val);
}

HeapBuffer.prototype.getByte = function( position ) {
  return this._view.getUint8(position);
}

HeapBuffer.prototype.getFloat64 = function(position) {
  return this._view.getFloat64(position);
}


/**
 * Represents a view of slice of another buffer.
 */
function SliceBuffer( start, length, inner ) {
  BaseBuffer.call(this, size);
  this._start = start;
  this._inner = inner;
}
SliceBuffer.prototype = Object.create( BaseBuffer.prototype );
SliceBuffer.prototype.constructor = SliceBuffer;

module.exports.SliceBuffer = SliceBuffer;

SliceBuffer.prototype.putByte = function( position, val ) {
  this._inner.putByte( this._start + position, val );
}

SliceBuffer.prototype.getByte = function( position ) {
  return this._inner.getByte( this._start + position );
}

SliceBuffer.prototype.getFloat64 = function(position) {
  return this._inner.getFloat64( this._start + position );
}

// Use HeapBuffer by default, unless Buffer API is available, see below
var DefaultBuffer = HeapBuffer;

// Only declare NodeBuffer if we have the Node Buffer API available
try {

  var node = require("buffer");

  function NodeBuffer(arg) {
    this._buffer = arg instanceof node.Buffer ? arg : new node.Buffer(arg);
    BaseBuffer.call(this, this._buffer.length);
  }
  NodeBuffer.prototype = Object.create( BaseBuffer.prototype );
  NodeBuffer.prototype.constructor = NodeBuffer;

  DefaultBuffer = NodeBuffer;
  module.exports.NodeBuffer = NodeBuffer;

  NodeBuffer.prototype.putByte = function(position, val) {
    this._buffer.writeUInt8( val, position );
  }

  NodeBuffer.prototype.putBytes = function( position, val ) {
    if( val instanceof NodeBuffer ) {
      val._buffer.copy(
        this._buffer,
        position,
        val.position,
        val.length - val.position )
    } else {
      throw new Error("Copying not yet implemented.");
    }
  }

  NodeBuffer.prototype.getByte = function(position) {
    return this._buffer.readUInt8( position );
  }

  NodeBuffer.prototype.getFloat64 = function(position) {
    return this._buffer.readDoubleBE(position);
  }

} catch(e) { }

/**
* Allocate a new buffer using whatever mechanism is most sensible for the
* current platform
*/
module.exports.alloc = function(size) {
  return new DefaultBuffer(size);
};

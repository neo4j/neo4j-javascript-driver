
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
module.exports.BaseBuffer = BaseBuffer;

// Calling these out - this is the required 
// methods a subclass needs to implement
BaseBuffer.prototype.getUInt8 = null;
BaseBuffer.prototype.getInt8 = null;
BaseBuffer.prototype.getSlice = null;
BaseBuffer.prototype.putUInt8 = null;
BaseBuffer.prototype.putInt8 = null;

BaseBuffer.prototype.getInt16 = function(p) {
  return this.getInt8(p) << 8
       | this.getInt8(p + 1) & 0xFF;
};

BaseBuffer.prototype.getInt32 = function(p) {
  return this.getInt8(p) << 24
       | this.getUInt8(p + 1) << 16 & 0xFF
       | this.getUInt8(p + 2) << 8  & 0xFF
       | this.getUInt8(p + 3)       & 0xFF;
};

BaseBuffer.prototype.getInt64 = function(p) {
  return this.getInt8(p) << 56
       | this.getUInt8(p + 1) << 48 & 0xFF
       | this.getUInt8(p + 2) << 40 & 0xFF
       | this.getUInt8(p + 3) << 32 & 0xFF
       | this.getUInt8(p + 4) << 24 & 0xFF
       | this.getUInt8(p + 5) << 16 & 0xFF
       | this.getUInt8(p + 6) << 8  & 0xFF
       | this.getUInt8(p + 7)       & 0xFF;
};


BaseBuffer.prototype.putInt16 = function( p, val ) {
  this.putInt8(  p,     val >> 8 );
  this.putUInt8( p + 1, val & 0xFF );
};

BaseBuffer.prototype.putUInt16 = function( p, val ) {
  this.putUInt8( p,     val >> 8 );
  this.putUInt8( p + 1, val & 0xFF );
};

BaseBuffer.prototype.putInt32 = function( p, val ) {
  this.putInt8(  p,     val >> 24 );
  this.putUInt8( p + 1, val >> 16 & 0xFF );
  this.putUInt8( p + 2, val >> 8  & 0xFF );
  this.putUInt8( p + 3, val       & 0xFF );
};

BaseBuffer.prototype.putInt64 = function( p, val ) {
  this.putInt8(  p, val >> 48 );
  this.putUInt8( p + 1, val >> 42 & 0xFF );
  this.putUInt8( p + 2, val >> 36 & 0xFF );
  this.putUInt8( p + 3, val >> 30 & 0xFF );
  this.putUInt8( p + 4, val >> 24 & 0xFF );
  this.putUInt8( p + 5, val >> 16 & 0xFF );
  this.putUInt8( p + 6, val >> 8  & 0xFF );
  this.putUInt8( p + 7, val       & 0xFF );
};

BaseBuffer.prototype.putBytes = function( position, other ) {
  for (var i = 0, end=other.remaining(); i < end; i++) {
    this.putUInt8( position + i, other.readUInt8() );
  }
};

BaseBuffer.prototype.readUInt8 = function() {
  return this.getUInt8( this._updatePos(1) );
};

BaseBuffer.prototype.readInt8 = function() {
  return this.getInt8( this._updatePos(1) );
};

BaseBuffer.prototype.readInt16 = function() {
  return this.getInt16( this._updatePos(2) );
};

BaseBuffer.prototype.readInt32 = function() {
  return this.getInt32( this._updatePos(4) );
};

BaseBuffer.prototype.readInt64 = function() {
  return this.getInt32( this._updatePos(8) );
};

BaseBuffer.prototype.readFloat64 = function() {
  return this.getFloat64( this._updatePos(8) );
};

BaseBuffer.prototype.writeUInt8 = function( val ) {
  this.putUInt8( this._updatePos(1), val);
};

BaseBuffer.prototype.writeInt8 = function( val ) {
  this.putInt8( this._updatePos(1), val);
};

BaseBuffer.prototype.writeInt16 = function( val ) {
  this.putInt16( this._updatePos(2), val);
};

BaseBuffer.prototype.writeInt32 = function( val ) {
  this.putInt32( this._updatePos(4), val);
};

BaseBuffer.prototype.writeInt64 = function( val ) {
  this.putInt64( this._updatePos(8), val);
};

BaseBuffer.prototype.writeBytes = function( val ) {
  this.putBytes( this._updatePos(val.remaining()), val);
};

/**
 * Get a slice of this buffer. This method does not copy any data,
 * but simply provides a slice view of this buffer
 */
BaseBuffer.prototype.readSlice = function( length ) {
  return this.getSlice( this._updatePos( length ), length );
};


BaseBuffer.prototype._updatePos = function( length ) {
  var p = this.position;
  this.position += length;
  return p;
};

BaseBuffer.prototype.remaining = function() {
  return this.length - this.position;
};

BaseBuffer.prototype.hasRemaining = function() {
  return this.remaining() > 0;
};

BaseBuffer.prototype.reset = function() {
  this.position = 0;
};

BaseBuffer.prototype.toString = function() {
  return this.constructor.name + "( position="+this.position+" )\n  " + this.toHex();
};

BaseBuffer.prototype.toHex = function() {
  // TODO something like StringBuilder?
  var out = "";
  for (var i = 0; i < this.length; i++) {
    var hexByte = this.getUInt8(i).toString(16);
    if( hexByte.length == 1 ) {
      hexByte = "0" + hexByte;
    }
    out += hexByte + " "
  }
  return out;
};


/**
 * Basic buffer implementation that should work in most any modern JS env.
 */
function HeapBuffer(arg) {
  this._buffer = arg instanceof ArrayBuffer ? arg : new ArrayBuffer(arg);
  this._view = new DataView( this._buffer );
  BaseBuffer.call(this, this._buffer.byteLength );
}
HeapBuffer.prototype = Object.create( BaseBuffer.prototype );
HeapBuffer.prototype.constructor = HeapBuffer;

module.exports.HeapBuffer = HeapBuffer;

HeapBuffer.prototype.putUInt8 = function( position, val ) {
  this._view.setUint8(position, val);
};

HeapBuffer.prototype.getUInt8 = function( position ) {
  return this._view.getUint8(position);
};

HeapBuffer.prototype.putInt8 = function( position, val ) {
  this._view.setInt8(position, val);
};

HeapBuffer.prototype.getInt8 = function( position ) {
  return this._view.getInt8(position);
};

HeapBuffer.prototype.getFloat64 = function(position) {
  return this._view.getFloat64(position);
};

HeapBuffer.prototype.getSlice = function( start, length ) {
  if( start == 0 && length == this.length ) {
    return this;
  }
  return new HeapBuffer( this._buffer.slice( start, start + length ) );
};

/** 
 * Specific to HeapBuffer, this gets a DataView from the
 * current position and of the specified length. 
 */
HeapBuffer.prototype.readView = function( length ) {
  return new DataView( this._buffer, this.position, length );
};

// Use HeapBuffer by default, unless Buffer API is available, see below
var DefaultBuffer = HeapBuffer;

// Only declare NodeBuffer if we have the Node Buffer API available
try {

  // This will throw an exception is 'buffer' is not available
  require.resolve("buffer");

  var node = require("buffer");

  function NodeBuffer(arg) {
    this._buffer = arg instanceof node.Buffer ? arg : new node.Buffer(arg);
    BaseBuffer.call(this, this._buffer.length);
  }
  NodeBuffer.prototype = Object.create( BaseBuffer.prototype );
  NodeBuffer.prototype.constructor = NodeBuffer;

  DefaultBuffer = NodeBuffer;
  module.exports.NodeBuffer = NodeBuffer;

  NodeBuffer.prototype.getUInt8 = function(position) {
    return this._buffer.readUInt8( position );
  };

  NodeBuffer.prototype.getInt8 = function(position) {
    return this._buffer.readInt8( position );
  };

  NodeBuffer.prototype.getFloat64 = function(position) {
    return this._buffer.readDoubleBE(position);
  };

  NodeBuffer.prototype.putUInt8 = function(position, val) {
    this._buffer.writeUInt8( val, position );
  };

  NodeBuffer.prototype.putInt8 = function(position, val) {
    this._buffer.writeInt8( val, position );
  };

  NodeBuffer.prototype.putBytes = function( position, val ) {
    if( val instanceof NodeBuffer ) {
      var bytesToCopy = Math.min( val.length - val.position, this.length - position );
      val._buffer.copy(
        this._buffer,
        position,
        val.position,
        bytesToCopy )
      val.position += bytesToCopy;
    } else {
      throw new Error("Copying not yet implemented.");
    }
  };

  NodeBuffer.prototype.getSlice = function( start, length ) {
    if( start == 0 && length == this.length ) {
      return this;
    }
    return new NodeBuffer( this._buffer.slice( start, start + length ) );
  };

} catch(e) { }

/**
* Allocate a new buffer using whatever mechanism is most sensible for the
* current platform
*/
module.exports.alloc = function(size) {
  return new DefaultBuffer(size);
};

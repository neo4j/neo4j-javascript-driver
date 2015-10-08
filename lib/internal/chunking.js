
var buf = require('./buf');

var
  CHUNK_HEADER_SIZE= 2,
  MESSAGE_BOUNDARY = 0x00,
  DEFAULT_BUFFER_SIZE = 1400; // http://stackoverflow.com/questions/2613734/maximum-packet-size-for-a-tcp-connection

/**
 * Looks like a writable buffer, chunks output transparently into a channel below.
 */
function Chunker( channel, bufferSize ) {
  this._bufferSize = bufferSize || DEFAULT_BUFFER_SIZE;
  this._ch = channel;
  this._buffer = buf.alloc( this._bufferSize );
  this._currentChunkStart = 0;
  this._chunkOpen = false;
}
Chunker.prototype = Object.create( buf.BaseBuffer.prototype );
Chunker.prototype.constructor = Chunker;

Chunker.prototype.putUInt8 = function( position, val ) {
  this._ensure(1);
  this._buffer.writeUInt8( val );
};

Chunker.prototype.putInt8 = function( position, val ) {
  this._ensure(1);
  this._buffer.writeInt8( val );
};

Chunker.prototype.putBytes = function( position, data ) {
  // TODO: If data is larger than our chunk size or so, we're very likely better off just passing this buffer on rather than doing the copy here
  // TODO: *however* note that we need some way to find out when the data has been written (and thus the buffer can be re-used) if we take that approach
  while ( data.remaining() > 0 )
  {
    // Ensure there is an open chunk, and that it has at least one byte of space left
    this._ensure( 1 );
    var slice = data.readSlice( Math.min( this._buffer.remaining(), data.remaining() ) );
    this._buffer.writeBytes( slice );
  }
  return this;
};

Chunker.prototype.flush = function() {
  if ( this._buffer.position > 0 ) {
    this._closeChunkIfOpen();

    // Local copy and clear the buffer field. This ensures that the buffer is not re-released if the flush call fails
    var out = this._buffer;
    this._buffer = null;

    this._ch.write( out.getSlice( 0, out.position ) );

    // Alloc a new output buffer. We assume we're using NodeJS's buffer pooling under the hood here!
    this._buffer = buf.alloc( this._bufferSize );
    this._chunkOpen = false;
  }
  return this;
};

Chunker.prototype.messageBoundary = function() {

};

/** Ensure at least the given size is available for writing */
Chunker.prototype._ensure = function( size ) {
  var toWriteSize = this._chunkOpen ? size : size + CHUNK_HEADER_SIZE;
  if ( this._buffer.remaining() < toWriteSize ) {
    this.flush();
  }

  if ( !this._chunkOpen ) {
    this._currentChunkStart = this._buffer.position;
    this._buffer.position = this._buffer.position + CHUNK_HEADER_SIZE;
    this._chunkOpen = true;
  }
};

Chunker.prototype._closeChunkIfOpen = function() {
  if ( this._chunkOpen ) {
    var chunkSize = this._buffer.position - (this._currentChunkStart + CHUNK_HEADER_SIZE);
    this._buffer.putUInt16( this._currentChunkStart, chunkSize );
    this._chunkOpen = false;
  }
};

module.exports = {
    "Chunker" : Chunker
};
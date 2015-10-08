

var Chunker = require('../../lib/internal/chunking').Chunker;
var alloc = require('../../lib/internal/buf').alloc;

describe('Chunker', function() {
  it('should chunk simple data', function() {
    // Given
    var ch = new TestChannel();
    var chunker = new Chunker(ch);

    // When
    chunker.writeInt32(1);
    chunker.writeInt32(2);
    chunker.flush();

    // Then
    expect( ch.toHex() ).toBe("00 08 00 00 00 01 00 00 00 02 ");
  });
  it('should chunk blobs larger than the output buffer', function() {
    // Given
    var ch = new TestChannel();
    var chunker = new Chunker(ch, 4);

    // When
    chunker.writeBytes(bytes( 1,2,3,4,5,6 ));
    chunker.flush();

    // Then
    expect( ch.toHex() ).toBe("00 02 01 02 00 02 03 04 00 02 05 06 ");
  });
});

function TestChannel() {
  this._written = [];
}

TestChannel.prototype.write = function( buf ) {
  this._written.push(buf);
};

TestChannel.prototype.toHex = function() {
  var out = "";
  for( var i=0; i<this._written.length; i++ ) {
    out += this._written[i].toHex();
  }
  return out;
};

function bytes() {
  var b = alloc( arguments.length );
  for( var i=0; i<arguments.length; i++ ) {
    b.writeUInt8( arguments[i] );
  }
  b.position = 0;
  return b;
}
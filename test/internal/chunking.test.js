

var Chunker = require('../../lib/internal/chunking').Chunker;
var Dechunker = require('../../lib/internal/chunking').Dechunker;
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
  it('should include message boundaries', function() {
    // Given
    var ch = new TestChannel();
    var chunker = new Chunker(ch);

    // When
    chunker.writeInt32(1);
    chunker.messageBoundary();
    chunker.writeInt32(2);
    chunker.flush();

    // Then
    expect( ch.toHex() ).toBe("00 04 00 00 00 01 00 00 00 04 00 00 00 02 ");
  });
});

describe('Dechunker', function() {
  it('should unchunk a simple message', function() {
    // Given
    var messages = [];
    var dechunker = new Dechunker();
    var chunker = new Chunker(dechunker);
    dechunker.onmessage = function(buffer) { messages.push(buffer); };

    // When
    chunker.writeInt16(1);
    chunker.writeInt16(2);
    chunker.flush();
    chunker.writeInt16(3);
    chunker.messageBoundary();
    chunker.flush();

    // Then
    expect( messages.length ).toBe( 1 );
    expect( messages[0].toHex() ).toBe( "00 01 00 02 00 03 " );
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
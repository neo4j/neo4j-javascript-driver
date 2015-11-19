/**
 * Copyright (c) 2002-2015 "Neo Technology,"
 * Network Engine for Objects in Lund AB [http://neotechnology.com]
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

var Chunker = require('../../build/node/internal/chunking').Chunker;
var Dechunker = require('../../build/node/internal/chunking').Dechunker;
var alloc = require('../../build/node/internal/buf').alloc;
var CombinedBuffer = require('../../build/node/internal/buf').CombinedBuffer;

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

  it('should handle message split at any point', function() {
    // Given
    var ch = new TestChannel();
    var chunker = new Chunker(ch);

    // And given the following message
    chunker.writeInt8(1);
    chunker.writeInt16(2);
    chunker.writeInt32(3);
    chunker.writeUInt8(4);
    chunker.writeUInt32(5);
    chunker.messageBoundary();
    chunker.flush();

    var chunked = ch.toBuffer();

    // When I try splitting this chunked data at every possible position
    // into two separate buffers, and send those to the dechunker
    for (var i = 1; i < chunked.length; i++) {
      var slice1 = chunked.getSlice( 0, i );
      var slice2 = chunked.getSlice( i, chunked.length - i );

      // Dechunk the slices
      var messages = [];
      var dechunker = new Dechunker();
      dechunker.onmessage = function(buffer) { messages.push(buffer); };
      dechunker.write( slice1 );
      dechunker.write( slice2 );

      // Then, the output should be correct
      expect( messages.length ).toBe( 1 );
      expect( messages[0].toHex() ).toBe( "01 00 02 00 00 00 03 04 00 00 00 05 " );
    };
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

TestChannel.prototype.toBuffer = function() {
  return new CombinedBuffer( this._written );
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
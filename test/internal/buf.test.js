/**
 * Copyright (c) 2002-2016 "Neo Technology,"
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

var alloc = require('../../lib/v1/internal/buf').alloc;
var CombinedBuffer = require('../../lib/v1/internal/buf').CombinedBuffer;
var utf8 = require('../../lib/v1/internal/utf8');
var Unpacker = require("../../lib/v1/internal/packstream.js").Unpacker;

describe('buffers', function() {
  it('should have helpful toString', function() {
    // Given
    var b = alloc(4);
    b.writeInt8(1);
    b.writeInt8(8);
    b.writeInt8(15);
    b.writeInt8(127);

    // When
    var str = b.toString();
    var hex = b.toHex();

    // Then
    expect( str ).toContain("( position=4 )\n  01 08 0f 7f");
    expect(hex).toBe("01 08 0f 7f ");
  });

  it('should read and write 8-bit unsigned integers', function() {
    // Given
    var b = alloc(1);

    for (var i = 0; i < 7; i++) {
      var n = Math.pow(2, i);

      // When
      b.putUInt8( 0, n );

      // Then
      expect( b.getUInt8(0) ).toBe( n );
    }
  });

  it('should read and write 16-bit unsigned integers', function() {
    // Given
    var b = alloc(2);

    for (var i = 0; i < 15; i++) {
      var n = Math.pow(2, i);

      // When
      b.putUInt16( 0, n );

      // Then
      expect( b.getUInt16(0) ).toBe( n );
    }
  });

  it('should read and write 32-bit unsigned integers', function() {
    // Given
    var b = alloc(4);

    for (var i = 0; i < 30; i++) {
      var n = Math.pow(2, i);

      // When
      b.putUInt32( 0, n );

      // Then
      expect( b.getUInt32(0) ).toBe( n );
    }
  });

  it('should read and write 8-bit signed integers', function() {
    // Given
    var b = alloc(1);

    for (var i = 0; i < 6; i++) {
      var n = Math.pow(2, i);

      // When
      b.putInt8( 0, n );

      // Then
      expect( b.getInt8(0) ).toBe( n );
    }
  });

  it('should read and write 16-bit signed integers', function() {
    // Given
    var b = alloc(2);

    for (var i = 0; i < 14; i++) {
      var n = Math.pow(2, i);

      // When
      b.putInt16( 0, n );

      // Then
      expect( b.getInt16(0) ).toBe( n );
    }
  });

  it('should read and write 32-bit signed integers', function() {
    // Given
    var b = alloc(4);

    for (var i = 0; i < 30; i++) {
      var n = Math.pow(2, i);

      // When
      b.putInt32( 0, n );

      // Then
      expect( b.getInt32(0) ).toBe( n );
    }
  });

  it('should encode list correctly', function() {
    // Given
    var b = alloc(5);
    b.writeUInt8(0x90 | 0x2);
    b = writeString(b, 'a');
    b = writeString(b, 'b');
    // When
    var hex = b.toHex();
    // Then
    expect(hex).toBe("92 81 61 81 62 ");
  });

  it('should decode list correctly', function() {
    // Given
    var b = alloc(5);
    b.writeUInt8(0x92);
    b.writeUInt8(0x81);
    b.writeUInt8(0x61);
    b.writeUInt8(0x81);
    b.writeUInt8(0x62);
    b.reset();

    // When
    var data = new Unpacker().unpack( b );

    // Then
    expect(data[0]).toBe('a');
    expect(data[1]).toBe('b');
  });
});

describe('CombinedBuffer', function() {
  it('should read int8', function() {
    // Given
    var b1 = alloc(1);
    var b2 = alloc(1);
    b1.putInt8(0, 1);
    b2.putInt8(0, 2);

    var b = new CombinedBuffer([b1,b2]);
    
    // When
    var first = b.readInt8();
    var second = b.readInt8();

    // Then
    expect(first).toBe(1);
    expect(second).toBe(2);
  });

  it('should read divided float64', function() {
    // Given
    var inner = alloc(8);
    inner.putFloat64(0, 0.1);

    var b = new CombinedBuffer([inner.readSlice(4),inner.readSlice(4)]);
    
    // When
    var read = b.readFloat64();

    // Then
    expect(read).toBe(0.1);
  });
});

function writeString(b, str) {
  var bytes = utf8.encode(str);
  var size = bytes.length;
  b.writeUInt8(0x80 | size);
  b.writeBytes(bytes);
  return b;
}

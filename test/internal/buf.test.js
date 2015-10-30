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

var alloc = require('../../build/node/internal/buf').alloc;
var utf8 = require('../../build/node/internal/utf8');
var Unpacker = require("../../build/node/internal/packstream.js").Unpacker;

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

  it('should read and write integers', function() {
    // Given
    var b = alloc(2);

    // When
    b.putInt16( 0, -1234 );

    // Then
    expect( b.getInt16(0) ).toBe( -1234 );
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
    //Given
    
    var b = alloc(5);
    b.writeUInt8(0x92);
    b.writeUInt8(0x81);
    b.writeUInt8(0x61);
    b.writeUInt8(0x81);
    b.writeUInt8(0x62);
    b.reset();
    var data = new Unpacker().unpack( b );
    expect(data[0]).toBe('a');
    expect(data[1]).toBe('b');
    
  });
});

function writeString(b, str) {
  var bytes = utf8.encode(str);
  var size = bytes.length;
  b.writeUInt8(0x80 | size);
  b.writeBytes(bytes);
  return b;
}

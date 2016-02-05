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
 
var alloc = require('../../lib/v1/internal/buf').alloc,
    packstream = require("../../lib/v1/internal/packstream.js"),
    integer = require("../../lib/v1/integer.js"),
    Packer = packstream.Packer,
    Unpacker = packstream.Unpacker,
    Structure = packstream.Structure,
    Integer = integer.Integer;

describe('packstream', function() {
  it('should pack integers', function() {
    var n, i;
    // test small numbers
    for(n = -999; n <= 999; n += 1) {
      i = Integer.fromNumber(n);
      expect( packAndUnpack( i ).toString() ).toBe( i.toString() );
    }
    // positive numbers
    for(n = 16; n <= 16 ; n += 1) {
      i = Integer.fromNumber(Math.pow(2, n));
      expect( packAndUnpack( i ).toString() ).toBe( i.toString() );
    }
    // negative numbers
    for(n = 0; n <= 63 ; n += 1) {
      i = Integer.fromNumber(-Math.pow(2, n));
      expect( packAndUnpack( i ).toString() ).toBe( i.toString() );
    }
  });
  it('should pack strings', function() {
    expect( packAndUnpack( "" ) ).toBe( "" );
    expect( packAndUnpack( "abcdefg123567" ) ).toBe( "abcdefg123567" );
  });
  it('should pack structures', function() {
    expect( packAndUnpack( new Structure(1, ["Hello, world!!!"] ) ).fields[0] )  
     .toBe( "Hello, world!!!" );
  });
  it('should pack lists', function() {
   var list = ['a', 'b'];
   var roundtripped = packAndUnpack( list );
   expect( roundtripped[0] ).toBe( list[0] );
   expect( roundtripped[1] ).toBe( list[1] );
  });

  it('should pack long lists', function() {
    var listLength = 256;
    var list = [];
    for(var i = 0; i < listLength; i++) {
      list.push(null)
    }
    var roundtripped = packAndUnpack( list, 1400 );
    expect( roundtripped[0] ).toBe( list[0] );
    expect( roundtripped[1] ).toBe( list[1] );
  });
});

function packAndUnpack( val, bufferSize ) {
  bufferSize = bufferSize || 128;
  var buffer = alloc(bufferSize);
  new Packer( buffer ).pack( val );
  buffer.reset();
  return new Unpacker().unpack( buffer );
}

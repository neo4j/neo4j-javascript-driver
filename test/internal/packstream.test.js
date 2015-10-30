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
 
var alloc = require('../../build/node/internal/buf').alloc,
    packstream = require("../../build/node/internal/packstream.js"),
    Packer = packstream.Packer,
    Unpacker = packstream.Unpacker,
    Structure = packstream.Structure;

describe('packstream', function() {
  it('should pack integers', function() {
    // TODO: Test extremes - sorting out how to deal with integers > 32bit
    expect( packAndUnpack( 1234 ) ).toBe( 1234 );
    expect( packAndUnpack( 0 ) ).toBe( 0 );
    expect( packAndUnpack( -1234 ) ).toBe( -1234 );
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
});

function packAndUnpack( val ) {
  var buffer = alloc(128);
  new Packer( buffer ).pack( val );
  buffer.reset();
  return new Unpacker().unpack( buffer );
}

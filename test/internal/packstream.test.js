
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

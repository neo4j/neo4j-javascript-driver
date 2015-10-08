
var alloc = require('../../build/node/internal/buf').alloc,
    packstream = require("../../build/node/internal/packstream.js"),
    Packer = packstream.Packer,
    Unpacker = packstream.Unpacker;

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
});

function packAndUnpack( val ) {
  var buffer = alloc(128);
  new Packer( buffer ).pack( val );
  buffer.reset();
  return new Unpacker().unpack( buffer );
}


var utf8 = require('../lib/utf8');

describe('utf8', function() {
  it('should have a nice clean buffer position after serializing', function() {
    // When
    var buffer = utf8.encode("hello, world!");

    // Then
    expect( buffer.position ).toBe( 0 );
  });

  it('should read/write utf8', function() {
    expect( packAndUnpack( "" ) ).toBe( "" );
    expect( packAndUnpack( "åäö123" ) ).toBe( "åäö123"  );
  });
});

function packAndUnpack( str ) {
  var buffer = utf8.encode( str );
  return utf8.decode( buffer, buffer.length );
}

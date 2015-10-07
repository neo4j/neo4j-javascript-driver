

var alloc = require('../lib/buf').alloc;

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

    // Then
    expect( str ).toContain("Buffer( position=4 )\n  10 80 f0 7f");
  });

  it('should read and write integers', function() {
    // Given
    var b = alloc(2);

    // When
    b.putInt16( 0, -1234 );

    // Then
    expect( b.getInt16(0) ).toBe( -1234 );
  });

});

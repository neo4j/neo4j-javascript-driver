
var connect = require("../../build/node/internal/connector.js").connect;

describe('connector', function() {
  it('should read/write basic messages', function(done) {
    // Given
    var conn = connect("neo4j://localhost")

    // When
    conn.initialize( "mydriver/0.0.0", function( err, msg ) {

      // Then
      expect( err ).toBeNull();
      expect( msg ).not.toBeNull(); // TODO Assert is success

      done();
    });
    conn.sync();

  });
});

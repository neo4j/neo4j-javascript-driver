
var connect = require("../../build/node/internal/connector.js").connect;

describe('connector', function() {
  it('should read/write basic messages', function(done) {
    // Given
    var conn = connect("neo4j://localhost")

    // When
    conn.initialize( "mydriver/0.0.0", {
      onCompleted: function( msg ) {

        // Then
        expect( msg ).not.toBeNull(); // TODO Assert is success

        done();
      },
      onError: function( err ) {
        expect( err ).toBeNull();
        done();
      }
    });
    conn.sync();

  });
});

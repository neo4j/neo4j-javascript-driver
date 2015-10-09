
var connect = require("../../build/node/internal/connector.js").connect;

describe('connector', function() {
  it('should read/write basic messages', function(done) {
    // Given
    var conn = connect("neo4j://localhost")

    // When
    conn.initialize( "mydriver/0.0.0", {
      onCompleted: function( msg ) {
        expect( msg ).not.toBeNull();
        done();
      },
      onError: function( err ) {
        expect( err ).toBeNull();
        done();
      }
    });
    conn.sync();

  });
  it('should retrieve stream', function(done) {
    // Given
    var conn = connect("neo4j://localhost")

    // When
    var records = [];
    conn.initialize( "mydriver/0.0.0" );
    conn.run( "RETURN 1", {} );
    conn.pullAll( {
      onNext: function( record ) {
        records.push( record ); 
      },
      onCompleted: function( tail ) {
        expect( records[0][0] ).toBe( 1 );
        done();
      }
    });
    conn.sync();

  });
});

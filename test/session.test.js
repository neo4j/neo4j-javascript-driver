
var neo4j = require("../build/node/neo4j");

describe('session', function() {
  it('should expose basic run/subscribe ', function(done) {
    // Given
    var driver = neo4j.driver("neo4j://localhost");

    // When & Then
    var records = [];
    driver.session().run( "RETURN 1 AS a").subscribe( {
      onNext : function( record ) {
        records.push( record ); 
      },
      onCompleted : function( ) {
        expect( records.length ).toBe( 1 );
        expect( records[0]['a'] ).toBe( 1 );
        driver.close();
        done();
      }
    });
  });

  it('should expose basic run/then/then ', function(done) {
    // Given
    var driver = neo4j.driver("neo4j://localhost");
    // When & Then
    driver.session().run( "RETURN 1 AS a")
    .then( 
      function( records ) {
        expect( records.length ).toBe( 1 );
        expect( records[0]['a'] ).toBe( 1 );
      }
    ).then(
      function(records) {
        expect( records.length ).toBe( 1 );
        expect( records[0]['a'] ).toBe( 1 );
        done();
      }
    ).then( function() { driver.close(); })
  });

  it('should expose basic run/catch ', function(done) {
    // Given
    var driver = neo4j.driver("neo4j://localhost");
    // When & Then
    driver.session().run( "RETURN 1 AS").catch(
      function(error) {
        expect( error.fields.length).toBe(1);
        driver.close();
        done();
      }
    )
  });
});
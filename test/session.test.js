
var neo4j = require("../build/node/neo4j");

describe('session', function() {
  it('should expose basic run/subscribe ', function(done) {
    // Given
    var driver = neo4j.driver("neo4j://localhost");

    // When & Then
    var records = [];
    driver.session().run( "RETURN 1.0 AS a").subscribe( {
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

  it('should expose basic run/then/then/then ', function(done) {
    // Given
    var driver = neo4j.driver("neo4j://localhost");
    // When & Then
    driver.session().run( "RETURN 1.0 AS a")
    .then( 
      function( records ) {
        expect( records.length ).toBe( 1 );
        expect( records[0]['a'] ).toBe( 1 );
      }
    ).then(
      function(records) {
        expect( records.length ).toBe( 1 );
        expect( records[0]['a'] ).toBe( 1 );
      }
    ).then( function() { driver.close(); done(); })
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

  it('should expose summarize method ', function(done) {
    // Given
    var driver = neo4j.driver("neo4j://localhost");
    var statement = "CREATE (n:Label) RETURN n";
    // When & Then
    var result = driver.session().run( statement );
    result.then(function( records ) {
      var sum = result.summarize();
      expect(sum.statement).toBe( statement );
      expect(sum.statistics.containsUpdates()).toBe(true);
      expect(sum.statistics.nodesCreated()).toBe(1);
      expect(sum.statementType).toBe('rw');
      driver.close(); 
      done();
    });
  });
});


var neo4j = require("../build/node/neo4j");
var StatementType = require("../build/node/result").statementType;

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

  it('should accept a statement object ', function(done) {
    // Given
    var driver = neo4j.driver("neo4j://localhost");
    var statement = {text: "RETURN 1 = {param} AS a", parameters: {param: 1}};

    // When & Then
    var records = [];
    driver.session().run( statement ).subscribe( {
      onNext : function( record ) {
        records.push( record );
      },
      onCompleted : function( ) {
        expect( records.length ).toBe( 1 );
        expect( records[0]['a'] ).toBe( true );
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

  it('should expose summarize method for basic metadata ', function(done) {
    // Given
    var driver = neo4j.driver("neo4j://localhost");
    var statement = "CREATE (n:Label {prop:{prop}}) RETURN n";
    var params = {prop: "string"}
    // When & Then
    var result = driver.session().run( statement, params );
    result.then(function( records ) {
      var sum = result.summarize();
      expect(sum.statement.text).toBe( statement );
      expect(sum.statement.parameters).toBe( params );
      expect(sum.updateStatistics.containsUpdates()).toBe(true);
      expect(sum.updateStatistics.nodesCreated()).toBe(1);
      expect(sum.statementType).toBe(StatementType.READ_WRITE);
      driver.close(); 
      done();
    });
  });

  it('should expose plan ', function(done) {
    // Given
    var driver = neo4j.driver("neo4j://localhost");
    var statement = "EXPLAIN CREATE (n:Label {prop:{prop}}) RETURN n";
    var params = {prop: "string"}
    // When & Then
    var result = driver.session().run( statement, params );
    result.then(function( records ) {
      var sum = result.summarize();
      expect(sum.hasPlan()).toBe(true);
      expect(sum.hasProfile()).toBe(false);
      expect(sum.plan.operatorType).toBe('ProduceResults');
      expect(sum.plan.arguments.runtime).toBe('INTERPRETED');
      expect(sum.plan.identifiers[0]).toBe('n');
      expect(sum.plan.children[0].operatorType).toBe('CreateNode');
      driver.close(); 
      done();
    });
  });

  it('should expose profile ', function(done) {
    // Given
    var driver = neo4j.driver("neo4j://localhost");
    var statement = "PROFILE MATCH (n:Label {prop:{prop}}) RETURN n";
    var params = {prop: "string"}
    // When & Then
    var result = driver.session().run( statement, params );
    result.then(function( records ) {
      var sum = result.summarize();
      expect(sum.hasPlan()).toBe(true); //When there's a profile, there's a plan
      expect(sum.hasProfile()).toBe(true);
      expect(sum.profile.operatorType).toBe('ProduceResults');
      expect(sum.profile.arguments.runtime).toBe('INTERPRETED');
      expect(sum.profile.identifiers[0]).toBe('n');
      expect(sum.profile.children[0].operatorType).toBe('Filter');
      expect(sum.profile.rows).toBeGreaterThan(0);
      //expect(sum.profile.dbHits).toBeGreaterThan(0);
      driver.close(); 
      done();
    });
  });
});

/**
 * Copyright (c) 2002-2016 "Neo Technology,"
 * Network Engine for Objects in Lund AB [http://neotechnology.com]
 *
 * This file is part of Neo4j.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var neo4j = require("../../lib/v1");
var StatementType = require("../../lib/v1/result-summary").statementType;
var Session = require("../../lib/v1/session");

describe('session', function() {

  var driver, session;

  beforeEach(function(done) {
    driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"));
    session = driver.session();

    session.run("MATCH (n) DETACH DELETE n").then(done);
  });

  afterEach(function() {
    driver.close();
  });

  it('close should be idempotent ', function(){
    // Given
    var counter = 0;
    var _session = new Session(null, function(){
      counter++;
    });
    _session.close();
    expect(counter).toBe(1);
    _session.close();
    expect(counter).toBe(1);
  });

  it('should expose basic run/subscribe ', function(done) {
    // Given

    // When & Then
    var records = [];
    session.run( "RETURN 1.0 AS a").subscribe( {
      onNext : function( record ) {
        records.push( record );
      },
      onCompleted : function( ) {
        expect( records.length ).toBe( 1 );
        expect( records[0].get('a') ).toBe( 1 );
        done();
      }
    });
  });

  it('should keep context in subscribe methods ', function(done) {
    // Given
    function myObserver(){
      this.local = 'hello';
      var privateLocal = 'hello';
      this.onNext = function() {
        expect(privateLocal).toBe('hello');
        expect(this.local).toBe('hello');
      };
      this.onCompleted = function() {
        expect(privateLocal).toBe('hello');
        expect(this.local).toBe('hello');
        done();
      }
    }

    // When & Then
    session.run( "RETURN 1.0 AS a").subscribe(new myObserver());
  });

  it('should call observers onError on error ', function(done) {

    // When & Then
    session.run( "RETURN 1 AS").subscribe( {
      onError: function(error) {
        expect(error.fields.length).toBe(1);
        done();
      }
    });
  });

  it('should accept a statement object ', function(done) {
    // Given
    var statement = {text: "RETURN 1 = {param} AS a", parameters: {param: 1}};

    // When & Then
    var records = [];
    session.run( statement ).subscribe( {
      onNext : function( record ) {
        records.push( record );
      },
      onCompleted : function( ) {
        expect( records.length ).toBe( 1 );
        expect( records[0].get('a') ).toBe( true );
        done();
      }
    });
  });

  it('should expose run/then/then/then ', function(done) {
    // When & Then
    session.run( "RETURN 1.0 AS a")
    .then(
      function(result) {
        expect(result.records.length).toBe( 1 );
        expect(result.records[0].get('a')).toBe( 1 );
        return result
      }
    ).then(
      function(result) {
        expect(result.records.length).toBe( 1 );
        expect(result.records[0].get('a')).toBe( 1 );
      }
    ).then( done );
  });

  it('should expose basic run/catch ', function(done) {
    // When & Then
    session.run( "RETURN 1 AS").catch(
      function(error) {
        expect( error.fields.length).toBe(1);
        done();
      }
    )
  });

  it('should expose summarize method for basic metadata ', function(done) {
    // Given
    var statement = "CREATE (n:Label {prop:{prop}}) RETURN n";
    var params = {prop: "string"};
    // When & Then
    session.run( statement, params )
          .then(function(result) {
      var sum = result.summary;
      expect(sum.statement.text).toBe( statement );
      expect(sum.statement.parameters).toBe( params );
      expect(sum.updateStatistics.containsUpdates()).toBe(true);
      expect(sum.updateStatistics.nodesCreated()).toBe(1);
      expect(sum.statementType).toBe(StatementType.READ_WRITE);
      done();
    });
  });

  it('should expose empty parameter map on call with no parameters', function(done) {
    // Given
    var statement = "CREATE (n:Label {prop:'string'}) RETURN n";
    // When & Then
    session.run(statement)
      .then(function(result) {
        var sum = result.summary;
        expect(sum.statement.parameters).toEqual( {} );
        done();
      });
  });

  it('should expose plan ', function(done) {
    // Given
    var statement = "EXPLAIN CREATE (n:Label {prop:{prop}}) RETURN n";
    var params = {prop: "string"};
    // When & Then
    session
          .run( statement, params )
          .then(function(result) {
      var sum = result.summary;
      expect(sum.hasPlan()).toBe(true);
      expect(sum.hasProfile()).toBe(false);
      expect(sum.plan.operatorType).toBe('ProduceResults');
      expect(sum.plan.arguments.runtime).toBe('INTERPRETED');
      expect(sum.plan.identifiers[0]).toBe('n');
      expect(sum.plan.children[0].operatorType).toBe('CreateNode');
      done();
    });
  });

  it('should expose profile ', function(done) {
    // Given
    var statement = "PROFILE MATCH (n:Label {prop:{prop}}) RETURN n";
    var params = {prop: "string"};
    // When & Then
    session
          .run( statement, params )
          .then(function(result) {
      var sum = result.summary;
      expect(sum.hasPlan()).toBe(true); //When there's a profile, there's a plan
      expect(sum.hasProfile()).toBe(true);
      expect(sum.profile.operatorType).toBe('ProduceResults');
      expect(sum.profile.arguments.runtime).toBe('INTERPRETED');
      expect(sum.profile.identifiers[0]).toBe('n');
      expect(sum.profile.children[0].operatorType).toBe('Filter');
      expect(sum.profile.rows).toBe(0);
      //expect(sum.profile.dbHits).toBeGreaterThan(0);
      done();
    });
  });

  it('should expose cypher notifications ', function(done) {
    // Given
    var statement = "EXPLAIN MATCH (n), (m) RETURN n, m";
    // When & Then
    session
          .run( statement )
          .then(function(result) {
      var sum = result.summary;
      expect(sum.notifications.length).toBeGreaterThan(0);
      expect(sum.notifications[0].code).toBe("Neo.ClientNotification.Statement.CartesianProductWarning");
      expect(sum.notifications[0].title).toBe("This query builds a cartesian product between disconnected patterns.");
      expect(sum.notifications[0].position.column).toBeGreaterThan(0);
      done();
    });
  });

  it('should fail when using the session when having an open transaction', function (done) {

    // When
    session.beginTransaction();

    //Then
    session.run("RETURN 42")
      .catch(function (error) {
        expect(error.message).toBe("Statements cannot be run directly on a "
         + "session with an open transaction; either run from within the "
         + "transaction or use a different session." );
        done();
      })
  });

  it('should fail when opening multiple transactions', function () {

    // When
    session.beginTransaction();

    // Then
    expect(session.beginTransaction).toThrow();
  });

  it('should return lots of data', function (done) {
    session.run("UNWIND range(1,1000) AS x CREATE (t:testNode {name: 'testNameString'})")
      .then(function () {
        session.run("MATCH (n) RETURN n.name")
          .subscribe({
              onNext: function (record) {
                var node = record.get('n');
                expect(node.name).toEqual("testNameString");
              },
              onCompleted: function () {
                // Completed!
                session.close();
                done()
              },
              onError: function (error) {
                console.log(error);
              }
            }
          )
      });
  });
});

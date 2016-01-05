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

var _console = console;

describe('transaction', function() {

  var driver, session, out, console;

  beforeEach(function(done) {
    driver = neo4j.driver("bolt://localhost");
    session = driver.session();

    // Override console.log, to assert on stdout output
    out = [];
    console = { log: function(msg) { out.push(msg); }  };

    session.run("MATCH (n) DETACH DELETE n").then(done);
  });

  afterEach(function() {
    driver.close();
  });

  it('should document a minimum viable snippet', function(done) {
    // tag::minimum-snippet[]
    var driver = neo4j.driver("bolt://localhost");
    var session = driver.session();

    session.run( "CREATE (neo:Person {name:'Neo', age:23})" );

    session
      .run( "MATCH (p:Person) WHERE p.name = 'Neo' RETURN p.age" )
      .then( function( result ) {
        console.log( "Neo is " + result[0]["p.age"].toInt() + " years old." );

        session.close();
        driver.close();
        done();
      });
    // end::minimum-snippet[]
  });

  it('should document a statement', function(done) {
    var resultPromise =
    // tag::statement[]
    session
      .run( "CREATE (p:Person { name: {name} })", {"name": "The One"} )
      .then( function(result) {
        var theOnesCreated = result.summary.updateStatistics.nodesCreated();
        console.log("There were " + theOnesCreated + " the ones created.")
      });
    // end::statement[]

    // Then
    resultPromise.then(function() {
      expect(out[0]).toBe("There were 1 the ones created.");
      done();
    });
  });

  it('should document a statement without parameters', function(done) {
    var resultPromise =
    // tag::statement-without-parameters[]
    session
      .run( "CREATE (p:Person { name: 'The One' })" )
      
      .then( function(result) {
        var theOnesCreated = result.summary.updateStatistics.nodesCreated();
        console.log("There were " + theOnesCreated + " the ones created.");
      });
    // end::statement-without-parameters[]

    // Then
    resultPromise.then(function() {
      expect(out[0]).toBe("There were 1 the ones created.");
      done();
    })
  });

  it('should document committing a transaction', function() {
    // tag::transaction-commit[]
    var tx = session.beginTransaction();
    tx.run( "CREATE (p:Person { name: 'The One' })" );
    tx.commit();
    // end::transaction-commit[]
  });

  it('should document rolling back a transaction', function() {
    // tag::transaction-rollback[]
    var tx = session.beginTransaction();
    tx.run( "CREATE (p:Person { name: 'The One' })" );
    tx.rollback();
    // end::transaction-rollback[]
  });

  it('should document how to require encryption', function() {
    // tag::tls-require-encryption[]
    // Unfortunately, this feature is not yet implemented for JavaScript
    // end::tls-require-encryption[]
  });

  it('should document how to configure trust-on-first-use', function() {  
    // tag::tls-trust-on-first-use[]
    // Unfortunately, this feature is not yet implemented for JavaScript
    // end::tls-trust-on-first-use[]
  }); 

  it('should document how to configure a trusted signing certificate', function() {  
    // tag::tls-signed[]
    // Unfortunately, this feature is not yet implemented for JavaScript
    // end::tls-signed[]
  });

});

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

var neo4jv1 = require("../../lib/v1");

var _console = console;

/**
* The tests below are examples that get pulled into the Driver Manual using the tags inside the tests.
*
* DO NOT add tests to this file that are not for that exact purpose.
* DO NOT modify these tests without ensuring they remain consistent with the equivalent examples in other drivers
*/
describe('examples', function() {

  var driverGlobal, sessionGlobal, out, console;

  beforeEach(function(done) {
    var neo4j = neo4jv1;
    // tag::construct-driver[]
    driverGlobal = neo4j.driver("bolt://localhost", neo4jv1.auth.basic("neo4j", "neo4j"));
    //end::construct-driver[]
    sessionGlobal = driverGlobal.session();

    // Override console.log, to assert on stdout output
    out = [];
    console = { log: function(msg) { out.push(msg); }  };

    sessionGlobal.run("MATCH (n) DETACH DELETE n").then(done);
  });

  afterEach(function() {
    sessionGlobal.close();
    driverGlobal.close();
  });

  it('should document a minimal import and usage example', function (done) {
    //OH my is this a hack
    var require = function (arg) {
      return {v1: neo4jv1}
    };
    // tag::minimal-example-import[]
    var neo4j = require('neo4j-driver').v1;
    // end::minimal-example-import[]
    // tag::minimal-example[]
    var driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"));
    var session = driver.session();
    session.run( "CREATE (neo:Person {name:'Neo', age:23})" );
    session
      .run( "MATCH (p:Person) WHERE p.name = 'Neo' RETURN p.age" )
      .then( function( result ) {
        console.log( "Neo is " + result.records[0].get("p.age").toInt() + " years old." );
        session.close();
        driver.close();
      });
    // end::minimal-example[]
    setTimeout(function() {
      expect(out[0]).toBe("Neo is 23 years old.");
      done();
    }, 500);
  });

  it('should be able to configure session pool size', function (done) {
   var neo4j = neo4jv1;
    // tag::configuration[]
    var driver = neo4j.driver("bolt://localhost", neo4jv1.auth.basic("neo4j", "neo4j"), {connectionPoolSize: 50});
    //end::configuration[]

    var s = driver.session();
    s.run( "CREATE (p:Person { name: {name} })", {name: "The One"} )
      .then( function(result) {
        var theOnesCreated = result.summary.updateStatistics.nodesCreated();
        console.log(theOnesCreated);
        s.close();
        driver.close();
      });

    setTimeout(function() {
      expect(out[0]).toBe(1);
      done();
    }, 500);
  });

  it('should document a statement', function(done) {
    var session = sessionGlobal;
    var resultPromise =
    // tag::statement[]
    session
      .run( "CREATE (p:Person { name: {name} })", {name: "The One"} )
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
    var session = sessionGlobal;
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

  it('should be able to iterate results', function(done) {
    var session = sessionGlobal;
    // tag::retain-result-query[]
      session
        .run( "MATCH (p:Person { name: {name} }) RETURN p.age", {name : "The One"} )
        .subscribe({
          onNext: function(record) {
            console.log(record);
          },
          onCompleted: function() {
            // Completed!
            session.close();
          },
          onError: function(error) {
            console.log(error);
          }
        });
    // end::retain-result-query[]
    // Then
    done();
  });

  it('should be able to do nested queries', function(done) {
    var session = sessionGlobal;

    session.run("CREATE (:Person {name:'The One'})").then(function() {
        // tag::result-cursor[]
        session
          .run("MATCH (p:Person { name: {name} }) RETURN id(p)", {name: "The One"})
          .then(function (result) {
            var id = result.records[0].get('id(p)');
            session.run( "MATCH (p) WHERE id(p) = {id} CREATE (p)-[:HAS_TRAIT]->(:Trait {type:'Immortal'})", {id: id })
              .then(function (neoRecord) {
                var immortalsCreated = neoRecord.summary.updateStatistics.nodesCreated();
                var relationshipCreated = neoRecord.summary.updateStatistics.relationshipsCreated();
                console.log("There were " + immortalsCreated + " immortal and " + relationshipCreated +
                  " relationships created");
              });
          });
      // tag::result-cursor[]
    });

    //await the result
    setTimeout(function() {
      expect(out[0]).toBe("There were 1 immortal and 1 relationships created");
      done();
    }, 500);
  });

  it('should be able to retain for later processing', function(done) {
    var session = sessionGlobal;

    session.run("CREATE (:Person {name:'The One', age: 23})").then(function() {
      // tag::retain-result-process[]
      session
        .run("MATCH (p:Person { name: {name} }) RETURN p.age", {name: "The One"})
        .then(function (result) {
          for (i = 0; i < result.records.length; i++) {
            result.records[i].forEach(function (value, key, record) {
              console.log("Value for key " + key + " has value " + value);
            });
          }

        });
      // end::retain-result-process[]
    });

    //await the result
    setTimeout(function() {
      expect(out[0]).toBe("Value for key p.age has value 23");
      done();
    }, 500);
  });

  it('should be able to handle cypher error', function(done) {
    var session = sessionGlobal;

    // tag::handle-cypher-error[]
    session
      .run("Then will cause a syntax error")
      .catch( function(err) {
        expect(err.fields[0].code).toBe( "Neo.ClientError.Statement.SyntaxError" );
        done();
      });
    // end::handle-cypher-error[]
  });

  it('should be able to profile', function(done) {
    var session = sessionGlobal;

    session.run("CREATE (:Person {name:'The One', age: 23})").then(function() {
      // tag::result-summary-query-profile[]
      session
        .run("PROFILE MATCH (p:Person { name: {name} }) RETURN id(p)", {name: "The One"})
        .then(function (result) {
          console.log(result.summary.profile);
        });
      // end::result-summary-query-profile[]
    });

    //await the result
    setTimeout(function() {
      expect(out.length).toBe(1);
      done();
    }, 500);
  });

  it('should be able to see notifications', function(done) {
    var session = sessionGlobal;

    // tag::result-summary-notifications[]
    session
      .run("EXPLAIN MATCH (a), (b) RETURN a,b")
      .then(function (result) {
        var notifications = result.summary.notifications, i;
        for (i = 0; i < notifications.length; i++) {
          console.log(notifications[i].code);
        }
      });
    // end::result-summary-notifications[]

    setTimeout(function () {
      expect(out[0]).toBe("Neo.ClientNotification.Statement.CartesianProductWarning");
      done();
    }, 500);
  });

  it('should document committing a transaction', function() {
    var session = sessionGlobal;

    // tag::transaction-commit[]
    var tx = session.beginTransaction();
    tx.run( "CREATE (p:Person { name: 'The One' })" );
    tx.commit();
    // end::transaction-commit[]
  });

  it('should document rolling back a transaction', function() {
    var session = sessionGlobal;

    // tag::transaction-rollback[]
    var tx = session.beginTransaction();
    tx.run( "CREATE (p:Person { name: 'The One' })" );
    tx.rollback();
    // end::transaction-rollback[]
  });

  it('should document how to require encryption', function() {
    var session = sessionGlobal;

    var neo4j = neo4jv1;
    // tag::tls-require-encryption[]
    var driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"), {
      // In NodeJS, encryption is on by default. In the web bundle, it is off.
      encrypted:true
    });
    // end::tls-require-encryption[]
    driver.close();
  });

  it('should document how to configure trust-on-first-use', function() {
    var neo4j = neo4jv1;
    // tag::tls-trust-on-first-use[]
    var driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"), {
      // Note that trust-on-first-use is not available in the browser bundle,
      // in NodeJS, trust-on-first-use is the default trust mode. In the browser
      // it is TRUST_SIGNED_CERTIFICATES.
      trust: "TRUST_ON_FIRST_USE",
      encrypted:true
    });
    // end::tls-trust-on-first-use[]
    driver.close();
  }); 

  it('should document how to configure a trusted signing certificate', function() {
    var neo4j = neo4jv1;
    // tag::tls-signed[]
    var driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"), {
      trust: "TRUST_SIGNED_CERTIFICATES",
      // Configuring which certificates to trust here is only available
      // in NodeJS. In the browser bundle the browsers list of trusted
      // certificates is used, due to technical limitations in some browsers.
      trustedCertificates : ["path/to/ca.crt"],
      encrypted:true
    });
    // end::tls-signed[]
    driver.close();
  });

});

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

describe('transaction', function() {

  var driver, session;

  beforeEach(function(done) {
    driver = neo4j.driver("bolt://localhost");
    session = driver.session();

    session.run("MATCH (n) DETACH DELETE n").then(done);
  });

  afterEach(function() {
    driver.close();
  });

  it('should handle simple transaction', function(done) {
    // When
    var tx = session.beginTransaction();
    tx.run("CREATE (:TXNode1)");
    tx.run("CREATE (:TXNode2)");
    tx.commit()
      .then(function () {
        session.run("MATCH (t1:TXNode1), (t2:TXNode2) RETURN count(t1), count(t2)")
          .then(function (records) {
            expect(records.length).toBe(1);
            expect(records[0]['count(t1)'].toInt())
              .toBe(1);
            expect(records[0]['count(t2)'].toInt())
              .toBe(1);
            done();
          });
      });
  });

  it('should handle interactive session', function (done) {
    // When
    var tx = session.beginTransaction();
    tx.run("RETURN 'foo' AS res").then(function (records) {
      tx.run("CREATE ({name: {param}})", {param: records[0]['res']});
      tx.commit()
        .then(function () {
          session.run("MATCH (a {name:'foo'}) RETURN count(a)")
            .then(function (records) {
              expect(records.length).toBe(1);
              expect(records[0]['count(a)'].toInt()).toBe(1);
              done();
            });
        });
    });
  });

  it('should handle failures with subscribe', function (done) {
    // When
    var tx = session.beginTransaction();
    tx.run("THIS IS NOT CYPHER")
      .catch(function (error) {
        expect(error.fields.length).toBe(1);
        driver.close();
        done();
      });
  });

  it('should handle failures with catch', function (done) {
    // When
    var tx = session.beginTransaction();
    tx.run("THIS IS NOT CYPHER")
      .subscribe({
        onError: function (error) {
          expect(error.fields.length).toBe(1);
          driver.close();
          done();
        }
      });
  });

  it('should handle failures on commit', function (done) {
    // When
    var tx = session.beginTransaction();
    tx.run("CREATE (:TXNode1)");
    tx.run("THIS IS NOT CYPHER");
    tx.run("CREATE (:TXNode2)");

    tx.commit()
      .catch(function (error) {
        expect(error.fields.length).toBe(1);
        driver.close();
        done();
      });
  });

  it('should fail when committing on a failed query', function (done) {
    // When
    var tx = session.beginTransaction();
    tx.run("CREATE (:TXNode1)");
    tx.run("THIS IS NOT CYPHER")
      .catch(function () {
        tx.commit()
          .catch(function (error) {
            expect(error.error).toBeDefined();
            driver.close();
            done();
          });
      });
  });

  it('should handle when committing when another statement fails', function (done) {
    // When
    var tx = session.beginTransaction();
    tx.run("CREATE (:TXNode1)")
      .then(function () {
        tx.commit()
          .catch(function (error) {
            expect(error).toBeDefined();
            driver.close();
            done();
          });
      });
    tx.run("THIS IS NOT CYPHER");
  });

  it('should handle rollbacks', function (done) {
    // When
    var tx = session.beginTransaction();
    tx.run("CREATE (:TXNode1)");
    tx.run("CREATE (:TXNode2)");
    tx.rollback()
      .then(function () {
        session.run("MATCH (t1:TXNode1), (t2:TXNode2) RETURN count(t1), count(t2)").then(function (records) {

          expect(records.length).toBe(1);
          expect(records[0]['count(t1)'].toInt())
            .toBe(0);
          expect(records[0]['count(t2)'].toInt())
            .toBe(0);
          done();
        });
      });
  });

  it('should fail when committing on a rolled back query', function (done) {
    // When
    var tx = session.beginTransaction();
    tx.run("CREATE (:TXNode1)");
    tx.rollback()

    tx.commit()
          .catch(function (error) {
            expect(error.error).toBeDefined();
            driver.close();
            done();
          });
  });

  it('should fail when running on a rolled back transaction', function (done) {
    // When
    var tx = session.beginTransaction();
    tx.run("CREATE (:TXNode1)");
    tx.rollback();

    tx.run("RETURN 42")
      .catch(function (error) {
        expect(error.error).toBeDefined();
        driver.close();
        done();
      });
  });

  it('should fail when running when a previous statement failed', function (done) {
    // When
    var tx = session.beginTransaction();
    tx.run("THIS IS NOT CYPHER")
      .catch(function () {
        tx.run("RETURN 42")
          .catch(function (error) {
            expect(error.error).toBeDefined();
            driver.close();
            done();
          });
      });
    tx.rollback();
  });

  it('should fail when trying to roll back a rolled back transaction', function (done) {
    // When
    var tx = session.beginTransaction();
    tx.run("CREATE (:TXNode1)");
    tx.rollback();

    tx.rollback()
      .catch(function (error) {
        expect(error.error).toBeDefined();
        driver.close();
        done();
      });
  });
});

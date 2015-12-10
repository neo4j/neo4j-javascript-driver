/**
 * Copyright (c) 2002-2015 "Neo Technology,"
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

fdescribe('transaction', function() {

  var driver, session;

  beforeEach(function(done) {
    driver = neo4j.driver("bolt://localhost");
    session = driver.session();

    session.run("MATCH (n) DETACH DELETE n").then(done);
  });

  it('should handle simple transaction', function(done) {
    // When
    var tx = session.beginTransaction();
    tx.run("CREATE (:TXNode1)");
    tx.run("CREATE (:TXNode2)");
    tx.commit()
      .then(function() {
        session.run("MATCH (t1:TXNode1), (t2:TXNode2) RETURN count(t1), count(t2)").then(function(records) {
            
            expect( records.length ).toBe( 1 );
            expect( records[0]['count(t1)'].toInt() )
              .toBe( 1 );
            expect( records[0]['count(t2)'].toInt() )
              .toBe( 1 );
            done();
          });
      });
  });

});

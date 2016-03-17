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

describe('result stream', function() {

  var driver, session;

  beforeEach(function(done) {
    driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"));
    session = driver.session();

    session.run("MATCH (n) DETACH DELETE n").then(done);
  });

  afterEach(function() {
    driver.close();
  });

  it('should allow chaining `then`, returning a new thing in each', function(done) {
    // When & Then
    session.run( "RETURN 1")
      .then( function() {
        return "first";
      })
      .then( function(arg) {
        expect(arg).toBe( "first" );
        return "second";
      })
      .then( function(arg) {
        expect(arg).toBe( "second" );
      })
      .then(done);
  });

  it('should allow catching exception thrown in `then`', function(done) {
    // When & Then
    session.run( "RETURN 1")
      .then( function() {
        throw new Error("Away with you!");
      })
      .catch( function(err) {
        expect(err.message).toBe( "Away with you!" );
        done()
      });
  });
});

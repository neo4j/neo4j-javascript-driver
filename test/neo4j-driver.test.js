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

describe('neo4j-driver', function() {
  it('should expose version 1 of the API as a property', function(done) {
    // When
    var neo4jDriver = require("../lib");

    // Then I can access and use V1 of the API
    var driver = neo4jDriver.v1.driver("bolt://localhost");
    driver.session().run( "RETURN 1" )
      .then( function() { driver.close(); })
      .then( done );
  });

  it('should expose version 1 of the API package', function(done) {
    // When
    var neo4jV1 = require("../lib/v1");

    // Then I can access and use V1 of the API
    var driver = neo4jV1.driver("bolt://localhost");
    driver.session().run( "RETURN 1" )
      .then( function() { driver.close(); })
      .then( done );
  });
});

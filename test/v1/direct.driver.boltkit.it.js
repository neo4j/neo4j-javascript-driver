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

var neo4j = require("../../lib/v1").default;
var boltkit = require('./boltkit');

describe('direct driver', function() {

  it('should run query', function (done) {
    if (!boltkit.BoltKitSupport) {
      done();
      return;
    }

    // Given
    var kit = new boltkit.BoltKit();
    var server = kit.start('./test/resources/boltkit/return_x.script', 9001);

    kit.run(function () {
        var driver = neo4j.driver("bolt://localhost:9001", neo4j.auth.basic("neo4j", "neo4j"));
        // When
        var session = driver.session();
        // Then
        session.run("RETURN {x}", {'x': 1}).then(function (res) {
          expect(res.records[0].get('x').toInt()).toEqual(1);
          session.close();
          driver.close();
          server.exit(function(code) {
            expect(code).toEqual(0);
            done();
          });
        });
    });
  });
});


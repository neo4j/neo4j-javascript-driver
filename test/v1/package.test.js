/**
 * Copyright (c) 2002-2018 "Neo4j,"
 * Neo4j Sweden AB [http://neo4j.com]
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

var path = require('path');
var os = require('os');
var NodeChannel = require('../../lib/v1/internal/ch-node').default;
var sharedNeo4j = require('../../test/internal/shared-neo4j').default;

describe('Package', function() {
  var driverGlobal = {close: function() {}};
  afterAll(function() {
    driverGlobal.close();
  });

  it('should work', function(done){
    var neo4jReq;
    // Assuming we only run this test on NodeJS
    if( !NodeChannel.available ) {
      done();
      return;
    }

    try {
      neo4jReq = require(path.join(os.tmpdir(), 'sandbox', 'node_modules', 'neo4j-driver', 'lib'));
    } catch(e) {
      done.fail('Could not load sandbox package')
    }

    driverGlobal = neo4jReq.v1.driver("bolt://localhost", neo4jReq.v1.auth.basic(sharedNeo4j.username, sharedNeo4j.password));
    var session = driverGlobal.session();
    session.run('RETURN 1 AS answer').then(function(result) {
      expect(result.records.length).toBe(1);
      expect(result.records[0].get('answer').toNumber()).toBe(1);
      session.close();
      done();
    }).catch(function(e) {
      console.log(e);
      done.fail("Error in test")
    })
  })
});

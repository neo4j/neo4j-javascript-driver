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

var path = require('path');
var os = require('os');
var neo4jReq = require(path.join(os.tmpdir(), 'sandbox', 'node_modules', 'neo4j-driver', 'lib'));

describe('Package', function() {

  var driverGlobal, originalTimeout;

  beforeAll(function () {
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

    var neo4j = neo4jReq.v1;
    driverGlobal = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"));
  });

  afterAll(function() {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
    driverGlobal.close();
  });

  it('should work', function(done){
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

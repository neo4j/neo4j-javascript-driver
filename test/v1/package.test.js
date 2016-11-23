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

var neo4jv1 = require("../../build/sandbox/node_modules/neo4j-driver/lib/v1");

describe('Package', function() {
  var driverGlobal, originalTimeout;
  beforeAll(function () {
    var neo4j = neo4jv1;
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

    //tag::construct-driver[]
    var driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"));
    //end::construct-driver[]
    driverGlobal = driver;
  });
  afterAll(function() {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
    driverGlobal.close();
  });

  fit('should work work', function(done){
    var session = driverGlobal.session();
    session.run('RETURN 1').then(function(r) {
      expect(1).toBe(1);
      session.close();
      done();
    }).catch(function(e) {
      console.log(e)
      expect(1).toBe(2);
      done();
    })
  })
})

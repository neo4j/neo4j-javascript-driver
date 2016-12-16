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

describe('driver', function() {
  var driver;
  beforeEach(function() {
    driver = null;
  })
  afterEach(function() {
    if(driver) {
      driver.close();
    }
  })
  it('should expose sessions', function() {
    // Given
    driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"));

    // When
    var session = driver.session();

    // Then
    expect( session ).not.toBeNull();
    driver.close();
  });

  it('should handle connection errors', function(done) {
    // Given
    driver = neo4j.driver("bolt://localhoste", neo4j.auth.basic("neo4j", "neo4j"));

    // Expect
    driver.onError = function (err) {
      //the error message is different whether in browser or node
      expect(err.message).not.toBeNull();
      done();
    };

    // When
    driver.session();
  });

  it('should handle wrong scheme ', function() {
    expect(function(){neo4j.driver("tank://localhost", neo4j.auth.basic("neo4j", "neo4j"))}).toThrow(new Error("Unknown scheme: tank://"));
  });

  it('should fail early on wrong credentials', function(done) {
    // Given
    driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "who would use such a password"));

    // Expect
    driver.onError = function (err) {
      //the error message is different whether in browser or node
      expect(err.fields[0].code).toEqual('Neo.ClientError.Security.Unauthorized');
      done();
    };

    // When
    driver.session();
  });

  it('should indicate success early on correct credentials', function(done) {
    // Given
    driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"));

    // Expect
    driver.onCompleted = function (meta) {
      done();
    };

    // When
    driver.session();
  });

  it('should be possible to pass a realm with basic auth tokens', function(done) {
    // Given
    driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j", "native"));

    // Expect
    driver.onCompleted = function (meta) {
      done();
    };

    // When
    driver.session();
  });

  it('should be possible to create custom auth tokens', function(done) {
    // Given
    driver = neo4j.driver("bolt://localhost", neo4j.auth.custom("neo4j", "neo4j", "native", "basic"));

    // Expect
    driver.onCompleted = function (meta) {
      done();
    };

    // When
    driver.session();
  });

  it('should be possible to create custom auth tokens with additional parameters', function(done) {
    // Given
    driver = neo4j.driver("bolt://localhost", neo4j.auth.custom("neo4j", "neo4j", "native", "basic", {secret: 42}));

    // Expect
    driver.onCompleted = function () {
      done();
    };

    // When
    driver.session();
  });

  it('should fail nicely when connecting with routing to standalone server', function(done) {
    // Given
    driver = neo4j.driver("bolt+routing://localhost", neo4j.auth.basic("neo4j", "neo4j"));

    // Expect
    driver.onError = function (err) {
      expect(err.message).toEqual('Server could not perform routing, make sure you are connecting to a causal cluster');
      expect(err.code).toEqual(neo4j.error.SERVICE_UNAVAILABLE);
      done();
    };

    // When
    driver.session();
  });

  it('should have correct user agent', () => {
    const directDriver = neo4j.driver("bolt://localhost");
    expect(directDriver._userAgent).toBe("neo4j-javascript/0.0.0-dev");
    directDriver.close();

    const routingDriver = neo4j.driver("bolt+routing://localhost");
    expect(routingDriver._userAgent).toBe("neo4j-javascript/0.0.0-dev");
    routingDriver.close();
  });

  it('should fail when TRUST_ON_FIRST_USE is used with routing', () => {
    const createRoutingDriverWithTOFU = () => {
      driver = neo4j.driver('bolt+routing://localhost', neo4j.auth.basic('neo4j', 'neo4j'), {
        encrypted: "ENCRYPTION_ON",
          trust: 'TRUST_ON_FIRST_USE'
      });
    };

    expect(createRoutingDriverWithTOFU).toThrow();
  });

  var exposedTypes = [
    'Node',
    'Path',
    'PathSegment',
    'Record',
    'Relationship',
    'Result',
    'ResultSummary',
    'UnboundRelationship',
  ];

  exposedTypes.forEach(type => {
    it(`should expose type ${type}`, function() {
      expect(undefined === neo4j.types[type]).toBe(false);
    });
  });

});

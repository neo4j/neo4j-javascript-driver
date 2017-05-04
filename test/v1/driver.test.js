/**
 * Copyright (c) 2002-2017 "Neo Technology,","
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

import neo4j from '../../src/v1';
import sharedNeo4j from '../internal/shared-neo4j';

describe('driver', () => {

  let driver;

  beforeEach(() => {
    driver = null;
  });

  afterEach(() => {
    if(driver) {
      driver.close();
    }
  });

  it('should expose sessions', () => {
    // Given
    driver = neo4j.driver("bolt://localhost", sharedNeo4j.authToken);

    // When
    const session = driver.session();

    // Then
    expect( session ).not.toBeNull();
    driver.close();
  });

  it('should handle connection errors', done => {
    // Given
    driver = neo4j.driver("bolt://localhoste", sharedNeo4j.authToken);

    // Expect
    driver.onError = error => {
      //the error message is different whether in browser or node
      expect(error.message).not.toBeNull();
      expect(error.code).toEqual(neo4j.error.SERVICE_UNAVAILABLE);
      done();
    };

    // When
    startNewTransaction(driver);
  });

  it('should handle wrong scheme', () => {
    expect(() => neo4j.driver("tank://localhost", sharedNeo4j.authToken))
      .toThrow(new Error("Unknown scheme: tank://"));
  });

  it('should handle URL parameter string', () => {
    expect(() => neo4j.driver({uri: 'bolt://localhost'})).toThrowError(TypeError);

    expect(() => neo4j.driver(['bolt:localhost'])).toThrowError(TypeError);

    expect(() => {
      const driver = neo4j.driver(String('bolt://localhost'), sharedNeo4j.authToken);
      return driver.session();
    }).toBeDefined();
  });

  it('should fail early on wrong credentials', done => {
    // Given
    driver = neo4j.driver("bolt://localhost", wrongCredentials());

    // Expect
    driver.onError = err => {
      //the error message is different whether in browser or node
      expect(err.code).toEqual('Neo.ClientError.Security.Unauthorized');
      done();
    };

    // When
    startNewTransaction(driver);
  });

  it('should fail queries on wrong credentials', done => {
    driver = neo4j.driver("bolt://localhost", wrongCredentials());

    const session = driver.session();
    session.run('RETURN 1').catch(error => {
      expect(error.code).toEqual('Neo.ClientError.Security.Unauthorized');
      done();
    });
  });

  it('should indicate success early on correct credentials', done => {
    // Given
    driver = neo4j.driver("bolt://localhost", sharedNeo4j.authToken);

    // Expect
    driver.onCompleted = meta => {
      done();
    };

    // When
    startNewTransaction(driver);
  });

  it('should be possible to pass a realm with basic auth tokens', done => {
    // Given
    driver = neo4j.driver("bolt://localhost", neo4j.auth.basic(sharedNeo4j.username, sharedNeo4j.password, "native"));

    // Expect
    driver.onCompleted = meta => {
      done();
    };

    // When
    startNewTransaction(driver);
  });

  it('should be possible to create custom auth tokens', done => {
    // Given
    driver = neo4j.driver("bolt://localhost", neo4j.auth.custom(sharedNeo4j.username, sharedNeo4j.password, "native", "basic"));

    // Expect
    driver.onCompleted = meta => {
      done();
    };

    // When
    startNewTransaction(driver);
  });

  it('should be possible to create custom auth tokens with additional parameters', done => {
    // Given
    driver = neo4j.driver("bolt://localhost", neo4j.auth.custom(sharedNeo4j.username, sharedNeo4j.password, "native", "basic", {secret: 42}));

    // Expect
    driver.onCompleted = () => {
      done();
    };

    // When
    startNewTransaction(driver);
  });

  it('should fail nicely when connecting with routing to standalone server', done => {
    // Given
    driver = neo4j.driver("bolt+routing://localhost", sharedNeo4j.authToken);

    // Expect
    driver.onError = error => {
      expect(error.message).toEqual('Server localhost could not perform routing. Make sure you are connecting to a causal cluster');
      expect(error.code).toEqual(neo4j.error.SERVICE_UNAVAILABLE);
      done();
    };

    // When
    startNewTransaction(driver);
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
      driver = neo4j.driver('bolt+routing://localhost', sharedNeo4j.username, {
        encrypted: "ENCRYPTION_ON",
          trust: 'TRUST_ON_FIRST_USE'
      });
    };

    expect(createRoutingDriverWithTOFU).toThrow();
  });

  const exposedTypes = [
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
    it(`should expose type ${type}`, () => {
      expect(undefined === neo4j.types[type]).toBe(false);
    });
  });

  /**
   * Starts new transaction to force new network connection.
   * @param {Driver} driver - the driver to use.
   */
  function startNewTransaction(driver) {
    const session = driver.session();
    expect(session.beginTransaction()).toBeDefined();
  }

  function wrongCredentials() {
    return neo4j.auth.basic('neo4j', 'who would use such a password');
  }

});

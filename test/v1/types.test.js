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

import neo4j from '../../src/v1';
import sharedNeo4j from '../internal/shared-neo4j';
import _ from 'lodash';
import {ServerVersion, VERSION_3_2_0} from '../../src/v1/internal/server-version';

describe('floating point values', () => {
  it('should support float 1.0 ', testValue(1));
  it('should support float 0.0 ', testValue(0.0));
  it('should support pretty big float ', testValue(3.4028235e+38)); // Max 32-bit
  it('should support really big float ', testValue(1.7976931348623157e+308)); // Max 64-bit
  it('should support pretty small float ', testValue(1.4e-45)); // Min 32-bit
  it('should support really small float ', testValue(4.9e-324)); // Min 64-bit
});

describe('integer values', () => {
  it('should support integer 1 ', testValue(neo4j.int(1)));
  it('should support integer 0 ', testValue(neo4j.int(0)));
  it('should support integer -1 ', testValue(neo4j.int(-1)));
  it('should support integer larger than JS Numbers can model', testValue(neo4j.int('0x7fffffffffffffff')));
  it('should support integer smaller than JS Numbers can model', testValue(neo4j.int('0x8000000000000000')));
});

describe('boolean values', () => {
  it('should support true ', testValue(true));
  it('should support false ', testValue(false));
});

describe('string values', () => {
  it('should support empty string ', testValue(''));
  it('should support simple string ', testValue('abcdefghijklmnopqrstuvwxyz'));
  it('should support awesome string ', testValue('All makt åt Tengil, vår befriare.'));
});

describe('list values', () => {
  it('should support empty lists ', testValue([]));
  it('should support sparse lists ', testValue([undefined, 4], [null, 4]));
  it('should support float lists ', testValue([1, 2, 3]));
  it('should support boolean lists ', testValue([true, false]));
  it('should support string lists ', testValue(['', 'hello!']));
  it('should support list lists ', testValue([[], [1, 2, 3]]));
  it('should support map lists ', testValue([{}, {a: 12}]));
});

describe('map values', () => {
  it('should support empty maps ', testValue({}));
  it('should support basic maps ', testValue({a: 1, b: {}, c: [], d: {e: 1}}));
  it('should support sparse maps ', testValue({foo: undefined, bar: null}, {bar: null}));
});

describe('node values', () => {
  it('should support returning nodes ', done => {
    // Given
    const driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken);
    const session = driver.session();

    // When
    session.run('CREATE (n:User {name:\'Lisa\'}) RETURN n, id(n)').then(result => {
      const node = result.records[0].get('n');

      expect(node.properties).toEqual({name: 'Lisa'});
      expect(node.labels).toEqual(['User']);
      expect(node.identity).toEqual(result.records[0].get('id(n)'));
      driver.close();
      done();

    });
  });
});

describe('relationship values', () => {
  it('should support returning relationships', done => {
    // Given
    const driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken);
    const session = driver.session();

    // When
    session.run('CREATE ()-[r:User {name:\'Lisa\'}]->() RETURN r, id(r)').then(result => {
      const rel = result.records[0].get('r');

      expect(rel.properties).toEqual({name: 'Lisa'});
      expect(rel.type).toEqual('User');
      expect(rel.identity).toEqual(result.records[0].get('id(r)'));
      driver.close();
      done();

    });
  });
});

describe('path values', () => {
  it('should support returning paths', done => {
    // Given
    const driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken);
    const session = driver.session();

    // When
    session.run('CREATE p=(:User { name:\'Lisa\' })<-[r:KNOWS {since:1234.0}]-() RETURN p')
      .then(result => {
        const path = result.records[0].get('p');

        expect(path.start.properties).toEqual({name: 'Lisa'});
        expect(path.end.properties).toEqual({});

        // Accessing path segments
        expect(path.length).toEqual(1);
        for (let i = 0; i < path.length; i++) {
          const segment = path.segments[i];
          // The direction of the path segment goes from lisa to the blank node
          expect(segment.start.properties).toEqual({name: 'Lisa'});
          expect(segment.end.properties).toEqual({});
          // Which is the inverse of the relationship itself!
          expect(segment.relationship.properties).toEqual({since: 1234});
        }
        driver.close();
        done();
      }).catch(err => {
      console.log(err);
    });
  });
});

describe('byte arrays', () => {

  let originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
  let serverSupportsByteArrays = false;

  beforeAll(done => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

    const tmpDriver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken);
    ServerVersion.fromDriver(tmpDriver).then(version => {
      tmpDriver.close();
      serverSupportsByteArrays = version.compareTo(VERSION_3_2_0) >= 0;
      done();
    });
  });

  afterAll(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
  });

  it('should support returning empty byte array if server supports byte arrays', done => {
    if (!serverSupportsByteArrays) {
      done();
      return;
    }

    testValue(new Int8Array(0))(done);
  });

  it('should support returning empty byte array if server supports byte arrays', done => {
    if (!serverSupportsByteArrays) {
      done();
      return;
    }

    testValues([new Int8Array(0)])(done);
  });

  it('should support returning short byte arrays if server supports byte arrays', done => {
    if (!serverSupportsByteArrays) {
      done();
      return;
    }

    testValues(randomByteArrays(100, 1, 255))(done);
  });

  it('should support returning medium byte arrays if server supports byte arrays', done => {
    if (!serverSupportsByteArrays) {
      done();
      return;
    }

    testValues(randomByteArrays(50, 256, 65535))(done);
  });

  it('should support returning long byte arrays if server supports byte arrays', done => {
    if (!serverSupportsByteArrays) {
      done();
      return;
    }

    testValues(randomByteArrays(10, 65536, 2 * 65536))(done);
  });

  it('should fail to return byte array if server does not support byte arrays', done => {
    if (serverSupportsByteArrays) {
      done();
      return;
    }

    const driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken);
    const session = driver.session();
    session.run('RETURN {array}', {array: randomByteArray(42)}).catch(error => {
      driver.close();
      expect(error.message).toEqual('Byte arrays are not supported by the database this driver is connected to');
      done();
    });
  });
});

function testValue(actual, expected) {
  return done => {
    const driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken);
    const queryPromise = runReturnQuery(driver, actual, expected);

    queryPromise.then(() => {
      driver.close();
      done();
    }).catch(error => {
      driver.close();
      console.log(error);
    });
  };
}

function testValues(values) {
  return done => {
    const driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken);
    const queriesPromise = values.reduce((acc, value) =>
      acc.then(() => runReturnQuery(driver, value)), Promise.resolve());

    queriesPromise.then(() => {
      driver.close();
      done();
    }).catch(error => {
      driver.close();
      console.log(error);
    });
  };
}

function runReturnQuery(driver, actual, expected) {
  const session = driver.session();
  return new Promise((resolve, reject) => {
    session.run('RETURN {val} as v', {val: actual}).then(result => {
      expect(result.records[0].get('v')).toEqual(expected || actual);
      session.close();
      resolve();
    }).catch(error => {
      reject(error);
    });
  });
}

function randomByteArrays(count, minLength, maxLength) {
  return _.range(count).map(() => {
    const length = _.random(minLength, maxLength);
    return randomByteArray(length);
  });
}

function randomByteArray(length) {
  const array = _.range(length).map(() => _.random(-128, 127));
  return new Int8Array(array);
}

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

import neo4j from '../../../src/v1';
import sharedNeo4j from '../../internal/shared-neo4j';
import testUtils from '.././test-utils';
import {ServerVersion, VERSION_3_1_0, VERSION_3_4_0} from '../../../src/v1/internal/server-version';

describe('http driver', () => {

  let boltDriver;
  let httpDriver;
  let serverVersion;

  beforeEach(done => {
    boltDriver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken, {disableLosslessIntegers: true});
    httpDriver = neo4j.driver('http://localhost:7474', sharedNeo4j.authToken);

    const session = boltDriver.session();
    session.run('MATCH (n) DETACH DELETE n').then(result => {
      serverVersion = ServerVersion.fromString(result.summary.server.version);
      session.close(() => {
        done();
      });
    });
  });

  afterEach(() => {
    if (boltDriver) {
      boltDriver.close();
      boltDriver = null;
    }
    if (httpDriver) {
      httpDriver.close();
      httpDriver = null;
    }
  });

  it('should send and receive primitives', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    const primitiveValues = [
      null,
      0, 1, 2, 3, 42, -1, -2, -3, 100, -100, 424242, -424242,
      0.12345, -0.12345, 1.25, -1.25, 5.99, -5.99, 1000.99, -1000.99, 1234.56789, -1234.56789,
      neo4j.int(0), neo4j.int(1), neo4j.int(-1), neo4j.int(42), neo4j.int(-42), neo4j.int(12345), neo4j.int(-12345),
      '', 'hello', 'hello world!', 'Thor and Mjölnir', 'Хеллоу'
    ];

    testSendAndReceiveWithReturnQuery(primitiveValues, done);
  });

  it('should send and receive arrays', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    const arrayValues = [
      [],
      [42], [-42], [1, 2, 3], [-1, -2, -3], [1, 2, 3, 4, 5, 6, 7, 10000000], [-10000000, 42, 7, 6, 5, 4, 3, 2, 1],
      [0.001], [-0.19, 0.19], [100.25, 123.456, 90.99, 88.112], [-901.33, -90.90, 133, 144, 77835],
      [''], ['hello'], ['hello', ' ', 'world', '!'], ['Thor', ' ', 'has ', 'Mjölnir'], ['Hello', ' is ', 'Хеллоу'],
    ];

    testSendAndReceiveWithReturnQuery(arrayValues, done);
  });

  it('should send and receive objects', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    const objectValues = [
      {},
      {name: 'Sam', age: 20, salary: 100}, {name: 'Tom', age: 20, scores: [1, 2, 3], values: [neo4j.int(1), neo4j.int(42)]},
      {name: 'Cat', value: neo4j.int(42), info: {otherName: 'Dog', wight: neo4j.int(20), otherInfo: {likes: ['eat', 'drink']}}}
    ];

    testSendAndReceiveWithReturnQuery(objectValues, done);
  });

  it('should receive nodes', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    runSetupQueries([
      `CREATE (:Node1)`,
      `CREATE (:Node2 {name: 'Node2'})`,
      `CREATE (:Node3 {name: 'Node3', age: 42})`,
      `CREATE (:Node4 {name: 'Node4', age: 4242, value: 42.05})`,
      `CREATE (:Node5:Cat:Dog {name: 'Node5', age: 12, value: -0.006, scores: [0.25, -0.15, 100], likes: ['food', 'drinks']})`
    ]).then(() => {
      testReceivingOfResults([
        `MATCH (n:Node1) RETURN n`,
        `MATCH (n:Node2) RETURN n`,
        `MATCH (n:Node3) RETURN n`,
        `MATCH (n:Node4) RETURN n`,
        `MATCH (n:Node5) RETURN n`,
        `MATCH (a:Node1), (b:Node2) RETURN a, b`,
        `MATCH (a:Node1), (b:Node2), (c:Node3) RETURN a AS aaa, b AS bbb, c AS ccc`,
        `MATCH (a:Node1), (b:Node2), (c:Node3), (d:Node4), (e:Node5) RETURN a, b, c, d, e AS eee`,
        `MATCH (a:Node1), (b:Node2), (c:Node3), (d:Node4), (e:Node5) RETURN e, a, c, d, b`,
        `MATCH (n) RETURN n`
      ], done);
    });
  });

  it('should receive relationships', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    runSetupQueries([
      `CREATE (:Node1)-[:KNOWS]->(:Node2)`,
      `CREATE (:Node3)-[:KNOWS {name: 'foo'}]->(:Node4)`,
      `CREATE (:Node5)-[:KNOWS {name: 'foo', value: 42, score: 12.5, values: [1,2,3, -42], strings: ['a','b','c']}]->(:Node6)`,
    ]).then(() => {
      testReceivingOfResults([
        `MATCH (:Node1)-[r]->(:Node2) RETURN r`,
        `MATCH (:Node3)-[r]->(:Node4) RETURN r`,
        `MATCH (:Node5)-[r]->(:Node6) RETURN r`,
        `MATCH ()-[r]-() RETURN r`
      ], done);
    });
  });

  it('should receive paths', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    runSetupQueries([
      `CREATE (:Person1 {name: 'Person1'})-[:KNOWS {value: 42}]->(:Person2 {name: 'Person2', surname: 'Person2', value: 1})`,
      `CREATE (:Person3 {name: 'Person3'})-[:KNOWS {since: 123}]->
              (:Person4 {name: 'Person4'})<-[:LIKES {why: 'why!'}]-
              (:Person5 {name: 'Person5'})-[:KNOWS]->
              (:Person6 {name: 'Person6'})`
    ]).then(() => {
      testReceivingOfResults([
        `MATCH p=((:Person1)-[:KNOWS]->(:Person2)) RETURN p`,
        `MATCH p=((:Person2)-[:KNOWS]-(:Person1)) RETURN p`,
        `MATCH p=((:Person3)-[:KNOWS]-(:Person4)-[:LIKES]-(:Person5)) RETURN p`,
        `MATCH p=((:Person3)-[*]-(:Person6)) RETURN p`,
        `MATCH p=((:Person1)-[*]-()) RETURN p`,
        `MATCH p=((:Person3)-[*]-()) RETURN p`,
        `MATCH p=((:Person6)-[*]-()) RETURN p`
      ], done);
    });
  });

  it('should receive errors', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    const query = 'UNWIND [1,2,3,0] AS x RETURN 10/x';

    const boltErrorPromise = runQueryAndGetError(query, boltDriver);
    const httpErrorPromise = runQueryAndGetError(query, httpDriver);

    Promise.all([boltErrorPromise, httpErrorPromise]).then(errors => {
      expect(errors.length).toEqual(2);
      const boltError = errors[0];
      const httpError = errors[1];

      expect(boltError.name).toEqual(httpError.name);
      expect(boltError.code).toEqual(httpError.code);
      expect(boltError.message).toEqual(httpError.message);

      done();
    });
  });

  it('should receive server address', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    const query = `CREATE (n1:Node1 {name: 'Node1'})-[r:LIKES {date: 12345}]->(n2:Node2 {name: 'Node2'}) RETURN n1, r, n2`;

    runQueryAndGetSummary(query, httpDriver).then(summary => {
      expect(summary.server.address).toEqual('localhost:7474');
      done();
    });
  });

  it('should receive statement statistics', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    const query = `CREATE (n1:Node {value: 1}), (n2:Node {name: '2', value: 2}) WITH n1, n2 DELETE n1 RETURN n1, n2`;

    const boltStatementStatisticsPromise = runQueryAndGetStatementStatistics(query, boltDriver);
    const httpStatementStatisticsPromise = runQueryAndGetStatementStatistics(query, httpDriver);

    Promise.all([boltStatementStatisticsPromise, httpStatementStatisticsPromise]).then(stats => {
      const boltStatementStatistics = stats[0];
      const httpStatementStatistics = stats[1];
      expect(boltStatementStatistics).toEqual(httpStatementStatistics);
      done();
    });
  });

  it('should use default HTTP port', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    const driver = neo4j.driver('http://localhost', sharedNeo4j.authToken);
    const session = driver.session();
    session.run('RETURN 4242').then(result => {
      expect(result.records[0].get(0)).toEqual(4242);
      expect(result.summary.server.address).toEqual('localhost:7474');
      done();
    });
  });

  it('should terminate query waiting on a lock when session is closed', done => {
    if (testUtils.isServer() || !databaseSupportsTransactionTerminationInLocks()) {
      done();
      return;
    }

    const boltSession = boltDriver.session();
    boltSession.run(`CREATE (:Node {name: 'foo'})`).then(() => {
      const boltTx = boltSession.beginTransaction();
      boltTx.run(`MATCH (n:Node {name: 'foo'}) SET n.name = 'bar'`).then(() => {
        // node should now be locked

        const httpSession = httpDriver.session();
        httpSession.run(`MATCH (n:Node {name: 'foo'}) SET n.name = 'baz'`).then(() => {
          boltSession.close(() => done.fail('HTTP query was successful but failure expected'));
        }).catch(error => {
          expect(error.name).toEqual('Neo4jError');
          expect(error.code).toEqual('Neo.DatabaseError.Statement.ExecutionFailed');
          expect(error.message.indexOf('transaction has been terminated')).not.toBeLessThan(0);
          boltSession.close(() => done());
        });

        setTimeout(() => {
          httpSession.close();
        }, 2000);

      });
    });
  }, 20000);

  it('should fail to pass node as a query parameter', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    testUnsupportedQueryParameterWithHttpDriver(new neo4j.types.Node(neo4j.int(1), ['Person'], {name: 'Bob'}), done);
  });

  it('should fail to pass relationship as a query parameter', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    testUnsupportedQueryParameterWithHttpDriver(new neo4j.types.Relationship(neo4j.int(1), neo4j.int(2), neo4j.int(3), 'KNOWS', {since: 42}), done);
  });

  it('should fail to pass path as a query parameter', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    const node1 = new neo4j.types.Node(neo4j.int(1), ['Person'], {name: 'Alice'});
    const node2 = new neo4j.types.Node(neo4j.int(2), ['Person'], {name: 'Bob'});
    testUnsupportedQueryParameterWithHttpDriver(new neo4j.types.Path(node1, node2, []), done);
  });

  it('should fail to pass point as a query parameter', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    testUnsupportedQueryParameterWithHttpDriver(new neo4j.types.Point(neo4j.int(42), 1, 2, 3), done);
  });

  it('should fail to pass date as a query parameter', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    testUnsupportedQueryParameterWithHttpDriver(new neo4j.types.Date(2000, 10, 12), done);
  });

  it('should fail to pass date-time as a query parameter', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    testUnsupportedQueryParameterWithHttpDriver(new neo4j.types.DateTime(2000, 10, 12, 12, 12, 0, 0, 0, null), done);
  });

  it('should fail to pass duration as a query parameter', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    testUnsupportedQueryParameterWithHttpDriver(new neo4j.types.Duration(1, 1, 1, 1), done);
  });

  it('should fail to pass local date-time as a query parameter', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    testUnsupportedQueryParameterWithHttpDriver(new neo4j.types.LocalDateTime(2000, 10, 12, 10, 10, 10), done);
  });

  it('should fail to pass local time as a query parameter', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    testUnsupportedQueryParameterWithHttpDriver(new neo4j.types.LocalTime(12, 12, 12, 0), done);
  });

  it('should fail to pass time as a query parameter', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    testUnsupportedQueryParameterWithHttpDriver(new neo4j.types.Time(12, 12, 12, 0, 0), done);
  });

  it('should receive points', done => {
    if (testUtils.isServer() || !databaseSupportsSpatialAndTemporalTypes()) {
      done();
      return;
    }

    testReceivingOfResults([
      'RETURN point({x: 42.341, y: 125.0})',
      'RETURN point({x: 13.2, y: 22.2, z: 33.3})',
      'RETURN point({x: 92.3, y: 71.2, z: 2.12345, crs: "wgs-84-3d"})',
      'RETURN point({longitude: 56.7, latitude: 12.78})'
    ], done);
  });

  it('should receive date', done => {
    if (testUtils.isServer() || !databaseSupportsSpatialAndTemporalTypes()) {
      done();
      return;
    }

    testReceiveSingleValueWithHttpDriver(
      'RETURN date({year: 2019, month: 9, day: 28})',
      '2019-09-28',
      done);
  });

  it('should receive date-time with time zone id', done => {
    if (testUtils.isServer() || !databaseSupportsSpatialAndTemporalTypes()) {
      done();
      return;
    }

    testReceiveSingleValueWithHttpDriver(
      'RETURN datetime({year: 1976, month: 11, day: 1, hour: 19, minute: 20, second: 55, nanosecond: 999111, timezone: "UTC"})',
      '1976-11-01T19:20:55.000999111Z[UTC]',
      done);
  });

  it('should receive date-time with time zone name', done => {
    if (testUtils.isServer() || !databaseSupportsSpatialAndTemporalTypes()) {
      done();
      return;
    }

    testReceiveSingleValueWithHttpDriver(
      'RETURN datetime({year: 2012, month: 12, day: 12, hour: 1, minute: 9, second: 2, nanosecond: 123, timezone: "-08:30"})',
      '2012-12-12T01:09:02.000000123-08:30',
      done);
  });

  it('should receive duration', done => {
    if (testUtils.isServer() || !databaseSupportsSpatialAndTemporalTypes()) {
      done();
      return;
    }

    testReceiveSingleValueWithHttpDriver(
      'RETURN duration({months: 3, days: 35, seconds: 19, nanoseconds: 937139})',
      'P3M35DT19.000937139S',
      done);
  });

  it('should receive local date-time', done => {
    if (testUtils.isServer() || !databaseSupportsSpatialAndTemporalTypes()) {
      done();
      return;
    }

    testReceiveSingleValueWithHttpDriver(
      'RETURN localdatetime({year: 2032, month: 5, day: 17, hour: 13, minute: 56, second: 51, nanosecond: 999888111})',
      '2032-05-17T13:56:51.999888111',
      done);
  });

  it('should receive local time', done => {
    if (testUtils.isServer() || !databaseSupportsSpatialAndTemporalTypes()) {
      done();
      return;
    }

    testReceiveSingleValueWithHttpDriver(
      'RETURN localtime({hour: 17, minute: 2, second: 21, nanosecond: 123456789})',
      '17:02:21.123456789',
      done);
  });

  it('should receive time', done => {
    if (testUtils.isServer() || !databaseSupportsSpatialAndTemporalTypes()) {
      done();
      return;
    }

    testReceiveSingleValueWithHttpDriver(
      'RETURN time({hour: 21, minute: 19, second: 1, nanosecond: 111, timezone: "+03:15"})',
      '21:19:01.000000111+03:15',
      done);
  });

  it('should close all open sessions when closed', done => {
    if (testUtils.isServer()) {
      done();
      return;
    }

    const session1 = withFakeClose(httpDriver.session());
    const session2 = withFakeClose(httpDriver.session());
    const session3 = withFakeClose(httpDriver.session());

    expect(session1.closed).toBeFalsy();
    expect(session2.closed).toBeFalsy();
    expect(session3.closed).toBeFalsy();

    httpDriver.close().then(() => {
      expect(session1.closed).toBeTruthy();
      expect(session2.closed).toBeTruthy();
      expect(session3.closed).toBeTruthy();
      done();
    });
  });

  function testReceiveSingleValueWithHttpDriver(query, expectedValue, done) {
    runQueryAndGetResults(query, {}, httpDriver).then(results => {
      const receivedValue = results[0][0];
      expect(expectedValue).toEqual(receivedValue);
      done();
    }).catch(error => {
      done.fail(error);
    });
  }

  function testSendAndReceiveWithReturnQuery(values, done) {
    const query = 'RETURN $value';

    const boltResultsPromise = Promise.all(values.map(value => runQueryAndGetResults(query, {value: value}, boltDriver)));
    const httpResultsPromise = Promise.all(values.map(value => runQueryAndGetResults(query, {value: value}, httpDriver)));

    assertResultsAreEqual(boltResultsPromise, httpResultsPromise, values, done);
  }

  function testReceivingOfResults(queries, done) {
    const boltResultsPromise = Promise.all(queries.map(query => runQueryAndGetResults(query, {}, boltDriver)));
    const httpResultsPromise = Promise.all(queries.map(query => runQueryAndGetResults(query, {}, httpDriver)));

    assertResultsAreEqual(boltResultsPromise, httpResultsPromise, queries, done);
  }

  function assertResultsAreEqual(boltResultsPromise, httpResultsPromise, testInputs, done) {
    Promise.all([boltResultsPromise, httpResultsPromise]).then(results => {
      const boltResults = results[0];
      const httpResults = results[1];

      expect(boltResults.length).toEqual(testInputs.length);
      expect(httpResults.length).toEqual(testInputs.length);

      for (let i = 0; i < testInputs.length; i++) {
        const testInput = testInputs[i];
        const boltResultRow = boltResults[i];
        const httpResultRow = httpResults[i];
        expect(boltResultRow).toEqual(httpResultRow, 'Failed for: ' + JSON.stringify(testInput));
      }

      done();
    });
  }

  function runQueryAndGetResults(query, params, driver) {
    const session = driver.session();
    return session.run(query, params).then(result => {
      session.close();
      return result.records.map(record => record.keys.map(key => record.get(key)));
    });
  }

  function runQueryAndGetError(query, driver) {
    const session = driver.session();
    return session.run(query).catch(error => error);
  }

  function runQueryAndGetStatementStatistics(query, driver) {
    return runQueryAndGetSummary(query, driver).then(summary => summary.counters);
  }

  function runQueryAndGetSummary(query, driver) {
    const session = driver.session();
    return session.run(query).then(result => result.summary);
  }

  function runSetupQueries(queries) {
    const session = boltDriver.session();
    return session.writeTransaction(tx => {
      queries.forEach(query => tx.run(query));
      return null;
    });
  }

  function testUnsupportedQueryParameterWithHttpDriver(value, done) {
    const session = httpDriver.session();
    session.run('RETURN $value', {value: value}).then(() => {
      done.fail('Should not be possible to send ' + value);
    }).catch(error => {
      expect(error.name).toEqual('Neo4jError');
      expect(error.code).toEqual(neo4j.error.PROTOCOL_ERROR);
      session.close(() => {
        done();
      });
    });
  }

  function databaseSupportsTransactionTerminationInLocks() {
    return serverVersion.compareTo(VERSION_3_1_0) >= 0;
  }

  function databaseSupportsSpatialAndTemporalTypes() {
    return serverVersion.compareTo(VERSION_3_4_0) >= 0;
  }

  function withFakeClose(httpSession) {
    httpSession.closed = false;
    const originalClose = httpSession.close.bind(httpSession);
    httpSession.close = callback => {
      httpSession.closed = true;
      originalClose(callback);
    };
    return httpSession;
  }

});

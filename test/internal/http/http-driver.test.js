/**
 * Copyright (c) 2002-2019 "Neo4j,"
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

import neo4j from '../../../src'
import sharedNeo4j from '../../internal/shared-neo4j'
import testUtils from '.././test-utils'
import {
  ServerVersion,
  VERSION_3_1_0,
  VERSION_3_4_0
} from '../../../src/internal/server-version'

describe('http driver', () => {
  let originalTimeout
  let boltDriver
  let httpDriver
  let serverVersion

  beforeEach(async () => {
    jasmine.addMatchers(testUtils.matchers)

    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000

    boltDriver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken, {
      disableLosslessIntegers: true
    })
    httpDriver = neo4j.driver('http://localhost:7474', sharedNeo4j.authToken)

    const session = boltDriver.session()
    try {
      const result = await session.run('MATCH (n) DETACH DELETE n')
      serverVersion = ServerVersion.fromString(result.summary.server.version)
    } finally {
      session.close()
    }
  })

  afterEach(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout

    if (boltDriver) {
      boltDriver.close()
      boltDriver = null
    }
    if (httpDriver) {
      httpDriver.close()
      httpDriver = null
    }
  })

  it('should send and receive primitives', async () => {
    if (testUtils.isServer()) {
      return
    }

    const primitiveValues = [
      null,
      0,
      1,
      2,
      3,
      42,
      -1,
      -2,
      -3,
      100,
      -100,
      424242,
      -424242,
      0.12345,
      -0.12345,
      1.25,
      -1.25,
      5.99,
      -5.99,
      1000.99,
      -1000.99,
      1234.56789,
      -1234.56789,
      neo4j.int(0),
      neo4j.int(1),
      neo4j.int(-1),
      neo4j.int(42),
      neo4j.int(-42),
      neo4j.int(12345),
      neo4j.int(-12345),
      '',
      'hello',
      'hello world!',
      'Thor and Mjölnir',
      'Хеллоу'
    ]

    await testSendAndReceiveWithReturnQuery(primitiveValues)
  })

  it('should send and receive arrays', async () => {
    if (testUtils.isServer()) {
      return
    }

    const arrayValues = [
      [],
      [42],
      [-42],
      [1, 2, 3],
      [-1, -2, -3],
      [1, 2, 3, 4, 5, 6, 7, 10000000],
      [-10000000, 42, 7, 6, 5, 4, 3, 2, 1],
      [0.001],
      [-0.19, 0.19],
      [100.25, 123.456, 90.99, 88.112],
      [-901.33, -90.9, 133, 144, 77835],
      [''],
      ['hello'],
      ['hello', ' ', 'world', '!'],
      ['Thor', ' ', 'has ', 'Mjölnir'],
      ['Hello', ' is ', 'Хеллоу']
    ]

    await testSendAndReceiveWithReturnQuery(arrayValues)
  })

  it('should send and receive objects', async () => {
    if (testUtils.isServer()) {
      return
    }

    const objectValues = [
      {},
      { name: 'Sam', age: 20, salary: 100 },
      {
        name: 'Tom',
        age: 20,
        scores: [1, 2, 3],
        values: [neo4j.int(1), neo4j.int(42)]
      },
      {
        name: 'Cat',
        value: neo4j.int(42),
        info: {
          otherName: 'Dog',
          wight: neo4j.int(20),
          otherInfo: { likes: ['eat', 'drink'] }
        }
      }
    ]

    await testSendAndReceiveWithReturnQuery(objectValues)
  })

  it('should receive nodes', async () => {
    if (testUtils.isServer()) {
      return
    }

    await runSetupQueries([
      `CREATE (:Node1)`,
      `CREATE (:Node2 {name: 'Node2'})`,
      `CREATE (:Node3 {name: 'Node3', age: 42})`,
      `CREATE (:Node4 {name: 'Node4', age: 4242, value: 42.05})`,
      `CREATE (:Node5:Cat:Dog {name: 'Node5', age: 12, value: -0.006, scores: [0.25, -0.15, 100], likes: ['food', 'drinks']})`
    ])

    await testReceivingOfResults([
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
    ])
  })

  it('should receive relationships', async () => {
    if (testUtils.isServer()) {
      return
    }

    await runSetupQueries([
      `CREATE (:Node1)-[:KNOWS]->(:Node2)`,
      `CREATE (:Node3)-[:KNOWS {name: 'foo'}]->(:Node4)`,
      `CREATE (:Node5)-[:KNOWS {name: 'foo', value: 42, score: 12.5, values: [1,2,3, -42], strings: ['a','b','c']}]->(:Node6)`
    ])

    await testReceivingOfResults([
      `MATCH (:Node1)-[r]->(:Node2) RETURN r`,
      `MATCH (:Node3)-[r]->(:Node4) RETURN r`,
      `MATCH (:Node5)-[r]->(:Node6) RETURN r`,
      `MATCH ()-[r]-() RETURN r`
    ])
  })

  it('should receive paths', async () => {
    if (testUtils.isServer()) {
      return
    }

    await runSetupQueries([
      `CREATE (:Person1 {name: 'Person1'})-[:KNOWS {value: 42}]->(:Person2 {name: 'Person2', surname: 'Person2', value: 1})`,
      `CREATE (:Person3 {name: 'Person3'})-[:KNOWS {since: 123}]->
              (:Person4 {name: 'Person4'})<-[:LIKES {why: 'why!'}]-
              (:Person5 {name: 'Person5'})-[:KNOWS]->
              (:Person6 {name: 'Person6'})`
    ])

    await testReceivingOfResults([
      `MATCH p=((:Person1)-[:KNOWS]->(:Person2)) RETURN p`,
      `MATCH p=((:Person2)-[:KNOWS]-(:Person1)) RETURN p`,
      `MATCH p=((:Person3)-[:KNOWS]-(:Person4)-[:LIKES]-(:Person5)) RETURN p`,
      `MATCH p=((:Person3)-[*]-(:Person6)) RETURN p`,
      `MATCH p=((:Person1)-[*]-()) RETURN p`,
      `MATCH p=((:Person3)-[*]-()) RETURN p`,
      `MATCH p=((:Person6)-[*]-()) RETURN p`
    ])
  })

  it('should receive errors', async () => {
    if (testUtils.isServer()) {
      return
    }

    const query = 'UNWIND [1,2,3,0] AS x RETURN 10/x'

    const boltError = await runQueryAndGetError(query, boltDriver)
    const httpError = await runQueryAndGetError(query, httpDriver)

    expect(boltError.name).toEqual(httpError.name)
    expect(boltError.code).toEqual(httpError.code)
    expect(boltError.message).toEqual(httpError.message)
  })

  it('should receive server address', async () => {
    if (testUtils.isServer()) {
      return
    }

    const query = `CREATE (n1:Node1 {name: 'Node1'})-[r:LIKES {date: 12345}]->(n2:Node2 {name: 'Node2'}) RETURN n1, r, n2`

    const summary = await runQueryAndGetSummary(query, httpDriver)
    expect(summary.server.address).toEqual('localhost:7474')
  })

  it('should receive statement statistics', async () => {
    if (testUtils.isServer()) {
      return
    }

    const query = `CREATE (n1:Node {value: 1}), (n2:Node {name: '2', value: 2}) WITH n1, n2 DELETE n1 RETURN n1, n2`

    const boltStatementStatistics = await runQueryAndGetStatementStatistics(
      query,
      boltDriver
    )
    const httpStatementStatistics = await runQueryAndGetStatementStatistics(
      query,
      httpDriver
    )

    expect(boltStatementStatistics).toEqual(httpStatementStatistics)
  })

  it('should use default HTTP port', async () => {
    if (testUtils.isServer()) {
      return
    }

    const driver = neo4j.driver('http://localhost', sharedNeo4j.authToken)
    const session = driver.session()
    try {
      const result = await session.run('RETURN 4242')
      expect(result.records[0].get(0)).toEqual(4242)
      expect(result.summary.server.address).toEqual('localhost:7474')
    } finally {
      session.close()
    }
  })

  it('should terminate query waiting on a lock when session is closed', async () => {
    if (
      testUtils.isServer() ||
      !databaseSupportsTransactionTerminationInLocks()
    ) {
      return
    }

    const boltSession = boltDriver.session()
    let boltTx = null
    try {
      await boltSession.run(`CREATE (:Node {name: 'foo'})`)

      boltTx = boltSession.beginTransaction()
      await boltTx.run(`MATCH (n:Node {name: 'foo'}) SET n.name = 'bar'`)
      // node should now be locked

      const httpSession = httpDriver.session()
      setTimeout(() => {
        httpSession.close()
      }, 2000)

      let failed = false
      try {
        await httpSession.run(`MATCH (n:Node {name: 'foo'}) SET n.name = 'baz'`)
      } catch (error) {
        failed = true
        expect(error.name).toEqual('Neo4jError')
        expect(error.code).toBeElementOf([
          'Neo.DatabaseError.Statement.ExecutionFailed',
          'Neo.TransientError.Transaction.LockClientStopped'
        ])
        expect(
          error.message.indexOf('transaction has been terminated')
        ).not.toBeLessThan(0)
      }

      if (!failed) {
        throw new Error('HTTP query was successful but failure expected')
      }
    } finally {
      if (boltTx) {
        try {
          await boltTx.rollback()
        } catch (ignore) {}
      }
      boltSession.close()
    }
  })

  it('should fail to pass node as a query parameter', async () => {
    if (testUtils.isServer()) {
      return
    }

    await testUnsupportedQueryParameterWithHttpDriver(
      new neo4j.types.Node(neo4j.int(1), ['Person'], { name: 'Bob' })
    )
  })

  it('should fail to pass relationship as a query parameter', async () => {
    if (testUtils.isServer()) {
      return
    }

    await testUnsupportedQueryParameterWithHttpDriver(
      new neo4j.types.Relationship(
        neo4j.int(1),
        neo4j.int(2),
        neo4j.int(3),
        'KNOWS',
        { since: 42 }
      )
    )
  })

  it('should fail to pass path as a query parameter', async () => {
    if (testUtils.isServer()) {
      return
    }

    const node1 = new neo4j.types.Node(neo4j.int(1), ['Person'], {
      name: 'Alice'
    })
    const node2 = new neo4j.types.Node(neo4j.int(2), ['Person'], {
      name: 'Bob'
    })
    await testUnsupportedQueryParameterWithHttpDriver(
      new neo4j.types.Path(node1, node2, [])
    )
  })

  it('should fail to pass point as a query parameter', async () => {
    if (testUtils.isServer()) {
      return
    }

    await testUnsupportedQueryParameterWithHttpDriver(
      new neo4j.types.Point(neo4j.int(42), 1, 2, 3)
    )
  })

  it('should fail to pass date as a query parameter', async () => {
    if (testUtils.isServer()) {
      return
    }

    await testUnsupportedQueryParameterWithHttpDriver(
      new neo4j.types.Date(2000, 10, 12)
    )
  })

  it('should fail to pass date-time as a query parameter', async () => {
    if (testUtils.isServer()) {
      return
    }

    await testUnsupportedQueryParameterWithHttpDriver(
      new neo4j.types.DateTime(2000, 10, 12, 12, 12, 0, 0, 0, null)
    )
  })

  it('should fail to pass duration as a query parameter', async () => {
    if (testUtils.isServer()) {
      return
    }

    await testUnsupportedQueryParameterWithHttpDriver(
      new neo4j.types.Duration(1, 1, 1, 1)
    )
  })

  it('should fail to pass local date-time as a query parameter', async () => {
    if (testUtils.isServer()) {
      return
    }

    await testUnsupportedQueryParameterWithHttpDriver(
      new neo4j.types.LocalDateTime(2000, 10, 12, 10, 10, 10, 10)
    )
  })

  it('should fail to pass local time as a query parameter', async () => {
    if (testUtils.isServer()) {
      return
    }

    await testUnsupportedQueryParameterWithHttpDriver(
      new neo4j.types.LocalTime(12, 12, 12, 0)
    )
  })

  it('should fail to pass time as a query parameter', async () => {
    if (testUtils.isServer()) {
      return
    }

    await testUnsupportedQueryParameterWithHttpDriver(
      new neo4j.types.Time(12, 12, 12, 0, 0)
    )
  })

  it('should receive points', async () => {
    if (testUtils.isServer() || !databaseSupportsSpatialAndTemporalTypes()) {
      return
    }

    await testReceivingOfResults([
      'RETURN point({x: 42.341, y: 125.0})',
      'RETURN point({x: 13.2, y: 22.2, z: 33.3})',
      'RETURN point({x: 92.3, y: 71.2, z: 2.12345, crs: "wgs-84-3d"})',
      'RETURN point({longitude: 56.7, latitude: 12.78})'
    ])
  })

  it('should receive date', async () => {
    if (testUtils.isServer() || !databaseSupportsSpatialAndTemporalTypes()) {
      return
    }

    await testReceiveSingleValueWithHttpDriver(
      'RETURN date({year: 2019, month: 9, day: 28})',
      '2019-09-28'
    )
  })

  it('should receive date-time with time zone id', async () => {
    if (testUtils.isServer() || !databaseSupportsSpatialAndTemporalTypes()) {
      return
    }

    await testReceiveSingleValueWithHttpDriver(
      'RETURN datetime({year: 1976, month: 11, day: 1, hour: 19, minute: 20, second: 55, nanosecond: 999111, timezone: "UTC"})',
      '1976-11-01T19:20:55.000999111Z[UTC]'
    )
  })

  it('should receive date-time with time zone name', async () => {
    if (testUtils.isServer() || !databaseSupportsSpatialAndTemporalTypes()) {
      return
    }

    await testReceiveSingleValueWithHttpDriver(
      'RETURN datetime({year: 2012, month: 12, day: 12, hour: 1, minute: 9, second: 2, nanosecond: 123, timezone: "-08:30"})',
      '2012-12-12T01:09:02.000000123-08:30'
    )
  })

  it('should receive duration', async () => {
    if (testUtils.isServer() || !databaseSupportsSpatialAndTemporalTypes()) {
      return
    }

    await testReceiveSingleValueWithHttpDriver(
      'RETURN duration({months: 3, days: 35, seconds: 19, nanoseconds: 937139})',
      'P3M35DT19.000937139S'
    )
  })

  it('should receive local date-time', async () => {
    if (testUtils.isServer() || !databaseSupportsSpatialAndTemporalTypes()) {
      return
    }

    await testReceiveSingleValueWithHttpDriver(
      'RETURN localdatetime({year: 2032, month: 5, day: 17, hour: 13, minute: 56, second: 51, nanosecond: 999888111})',
      '2032-05-17T13:56:51.999888111'
    )
  })

  it('should receive local time', async () => {
    if (testUtils.isServer() || !databaseSupportsSpatialAndTemporalTypes()) {
      return
    }

    await testReceiveSingleValueWithHttpDriver(
      'RETURN localtime({hour: 17, minute: 2, second: 21, nanosecond: 123456789})',
      '17:02:21.123456789'
    )
  })

  it('should receive time', async () => {
    if (testUtils.isServer() || !databaseSupportsSpatialAndTemporalTypes()) {
      return
    }

    await testReceiveSingleValueWithHttpDriver(
      'RETURN time({hour: 21, minute: 19, second: 1, nanosecond: 111, timezone: "+03:15"})',
      '21:19:01.000000111+03:15'
    )
  })

  it('should close all open sessions when closed', async () => {
    if (testUtils.isServer()) {
      return
    }

    const session1 = withFakeClose(httpDriver.session())
    const session2 = withFakeClose(httpDriver.session())
    const session3 = withFakeClose(httpDriver.session())

    expect(session1.closed).toBeFalsy()
    expect(session2.closed).toBeFalsy()
    expect(session3.closed).toBeFalsy()

    await httpDriver.close()

    expect(session1.closed).toBeTruthy()
    expect(session2.closed).toBeTruthy()
    expect(session3.closed).toBeTruthy()
  })

  async function testReceiveSingleValueWithHttpDriver (query, expectedValue) {
    const results = await runQueryAndGetResults(query, {}, httpDriver)
    const receivedValue = results[0][0]
    expect(expectedValue).toEqual(receivedValue)
  }

  async function testSendAndReceiveWithReturnQuery (values) {
    const query = 'RETURN $value'

    const boltResults = []
    for (const value of values) {
      const boltResult = await runQueryAndGetResults(
        query,
        { value: value },
        boltDriver
      )
      boltResults.push(boltResult)
    }

    const httpResults = []
    for (const value of values) {
      const httpResult = await runQueryAndGetResults(
        query,
        { value: value },
        httpDriver
      )
      httpResults.push(httpResult)
    }

    assertResultsAreEqual(boltResults, httpResults, values)
  }

  async function testReceivingOfResults (queries) {
    const boltResults = []
    for (const query of queries) {
      const boltResult = await runQueryAndGetResults(query, {}, boltDriver)
      boltResults.push(boltResult)
    }

    const httpResults = []
    for (const query of queries) {
      const httpResult = await runQueryAndGetResults(query, {}, httpDriver)
      httpResults.push(httpResult)
    }

    assertResultsAreEqual(boltResults, httpResults, queries)
  }

  function assertResultsAreEqual (boltResults, httpResults, testInputs) {
    expect(boltResults.length).toEqual(testInputs.length)
    expect(httpResults.length).toEqual(testInputs.length)

    for (let i = 0; i < testInputs.length; i++) {
      const testInput = testInputs[i]
      const boltResultRow = boltResults[i]
      const httpResultRow = httpResults[i]
      expect(boltResultRow).toEqual(
        httpResultRow,
        'Failed for: ' + JSON.stringify(testInput)
      )
    }
  }

  async function runQueryAndGetResults (query, params, driver) {
    const session = driver.session()
    try {
      const result = await session.run(query, params)
      return result.records.map(record =>
        record.keys.map(key => record.get(key))
      )
    } finally {
      session.close()
    }
  }

  async function runQueryAndGetError (query, driver) {
    const session = driver.session()
    try {
      await session.run(query)
    } catch (e) {
      return e
    } finally {
      session.close()
    }
  }

  async function runQueryAndGetStatementStatistics (query, driver) {
    const summary = await runQueryAndGetSummary(query, driver)
    return summary.counters
  }

  async function runQueryAndGetSummary (query, driver) {
    const session = driver.session()
    try {
      const result = await session.run(query)
      return result.summary
    } finally {
      session.close()
    }
  }

  async function runSetupQueries (queries) {
    const session = boltDriver.session()
    try {
      await session.writeTransaction(tx => {
        queries.forEach(query => tx.run(query))
        return null
      })
    } finally {
      session.close()
    }
  }

  async function testUnsupportedQueryParameterWithHttpDriver (value) {
    const session = httpDriver.session()
    let failed = false
    try {
      await session.run('RETURN $value', { value: value })
    } catch (error) {
      failed = true
      expect(error.name).toEqual('Neo4jError')
      expect(error.code).toEqual(neo4j.error.PROTOCOL_ERROR)
    } finally {
      session.close()
    }

    if (!failed) {
      throw new Error('Should not be possible to send ' + value)
    }
  }

  function databaseSupportsTransactionTerminationInLocks () {
    return serverVersion.compareTo(VERSION_3_1_0) >= 0
  }

  function databaseSupportsSpatialAndTemporalTypes () {
    return serverVersion.compareTo(VERSION_3_4_0) >= 0
  }

  function withFakeClose (httpSession) {
    httpSession.closed = false
    const originalClose = httpSession.close.bind(httpSession)
    httpSession.close = callback => {
      httpSession.closed = true
      originalClose(callback)
    }
    return httpSession
  }
})

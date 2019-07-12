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

import RoutingUtil from '../../src/internal/routing-util'
import Record from '../../src/record'
import Integer, { int } from '../../src/integer'
import {
  newError,
  PROTOCOL_ERROR,
  SERVICE_UNAVAILABLE,
  SESSION_EXPIRED
} from '../../src/error'
import lolex from 'lolex'
import FakeConnection from './fake-connection'
import ServerAddress from '../../src/internal/server-address'

const ROUTER_ADDRESS = ServerAddress.fromUrl('test.router.com:4242')

describe('#unit RoutingUtil', () => {
  it('should return retrieved records when query succeeds', done => {
    const session = FakeSession.successful({ records: ['foo', 'bar', 'baz'] })

    callRoutingProcedure(session, '')
      .then(records => {
        expect(records).toEqual(['foo', 'bar', 'baz'])
        done()
      })
      .catch(console.log)
  })

  it('should close session when query succeeds', done => {
    const session = FakeSession.successful({ records: ['foo', 'bar', 'baz'] })

    callRoutingProcedure(session, '')
      .then(() => {
        expect(session.isClosed()).toBeTruthy()
        done()
      })
      .catch(console.log)
  })

  it('should not close session when query fails', done => {
    const session = FakeSession.failed(newError('Oh no!', SESSION_EXPIRED))

    callRoutingProcedure(session, '')
      .then(() => {
        expect(session.isClosed()).toBeFalsy()
        done()
      })
      .catch(console.log)
  })

  it('should return null on connection error', done => {
    const session = FakeSession.failed(newError('Oh no!', SESSION_EXPIRED))

    callRoutingProcedure(session, '')
      .then(records => {
        expect(records).toBeNull()
        done()
      })
      .catch(console.log)
  })

  it('should fail when procedure not found', done => {
    const session = FakeSession.failed(
      newError('Oh no!', 'Neo.ClientError.Procedure.ProcedureNotFound')
    )

    callRoutingProcedure(session, '').catch(error => {
      expect(error.code).toBe(SERVICE_UNAVAILABLE)
      expect(error.message).toBe(
        `Server at ${ROUTER_ADDRESS} can't perform routing. Make sure you are connecting to a causal cluster`
      )
      done()
    })
  })

  it('should use getRoutingTable procedure with empty routing context when server version is 3.2.0', done => {
    const connection = new FakeConnection().withServerVersion('Neo4j/3.2.0')
    const session = FakeSession.withFakeConnection(connection)

    callRoutingProcedure(session, '', {}).then(() => {
      expect(connection.seenStatements).toEqual([
        'CALL dbms.cluster.routing.getRoutingTable($context)'
      ])
      expect(connection.seenParameters).toEqual([{ context: {} }])
      done()
    })
  })

  it('should use getRoutingTable procedure with routing context when server version is 3.2.0', done => {
    const connection = new FakeConnection().withServerVersion('Neo4j/3.2.0')
    const session = FakeSession.withFakeConnection(connection)

    callRoutingProcedure(session, '', { key1: 'value1', key2: 'value2' }).then(
      () => {
        expect(connection.seenStatements).toEqual([
          'CALL dbms.cluster.routing.getRoutingTable($context)'
        ])
        expect(connection.seenParameters).toEqual([
          { context: { key1: 'value1', key2: 'value2' } }
        ])
        done()
      }
    )
  })

  it('should use getRoutingTable procedure with empty routing context when server version is newer than 3.2.0', done => {
    const connection = new FakeConnection().withServerVersion('Neo4j/3.3.5')
    const session = FakeSession.withFakeConnection(connection)

    callRoutingProcedure(session, '', {}).then(() => {
      expect(connection.seenStatements).toEqual([
        'CALL dbms.cluster.routing.getRoutingTable($context)'
      ])
      expect(connection.seenParameters).toEqual([{ context: {} }])
      done()
    })
  })

  it('should use getRoutingTable procedure with routing context when server version is newer than 3.2.0', done => {
    const connection = new FakeConnection().withServerVersion('Neo4j/3.2.8')
    const session = FakeSession.withFakeConnection(connection)

    callRoutingProcedure(session, '', { key1: 'foo', key2: 'bar' }).then(() => {
      expect(connection.seenStatements).toEqual([
        'CALL dbms.cluster.routing.getRoutingTable($context)'
      ])
      expect(connection.seenParameters).toEqual([
        { context: { key1: 'foo', key2: 'bar' } }
      ])
      done()
    })
  })

  it('should use getRoutingTable procedure without database and routing context when server version is newer than 4.0.0', done => {
    testMultiDbRoutingProcedure({}, '', done)
  })

  it('should use getRoutingTable procedure without database but routing context when server version is newer than 4.0.0', done => {
    testMultiDbRoutingProcedure({ key1: 'foo', key2: 'bar' }, '', done)
  })

  it('should use getRoutingTable procedure without routing context but database when server version is newer than 4.0.0', done => {
    testMultiDbRoutingProcedure({}, 'myDatabase', done)
  })

  it('should use getRoutingTable procedure with database and routing context when server version is newer than 4.0.0', done => {
    testMultiDbRoutingProcedure(
      { key1: 'foo', key2: 'bar' },
      'myDatabase',
      done
    )
  })

  it('should parse valid ttl', () => {
    const clock = lolex.install()
    try {
      testValidTtlParsing(clock, 100, 5)
      testValidTtlParsing(clock, Date.now(), 3600) // 1 hour
      testValidTtlParsing(clock, Date.now(), 86400) // 24 hours
      testValidTtlParsing(clock, Date.now(), 3628800) // 42 days
      testValidTtlParsing(clock, 0, 1)
      testValidTtlParsing(clock, 50, 0)
      testValidTtlParsing(clock, Date.now(), 0)
    } finally {
      clock.uninstall()
    }
  })

  it('should not overflow parsing huge ttl', () => {
    const record = newRecord({ ttl: Integer.MAX_VALUE })
    const clock = lolex.install()
    try {
      clock.setSystemTime(42)

      const expirationTime = parseTtl(record)

      expect(expirationTime).toBe(Integer.MAX_VALUE)
    } finally {
      clock.uninstall()
    }
  })

  it('should return valid value parsing negative ttl', () => {
    const record = newRecord({ ttl: int(-42) })
    const clock = lolex.install()
    try {
      clock.setSystemTime(42)

      const expirationTime = parseTtl(record)

      expect(expirationTime).toBe(Integer.MAX_VALUE)
    } finally {
      clock.uninstall()
    }
  })

  it('should throw when record does not have a ttl entry', done => {
    const record = new Record(['notTtl', 'servers'], [])
    expectProtocolError(() => parseTtl(record), done)
  })

  it('should parse servers', () => {
    testValidServersParsing([], [], [])

    testValidServersParsing(['router1'], [], [])
    testValidServersParsing([], ['reader1'], [])
    testValidServersParsing([], [], ['writer1'])

    testValidServersParsing(['router1'], ['reader1'], [])
    testValidServersParsing(['router1'], ['reader1'], ['writer1'])
    testValidServersParsing([], ['reader1'], ['writer1'])

    testValidServersParsing(['router1'], ['reader1'], ['writer1'])
    testValidServersParsing(
      ['router1', 'router2'],
      ['reader1', 'reader2'],
      ['writer1']
    )
    testValidServersParsing(
      ['router1', 'router2'],
      ['reader1', 'reader2'],
      ['writer1', 'writer2']
    )
  })

  it('should fail to parse servers entry when record does not have servers', done => {
    const record = new Record(
      ['ttl', 'notServers'],
      [int(42), [{ role: 'READ', addresses: ['1', '2', '3'] }]]
    )
    expectProtocolError(() => parseServers(record), done)
  })

  it('should fail to parse servers entry without role', done => {
    const record = new Record(
      ['ttl', 'servers'],
      [int(42), [{ notRole: 'READ', addresses: ['1', '2', '3'] }]]
    )
    expectProtocolError(() => parseServers(record), done)
  })

  it('should fail to parse servers entry with illegal role', done => {
    const record = new Record(
      ['ttl', 'servers'],
      [int(42), [{ role: 'ARBITER', addresses: ['1', '2', '3'] }]]
    )
    expectProtocolError(() => parseServers(record), done)
  })

  it('should fail to parse servers entry with just ttl', done => {
    const record = new Record(['ttl', 'servers'], [int(42), [{ role: 'READ' }]])
    expectProtocolError(() => parseServers(record), done)
  })

  it('should fail to parse servers entry without addresses', done => {
    const record = new Record(
      ['ttl', 'servers'],
      [int(42), [{ role: 'WRITE', notAddresses: ['1', '2', '3'] }]]
    )
    expectProtocolError(() => parseServers(record), done)
  })

  it('should fail to parse servers entry with string addresses', done => {
    const record = new Record(
      ['ttl', 'servers'],
      [int(42), [{ role: 'WRITE', addresses: '' }]]
    )
    expectProtocolError(() => parseServers(record), done)
  })

  it('should fail to parse servers entry with null addresses', done => {
    const record = new Record(
      ['ttl', 'servers'],
      [int(42), [{ role: 'WRITE', addresses: null }]]
    )
    expectProtocolError(() => parseServers(record), done)
  })

  it('should fail to parse servers entry with integer addresses', done => {
    const record = new Record(
      ['ttl', 'servers'],
      [int(42), [{ role: 'WRITE', addresses: 12345 }]]
    )
    expectProtocolError(() => parseServers(record), done)
  })

  it('should fail to parse servers entry with object addresses', done => {
    const record = new Record(
      ['ttl', 'servers'],
      [int(42), [{ role: 'WRITE', addresses: { key: ['localhost'] } }]]
    )
    expectProtocolError(() => parseServers(record), done)
  })

  function testMultiDbRoutingProcedure (context, database, done) {
    const connection = new FakeConnection().withServerVersion('Neo4j/4.0.0')
    const session = FakeSession.withFakeConnection(connection)

    callRoutingProcedure(session, database, context).then(() => {
      expect(connection.seenStatements).toEqual([
        'CALL dbms.routing.getRoutingTable($context, $database)'
      ])
      expect(connection.seenParameters).toEqual([
        { context, database: database || null }
      ])
      done()
    })
  }

  function testValidTtlParsing (clock, currentTime, ttlSeconds) {
    clock.setSystemTime(currentTime)
    const expectedExpirationTime = currentTime + ttlSeconds * 1000

    // verify parsing when TTL is an Integer
    const record1 = newRecord({ ttl: int(ttlSeconds) })
    const expirationTime1 = parseTtl(record1).toNumber()
    expect(expirationTime1).toEqual(expectedExpirationTime)

    // verify parsing when TTL is a JavaScript Number, this can happen when driver is configured with {disableLosslessIntegers: true}
    const record2 = newRecord({ ttl: ttlSeconds })
    const expirationTime2 = parseTtl(record2).toNumber()
    expect(expirationTime2).toEqual(expectedExpirationTime)
  }

  function testValidServersParsing (
    routerAddresses,
    readerAddresses,
    writerAddresses
  ) {
    const record = newRecord({
      routers: routerAddresses,
      readers: readerAddresses,
      writers: writerAddresses
    })

    const { routers, readers, writers } = parseServers(record)

    expect(routers).toEqual(routerAddresses.map(r => ServerAddress.fromUrl(r)))
    expect(readers).toEqual(readerAddresses.map(r => ServerAddress.fromUrl(r)))
    expect(writers).toEqual(writerAddresses.map(w => ServerAddress.fromUrl(w)))
  }

  function callRoutingProcedure (session, database, routingContext) {
    const util = new RoutingUtil(routingContext || {})
    return util.callRoutingProcedure(session, database, ROUTER_ADDRESS)
  }

  function parseTtl (record) {
    const util = new RoutingUtil()
    return util.parseTtl(record, ROUTER_ADDRESS)
  }

  function parseServers (record) {
    const util = new RoutingUtil()
    return util.parseServers(record, ROUTER_ADDRESS)
  }

  function newRecord ({
    ttl = int(42),
    routers = [],
    readers = [],
    writers = []
  }) {
    const routersField = {
      role: 'ROUTE',
      addresses: routers
    }
    const readersField = {
      role: 'READ',
      addresses: readers
    }
    const writersField = {
      role: 'WRITE',
      addresses: writers
    }
    return new Record(
      ['ttl', 'servers'],
      [ttl, [routersField, readersField, writersField]]
    )
  }

  function expectProtocolError (action, done) {
    const promise = new Promise((resolve, reject) => {
      try {
        resolve(action())
      } catch (e) {
        reject(e)
      }
    })

    promise.catch(error => {
      expect(error.code).toBe(PROTOCOL_ERROR)
      done()
    })
  }

  class FakeSession {
    constructor (runResponse, fakeConnection) {
      this._runResponse = runResponse
      this._fakeConnection = fakeConnection
      this._closed = false
    }

    static successful (result) {
      return new FakeSession(Promise.resolve(result), null)
    }

    static failed (error) {
      return new FakeSession(Promise.reject(error), null)
    }

    static withFakeConnection (connection) {
      return new FakeSession(null, connection)
    }

    _run (ignoreStatement, ignoreParameters, statementRunner) {
      if (this._runResponse) {
        return this._runResponse
      }
      statementRunner(this._fakeConnection)
      return Promise.resolve()
    }

    close () {
      this._closed = true
    }

    isClosed () {
      return this._closed
    }
  }
})

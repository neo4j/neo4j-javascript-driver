/**
 * Copyright (c) "Neo4j"
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

import BoltProtocolV4x3 from '../../src/bolt/bolt-protocol-v4x3'
import RequestMessage from '../../src/bolt/request-message'
import utils from '../test-utils'
import { RouteObserver } from '../../src/bolt/stream-observers'
import { internal } from 'neo4j-driver-core'

const WRITE = 'WRITE'

const {
  txConfig: { TxConfig },
  bookmark: { Bookmark }
} = internal

describe('#unit BoltProtocolV4x3', () => {
  beforeEach(() => {
    expect.extend(utils.matchers)
  })

  it('should request routing information', () => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV4x3(recorder, null, false)
    utils.spyProtocolWrite(protocol)
    const routingContext = { someContextParam: 'value' }
    const databaseName = 'name'

    const observer = protocol.requestRoutingInformation({
      routingContext,
      databaseName
    })

    protocol.verifyMessageCount(1)
    expect(protocol.messages[0]).toBeMessage(
      RequestMessage.route(routingContext, [], databaseName)
    )
    expect(protocol.observers).toEqual([observer])
    expect(observer).toEqual(expect.any(RouteObserver))
    expect(protocol.flushes).toEqual([true])
  })

  it('should request routing information sending bookmarks', () => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV4x3(recorder, null, false)
    utils.spyProtocolWrite(protocol)
    const routingContext = { someContextParam: 'value' }
    const listOfBookmarks = ['a', 'b', 'c']
    const bookmark = new Bookmark(listOfBookmarks)
    const databaseName = 'name'

    const observer = protocol.requestRoutingInformation({
      routingContext,
      databaseName,
      sessionContext: { bookmark }
    })

    protocol.verifyMessageCount(1)
    expect(protocol.messages[0]).toBeMessage(
      RequestMessage.route(routingContext, listOfBookmarks, databaseName)
    )
    expect(protocol.observers).toEqual([observer])
    expect(observer).toEqual(expect.any(RouteObserver))
    expect(protocol.flushes).toEqual([true])
  })

  it('should run a query', () => {
    const database = 'testdb'
    const bookmark = new Bookmark([
      'neo4j:bookmark:v1:tx1',
      'neo4j:bookmark:v1:tx2'
    ])
    const txConfig = new TxConfig({
      timeout: 5000,
      metadata: { x: 1, y: 'something' }
    })
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV4x3(recorder, null, false)
    utils.spyProtocolWrite(protocol)

    const query = 'RETURN $x, $y'
    const parameters = { x: 'x', y: 'y' }

    const observer = protocol.run(query, parameters, {
      bookmark,
      txConfig,
      database,
      mode: WRITE
    })

    protocol.verifyMessageCount(2)

    expect(protocol.messages[0]).toBeMessage(
      RequestMessage.runWithMetadata(query, parameters, {
        bookmark,
        txConfig,
        database,
        mode: WRITE
      })
    )
    expect(protocol.messages[1]).toBeMessage(RequestMessage.pull())
    expect(protocol.observers).toEqual([observer, observer])
    expect(protocol.flushes).toEqual([false, true])
  })
  it('should begin a transaction', () => {
    const database = 'testdb'
    const bookmark = new Bookmark([
      'neo4j:bookmark:v1:tx1',
      'neo4j:bookmark:v1:tx2'
    ])
    const txConfig = new TxConfig({
      timeout: 5000,
      metadata: { x: 1, y: 'something' }
    })
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV4x3(recorder, null, false)
    utils.spyProtocolWrite(protocol)

    const observer = protocol.beginTransaction({
      bookmark,
      txConfig,
      database,
      mode: WRITE
    })

    protocol.verifyMessageCount(1)
    expect(protocol.messages[0]).toBeMessage(
      RequestMessage.begin({ bookmark, txConfig, database, mode: WRITE })
    )
    expect(protocol.observers).toEqual([observer])
    expect(protocol.flushes).toEqual([true])
  })

  it('should return correct bolt version number', () => {
    const protocol = new BoltProtocolV4x3(null, null, false)

    expect(protocol.version).toBe(4.3)
  })

  it('should update metadata', () => {
    const metadata = { t_first: 1, t_last: 2, db_hits: 3, some_other_key: 4 }
    const protocol = new BoltProtocolV4x3(null, null, false)

    const transformedMetadata = protocol.transformMetadata(metadata)

    expect(transformedMetadata).toEqual({
      result_available_after: 1,
      result_consumed_after: 2,
      db_hits: 3,
      some_other_key: 4
    })
  })

  it('should initialize connection', () => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV4x3(recorder, null, false)
    utils.spyProtocolWrite(protocol)

    const clientName = 'js-driver/1.2.3'
    const authToken = { username: 'neo4j', password: 'secret' }

    const observer = protocol.initialize({ userAgent: clientName, authToken })

    protocol.verifyMessageCount(1)
    expect(protocol.messages[0]).toBeMessage(
      RequestMessage.hello(clientName, authToken)
    )
    expect(protocol.observers).toEqual([observer])
    expect(protocol.flushes).toEqual([true])
  })

  it('should begin a transaction', () => {
    const bookmark = new Bookmark([
      'neo4j:bookmark:v1:tx1',
      'neo4j:bookmark:v1:tx2'
    ])
    const txConfig = new TxConfig({
      timeout: 5000,
      metadata: { x: 1, y: 'something' }
    })
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV4x3(recorder, null, false)
    utils.spyProtocolWrite(protocol)

    const observer = protocol.beginTransaction({
      bookmark,
      txConfig,
      mode: WRITE
    })

    protocol.verifyMessageCount(1)
    expect(protocol.messages[0]).toBeMessage(
      RequestMessage.begin({ bookmark, txConfig, mode: WRITE })
    )
    expect(protocol.observers).toEqual([observer])
    expect(protocol.flushes).toEqual([true])
  })

  it('should commit', () => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV4x3(recorder, null, false)
    utils.spyProtocolWrite(protocol)

    const observer = protocol.commitTransaction()

    protocol.verifyMessageCount(1)
    expect(protocol.messages[0]).toBeMessage(RequestMessage.commit())
    expect(protocol.observers).toEqual([observer])
    expect(protocol.flushes).toEqual([true])
  })

  it('should rollback', () => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV4x3(recorder, null, false)
    utils.spyProtocolWrite(protocol)

    const observer = protocol.rollbackTransaction()

    protocol.verifyMessageCount(1)
    expect(protocol.messages[0]).toBeMessage(RequestMessage.rollback())
    expect(protocol.observers).toEqual([observer])
    expect(protocol.flushes).toEqual([true])
  })

  describe('Bolt v4.4', () => {
    /**
     * @param {string} impersonatedUser The impersonated user.
     * @param {function(protocol: BoltProtocolV4x3)} fn 
     */
    function verifyImpersonationNotSupportedErrror (impersonatedUser, fn) {
      const recorder = new utils.MessageRecordingConnection()
      const protocol = new BoltProtocolV4x3(recorder, null, false)

      expect(() => fn(protocol)).toThrowError(
        'Driver is connected to the database that does not support user impersonation. ' +
          'Please upgrade to neo4j 4.4.0 or later in order to use this functionality. ' +
          `Trying to impersonate ${impersonatedUser}.`
      )
    }

    describe('beginTransaction', () => {
      function verifyBeginTransaction(impersonatedUser) {
        verifyImpersonationNotSupportedErrror(
          impersonatedUser,
          protocol => protocol.beginTransaction({ impersonatedUser }))
      }

      it('should throw error when impersonatedUser is set', () => {
        verifyBeginTransaction('test')
      })
    })

    describe('run', () => {
      function verifyRun (impersonatedUser) {
        verifyImpersonationNotSupportedErrror(
          impersonatedUser,
          protocol => protocol.run('query', {}, { impersonatedUser }))
      }

      it('should throw error when impersonatedUser is set', () => {
        verifyRun('test')
      })
    })
  })

  describe('unpacker configuration', () => {
    test.each([
      [false, false],
      [false, true],
      [true, false],
      [true, true]
    ])(
      'should create unpacker with disableLosslessIntegers=%p and useBigInt=%p',
      (disableLosslessIntegers, useBigInt) => {
        const protocol = new BoltProtocolV4x3(null, null, {
          disableLosslessIntegers,
          useBigInt
        })
        expect(protocol._unpacker._disableLosslessIntegers).toBe(
          disableLosslessIntegers
        )
        expect(protocol._unpacker._useBigInt).toBe(useBigInt)
      }
    )
  })
})

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

import BoltProtocolV1 from '../../src/internal/bolt-protocol-v1'
import RequestMessage from '../../src/internal/request-message'
import Bookmark from '../../src/internal/bookmark'
import TxConfig from '../../src/internal/tx-config'
import { WRITE } from '../../src/driver'
import utils from './test-utils'
import { LoginObserver } from '../../src/internal/stream-observers'

describe('#unit BoltProtocolV1', () => {
  beforeEach(() => {
    jasmine.addMatchers(utils.matchers)
  })

  it('should not change metadata', () => {
    const metadata = {
      result_available_after: 1,
      result_consumed_after: 2,
      t_first: 3,
      t_last: 4
    }
    const protocol = new BoltProtocolV1(
      new utils.MessageRecordingConnection(),
      null,
      false
    )

    const transformedMetadata = protocol.transformMetadata(metadata)

    expect(transformedMetadata).toEqual({
      result_available_after: 1,
      result_consumed_after: 2,
      t_first: 3,
      t_last: 4
    })
  })

  it('should initialize the connection', () => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV1(recorder, null, false)

    const onError = _error => {}
    const onComplete = () => {}
    const clientName = 'js-driver/1.2.3'
    const authToken = { username: 'neo4j', password: 'secret' }

    const observer = protocol.initialize({
      userAgent: clientName,
      authToken,
      onError,
      onComplete
    })

    expect(observer).toBeTruthy()
    expect(observer instanceof LoginObserver).toBeTruthy()
    expect(observer._afterError).toBe(onError)
    expect(observer._afterComplete).toBe(onComplete)

    recorder.verifyMessageCount(1)
    expect(recorder.messages[0]).toBeMessage(
      RequestMessage.init(clientName, authToken)
    )
    expect(recorder.observers).toEqual([observer])
    expect(recorder.flushes).toEqual([true])
  })

  it('should run a statement', () => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV1(recorder, null, false)

    const statement = 'RETURN $x, $y'
    const parameters = { x: 'x', y: 'y' }
    const observer = protocol.run(statement, parameters, {
      bookmark: Bookmark.empty(),
      txConfig: TxConfig.empty(),
      mode: WRITE
    })

    recorder.verifyMessageCount(2)

    expect(recorder.messages[0]).toBeMessage(
      RequestMessage.run(statement, parameters)
    )
    expect(recorder.messages[1]).toBeMessage(RequestMessage.pullAll())
    expect(recorder.observers).toEqual([observer, observer])
    expect(recorder.flushes).toEqual([false, true])
  })

  it('should reset the connection', () => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV1(recorder, null, false)

    const observer = protocol.reset()

    recorder.verifyMessageCount(1)
    expect(recorder.messages[0]).toBeMessage(RequestMessage.reset())
    expect(recorder.observers).toEqual([observer])
    expect(recorder.flushes).toEqual([true])
  })

  it('should begin a transaction', () => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV1(recorder, null, false)

    const bookmark = new Bookmark('neo4j:bookmark:v1:tx42')

    const observer = protocol.beginTransaction({
      bookmark: bookmark,
      txConfig: TxConfig.empty(),
      mode: WRITE
    })

    recorder.verifyMessageCount(2)

    expect(recorder.messages[0]).toBeMessage(
      RequestMessage.run('BEGIN', bookmark.asBeginTransactionParameters())
    )
    expect(recorder.messages[1]).toBeMessage(RequestMessage.pullAll())
    expect(recorder.observers).toEqual([observer, observer])
    expect(recorder.flushes).toEqual([false, false])
  })

  it('should commit a transaction', () => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV1(recorder, null, false)

    const observer = protocol.commitTransaction()

    recorder.verifyMessageCount(2)

    expect(recorder.messages[0]).toBeMessage(RequestMessage.run('COMMIT', {}))
    expect(recorder.messages[1]).toBeMessage(RequestMessage.pullAll())
    expect(recorder.observers).toEqual([observer, observer])
    expect(recorder.flushes).toEqual([false, true])
  })

  it('should rollback a transaction', () => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV1(recorder, null, false)

    const observer = protocol.rollbackTransaction()

    recorder.verifyMessageCount(2)

    expect(recorder.messages[0]).toBeMessage(RequestMessage.run('ROLLBACK', {}))
    expect(recorder.messages[1]).toBeMessage(RequestMessage.pullAll())
    expect(recorder.observers).toEqual([observer, observer])
    expect(recorder.flushes).toEqual([false, true])
  })

  it('should return correct bolt version number', () => {
    const protocol = new BoltProtocolV1(null, null, false)

    expect(protocol.version).toBe(1)
  })

  describe('Bolt V3', () => {
    /**
     * @param {function(protocol: BoltProtocolV1)} fn
     */
    function verifyError (fn) {
      const recorder = new utils.MessageRecordingConnection()
      const protocol = new BoltProtocolV1(recorder, null, false)

      expect(() => fn(protocol)).toThrowError(
        'Driver is connected to the database that does not support transaction configuration. ' +
          'Please upgrade to neo4j 3.5.0 or later in order to use this functionality'
      )
    }

    describe('beginTransaction', () => {
      function verifyBeginTransaction (txConfig) {
        verifyError(protocol => protocol.beginTransaction({ txConfig }))
      }

      it('should throw error when txConfig.timeout is set', () => {
        verifyBeginTransaction(new TxConfig({ timeout: 5000 }))
      })

      it('should throw error when txConfig.metadata is set', () => {
        verifyBeginTransaction(new TxConfig({ metadata: { x: 1, y: true } }))
      })

      it('should throw error when txConfig is set', () => {
        verifyBeginTransaction(
          new TxConfig({ timeout: 5000, metadata: { x: 1, y: true } })
        )
      })
    })

    describe('run', () => {
      function verifyRun (txConfig) {
        verifyError((protocol, _observer) =>
          protocol.run('statement', {}, { txConfig })
        )
      }

      it('should throw error when txConfig.timeout is set', () => {
        verifyRun(new TxConfig({ timeout: 5000 }))
      })

      it('should throw error when txConfig.metadata is set', () => {
        verifyRun(new TxConfig({ metadata: { x: 1, y: true } }))
      })

      it('should throw error when txConfig is set', () => {
        verifyRun(new TxConfig({ timeout: 5000, metadata: { x: 1, y: true } }))
      })
    })
  })

  describe('Bolt V4', () => {
    /**
     * @param {function(protocol: BoltProtocolV1)} fn
     */
    function verifyError (fn) {
      const recorder = new utils.MessageRecordingConnection()
      const protocol = new BoltProtocolV1(recorder, null, false)

      expect(() => fn(protocol)).toThrowError(
        'Driver is connected to the database that does not support multiple databases. ' +
          'Please upgrade to neo4j 4.0.0 or later in order to use this functionality'
      )
    }

    describe('beginTransaction', () => {
      function verifyBeginTransaction (database) {
        verifyError(protocol => protocol.beginTransaction({ database }))
      }

      it('should throw error when database is set', () => {
        verifyBeginTransaction('test')
      })
    })

    describe('run', () => {
      function verifyRun (database) {
        verifyError(protocol => protocol.run('statement', {}, { database }))
      }

      it('should throw error when database is set', () => {
        verifyRun('test')
      })
    })
  })
})

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

import BoltProtocolV1 from '../../src/bolt/bolt-protocol-v1'
import RequestMessage from '../../src/bolt/request-message'
import { internal } from 'neo4j-driver-core'
import utils from '../test-utils'
import { LoginObserver } from '../../src/bolt/stream-observers'

const WRITE = 'WRITE'

const {
  bookmark: { Bookmark },
  txConfig: { TxConfig }
} = internal

describe('#unit BoltProtocolV1', () => {
  beforeEach(() => {
    expect.extend(utils.matchers)
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
    const protocol = utils.spyProtocolWrite(
      new BoltProtocolV1(recorder, null, false)
    )

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

    protocol.verifyMessageCount(1)
    expect(protocol.messages[0]).toBeMessage(
      RequestMessage.init(clientName, authToken)
    )
    expect(protocol.observers).toEqual([observer])
    expect(protocol.flushes).toEqual([true])
  })

  it('should run a query', () => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = utils.spyProtocolWrite(
      new BoltProtocolV1(recorder, null, false)
    )

    const query = 'RETURN $x, $y'
    const parameters = { x: 'x', y: 'y' }
    const observer = protocol.run(query, parameters, {
      bookmark: Bookmark.empty(),
      txConfig: TxConfig.empty(),
      mode: WRITE
    })

    protocol.verifyMessageCount(2)

    expect(protocol.messages[0]).toBeMessage(
      RequestMessage.run(query, parameters)
    )
    expect(protocol.messages[1]).toBeMessage(RequestMessage.pullAll())
    expect(protocol.observers).toEqual([observer, observer])
    expect(protocol.flushes).toEqual([false, true])
  })

  it('should reset the connection', () => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = utils.spyProtocolWrite(
      new BoltProtocolV1(recorder, null, false)
    )

    const observer = protocol.reset()

    protocol.verifyMessageCount(1)
    expect(protocol.messages[0]).toBeMessage(RequestMessage.reset())
    expect(protocol.observers).toEqual([observer])
    expect(protocol.flushes).toEqual([true])
  })

  it('should begin a transaction', () => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = utils.spyProtocolWrite(
      new BoltProtocolV1(recorder, null, false)
    )

    const bookmark = new Bookmark('neo4j:bookmark:v1:tx42')

    const observer = protocol.beginTransaction({
      bookmark: bookmark,
      txConfig: TxConfig.empty(),
      mode: WRITE
    })

    protocol.verifyMessageCount(2)

    expect(protocol.messages[0]).toBeMessage(
      RequestMessage.run('BEGIN', bookmark.asBeginTransactionParameters())
    )
    expect(protocol.messages[1]).toBeMessage(RequestMessage.pullAll())
    expect(protocol.observers).toEqual([observer, observer])
    expect(protocol.flushes).toEqual([false, false])
  })

  it('should commit a transaction', () => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = utils.spyProtocolWrite(
      new BoltProtocolV1(recorder, null, false)
    )

    const observer = protocol.commitTransaction()

    protocol.verifyMessageCount(2)

    expect(protocol.messages[0]).toBeMessage(RequestMessage.run('COMMIT', {}))
    expect(protocol.messages[1]).toBeMessage(RequestMessage.pullAll())
    expect(protocol.observers).toEqual([observer, observer])
    expect(protocol.flushes).toEqual([false, true])
  })

  it('should rollback a transaction', () => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = utils.spyProtocolWrite(
      new BoltProtocolV1(recorder, null, false)
    )

    const observer = protocol.rollbackTransaction()

    protocol.verifyMessageCount(2)

    expect(protocol.messages[0]).toBeMessage(RequestMessage.run('ROLLBACK', {}))
    expect(protocol.messages[1]).toBeMessage(RequestMessage.pullAll())
    expect(protocol.observers).toEqual([observer, observer])
    expect(protocol.flushes).toEqual([false, true])
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
          protocol.run('query', {}, { txConfig })
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
        verifyError(protocol => protocol.run('query', {}, { database }))
      }

      it('should throw error when database is set', () => {
        verifyRun('test')
      })
    })
  })

  describe('Bolt v4.4', () => {
    /**
     * @param {string} impersonatedUser The impersonated user.
     * @param {function(protocol: BoltProtocolV1)} fn 
     */
    function verifyImpersonationNotSupportedErrror (impersonatedUser, fn) {
      const recorder = new utils.MessageRecordingConnection()
      const protocol = new BoltProtocolV1(recorder, null, false)

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
        const protocol = new BoltProtocolV1(null, null, {
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

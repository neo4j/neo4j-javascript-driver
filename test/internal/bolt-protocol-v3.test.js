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

import BoltProtocolV3 from '../../src/internal/bolt-protocol-v3'
import RequestMessage from '../../src/internal/request-message'
import utils from './test-utils'
import Bookmark from '../../src/internal/bookmark'
import TxConfig from '../../src/internal/tx-config'
import { WRITE } from '../../src/driver'

describe('#unit BoltProtocolV3', () => {
  beforeEach(() => {
    jasmine.addMatchers(utils.matchers)
  })

  it('should update metadata', () => {
    const metadata = { t_first: 1, t_last: 2, db_hits: 3, some_other_key: 4 }
    const protocol = new BoltProtocolV3(null, null, false)

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
    const protocol = new BoltProtocolV3(recorder, null, false)

    const clientName = 'js-driver/1.2.3'
    const authToken = { username: 'neo4j', password: 'secret' }

    const observer = protocol.initialize({ userAgent: clientName, authToken })

    recorder.verifyMessageCount(1)
    expect(recorder.messages[0]).toBeMessage(
      RequestMessage.hello(clientName, authToken)
    )
    expect(recorder.observers).toEqual([observer])
    expect(recorder.flushes).toEqual([true])
  })

  it('should run a statement', () => {
    const bookmark = new Bookmark([
      'neo4j:bookmark:v1:tx1',
      'neo4j:bookmark:v1:tx2'
    ])
    const txConfig = new TxConfig({
      timeout: 5000,
      metadata: { x: 1, y: 'something' }
    })
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV3(recorder, null, false)

    const statement = 'RETURN $x, $y'
    const parameters = { x: 'x', y: 'y' }

    const observer = protocol.run(statement, parameters, {
      bookmark,
      txConfig,
      mode: WRITE
    })

    recorder.verifyMessageCount(2)

    expect(recorder.messages[0]).toBeMessage(
      RequestMessage.runWithMetadata(statement, parameters, {
        bookmark,
        txConfig,
        mode: WRITE
      })
    )
    expect(recorder.messages[1]).toBeMessage(RequestMessage.pullAll())
    expect(recorder.observers).toEqual([observer, observer])
    expect(recorder.flushes).toEqual([false, true])
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
    const protocol = new BoltProtocolV3(recorder, null, false)

    const observer = protocol.beginTransaction({
      bookmark,
      txConfig,
      mode: WRITE
    })

    recorder.verifyMessageCount(1)
    expect(recorder.messages[0]).toBeMessage(
      RequestMessage.begin({ bookmark, txConfig, mode: WRITE })
    )
    expect(recorder.observers).toEqual([observer])
    expect(recorder.flushes).toEqual([true])
  })

  it('should commit', () => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV3(recorder, null, false)

    const observer = protocol.commitTransaction()

    recorder.verifyMessageCount(1)
    expect(recorder.messages[0]).toBeMessage(RequestMessage.commit())
    expect(recorder.observers).toEqual([observer])
    expect(recorder.flushes).toEqual([true])
  })

  it('should rollback', () => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV3(recorder, null, false)

    const observer = protocol.rollbackTransaction()

    recorder.verifyMessageCount(1)
    expect(recorder.messages[0]).toBeMessage(RequestMessage.rollback())
    expect(recorder.observers).toEqual([observer])
    expect(recorder.flushes).toEqual([true])
  })

  describe('Bolt V4', () => {
    /**
     * @param {function(protocol: BoltProtocolV3)} fn
     */
    function verifyError (fn) {
      const recorder = new utils.MessageRecordingConnection()
      const protocol = new BoltProtocolV3(recorder, null, false)

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

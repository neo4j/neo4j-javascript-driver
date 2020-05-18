/**
 * Copyright (c) 2002-2020 "Neo4j,"
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

import BoltProtocolV4x0 from '../../src/internal/bolt-protocol-v4x0'
import RequestMessage from '../../src/internal/request-message'
import utils from './test-utils'
import Bookmark from '../../src/internal/bookmark'
import TxConfig from '../../src/internal/tx-config'
import { WRITE } from '../../src/driver'

describe('#unit BoltProtocolV4x0', () => {
  beforeEach(() => {
    jasmine.addMatchers(utils.matchers)
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
    const protocol = new BoltProtocolV4x0(recorder, null, false)

    const query = 'RETURN $x, $y'
    const parameters = { x: 'x', y: 'y' }

    const observer = protocol.run(query, parameters, {
      bookmark,
      txConfig,
      database,
      mode: WRITE
    })

    recorder.verifyMessageCount(2)

    expect(recorder.messages[0]).toBeMessage(
      RequestMessage.runWithMetadata(query, parameters, {
        bookmark,
        txConfig,
        database,
        mode: WRITE
      })
    )
    expect(recorder.messages[1]).toBeMessage(RequestMessage.pull())
    expect(recorder.observers).toEqual([observer, observer])
    expect(recorder.flushes).toEqual([false, true])
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
    const protocol = new BoltProtocolV4x0(recorder, null, false)

    const observer = protocol.beginTransaction({
      bookmark,
      txConfig,
      database,
      mode: WRITE
    })

    recorder.verifyMessageCount(1)
    expect(recorder.messages[0]).toBeMessage(
      RequestMessage.begin({ bookmark, txConfig, database, mode: WRITE })
    )
    expect(recorder.observers).toEqual([observer])
    expect(recorder.flushes).toEqual([true])
  })

  it('should return correct bolt version number', () => {
    const protocol = new BoltProtocolV4x0(null, null, false)

    expect(protocol.version).toBe(4)
  })
})

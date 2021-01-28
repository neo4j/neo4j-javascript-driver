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

import RequestMessage from '../../src/v1/internal/request-message'
import Bookmark from '../../src/v1/internal/bookmark'
import TxConfig from '../../src/v1/internal/tx-config'
import { int } from '../../src/v1'
import { READ, WRITE } from '../../src/v1/driver'

describe('RequestMessage', () => {
  it('should create INIT message', () => {
    const userAgent = 'my-driver/1.0.2'
    const authToken = { username: 'neo4j', password: 'secret' }

    const message = RequestMessage.init(userAgent, authToken)

    expect(message.signature).toEqual(0x01)
    expect(message.fields).toEqual([userAgent, authToken])
    expect(message.toString()).toEqual(`INIT ${userAgent} {...}`)
  })

  it('should create RUN message', () => {
    const statement = 'RETURN $x'
    const parameters = { x: 42 }

    const message = RequestMessage.run(statement, parameters)

    expect(message.signature).toEqual(0x10)
    expect(message.fields).toEqual([statement, parameters])
    expect(message.toString()).toEqual(
      `RUN ${statement} ${JSON.stringify(parameters)}`
    )
  })

  it('should create PULL_ALL message', () => {
    const message = RequestMessage.pullAll()

    expect(message.signature).toEqual(0x3f)
    expect(message.fields).toEqual([])
    expect(message.toString()).toEqual('PULL_ALL')
  })

  it('should create RESET message', () => {
    const message = RequestMessage.reset()

    expect(message.signature).toEqual(0x0f)
    expect(message.fields).toEqual([])
    expect(message.toString()).toEqual('RESET')
  })

  it('should create HELLO message', () => {
    const userAgent = 'my-driver/1.0.2'
    const authToken = { username: 'neo4j', password: 'secret' }

    const message = RequestMessage.hello(userAgent, authToken)

    expect(message.signature).toEqual(0x01)
    expect(message.fields).toEqual([
      { user_agent: userAgent, username: 'neo4j', password: 'secret' }
    ])
    expect(message.toString()).toEqual(
      `HELLO {user_agent: '${userAgent}', ...}`
    )
  })

  it('should create BEGIN message', () => {
    ;[READ, WRITE].forEach(mode => {
      const bookmark = new Bookmark([
        'neo4j:bookmark:v1:tx1',
        'neo4j:bookmark:v1:tx10'
      ])
      const txConfig = new TxConfig({ timeout: 42, metadata: { key: 42 } })

      const message = RequestMessage.begin(bookmark, txConfig, mode)

      const expectedMetadata = {
        bookmarks: bookmark.values(),
        tx_timeout: int(42),
        tx_metadata: { key: 42 }
      }
      if (mode === READ) {
        expectedMetadata.mode = 'r'
      }

      expect(message.signature).toEqual(0x11)
      expect(message.fields).toEqual([expectedMetadata])
      expect(message.toString()).toEqual(
        `BEGIN ${JSON.stringify(expectedMetadata)}`
      )
    })
  })

  it('should create COMMIT message', () => {
    const message = RequestMessage.commit()

    expect(message.signature).toEqual(0x12)
    expect(message.fields).toEqual([])
    expect(message.toString()).toEqual('COMMIT')
  })

  it('should create ROLLBACK message', () => {
    const message = RequestMessage.rollback()

    expect(message.signature).toEqual(0x13)
    expect(message.fields).toEqual([])
    expect(message.toString()).toEqual('ROLLBACK')
  })

  it('should create RUN with metadata message', () => {
    ;[READ, WRITE].forEach(mode => {
      const statement = 'RETURN $x'
      const parameters = { x: 42 }
      const bookmark = new Bookmark([
        'neo4j:bookmark:v1:tx1',
        'neo4j:bookmark:v1:tx10',
        'neo4j:bookmark:v1:tx100'
      ])
      const txConfig = new TxConfig({
        timeout: 999,
        metadata: { a: 'a', b: 'b' }
      })

      const message = RequestMessage.runWithMetadata(
        statement,
        parameters,
        bookmark,
        txConfig,
        mode
      )

      const expectedMetadata = {
        bookmarks: bookmark.values(),
        tx_timeout: int(999),
        tx_metadata: { a: 'a', b: 'b' }
      }
      if (mode === READ) {
        expectedMetadata.mode = 'r'
      }

      expect(message.signature).toEqual(0x10)
      expect(message.fields).toEqual([statement, parameters, expectedMetadata])
      expect(message.toString()).toEqual(
        `RUN ${statement} ${JSON.stringify(parameters)} ${JSON.stringify(
          expectedMetadata
        )}`
      )
    })
  })

  it('should create GOODBYE message', () => {
    const message = RequestMessage.goodbye()

    expect(message.signature).toEqual(0x02)
    expect(message.fields).toEqual([])
    expect(message.toString()).toEqual('GOODBYE')
  })
})

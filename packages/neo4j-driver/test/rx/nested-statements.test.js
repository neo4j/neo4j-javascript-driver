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

import { Notification, throwError } from 'rxjs'
import {
  mergeMap,
  materialize,
  toArray,
  map,
  bufferCount,
  catchError,
  concatWith
} from 'rxjs/operators'
import neo4j from '../../src'
// eslint-disable-next-line no-unused-vars
import RxSession from '../../src/session-rx'
import sharedNeo4j from '../internal/shared-neo4j'

describe('#integration-rx transaction', () => {
  let driver
  /** @type {RxSession} */
  let session
  /** @type {number} */
  let protocolVersion

  beforeEach(async () => {
    driver = neo4j.driver(
      `bolt://${sharedNeo4j.hostname}`,
      sharedNeo4j.authToken
    )
    session = driver.rxSession()

    protocolVersion = await sharedNeo4j.cleanupAndGetProtocolVersion(driver)
  })

  afterEach(async () => {
    if (session) {
      await session.close().toPromise()
    }
    await driver.close()
  })

  it('should handle nested queries within one transaction', async () => {
    const size = 1024
    if (protocolVersion < 4.0) {
      return
    }

    const messages = await session
      .beginTransaction()
      .pipe(
        mergeMap(txc =>
          txc
            .run('UNWIND RANGE(1, $size) AS x RETURN x', { size })
            .records()
            .pipe(
              map(r => r.get(0)),
              bufferCount(50),
              mergeMap(x =>
                txc
                  .run('UNWIND $x AS id CREATE (n:Node {id: id}) RETURN n.id', {
                    x
                  })
                  .records()
              ),
              map(r => r.get(0)),
              concatWith(txc.commit()),
              catchError(err => txc.rollback().pipe(concatWith(throwError(() => err)))),
              materialize(),
              toArray()
            )
        )
      )
      .toPromise()

    expect(messages.length).toBe(size + 1)
    expect(messages[size]).toEqual(Notification.createComplete())
  }, 10000)

  it('should give proper error when nesting queries within one session', async () => {
    const size = 1024
    if (protocolVersion < 4.0) {
      return
    }

    const result = await session
      .run('UNWIND RANGE(1, $size) AS x RETURN x', { size })
      .records()
      .pipe(
        map(r => r.get(0)),
        bufferCount(50),
        mergeMap(x =>
          session
            .run('UNWIND $x AS id CREATE (n:Node {id: id}) RETURN n.id', {
              x
            })
            .records()
        ),
        map(r => r.get(0)),
        materialize(),
        toArray()
      )
      .toPromise()

    expect(result).toEqual([
      Notification.createError(
        jasmine.stringMatching(
          /Queries cannot be run directly on a session with an open transaction/
        )
      )
    ])
  })
})

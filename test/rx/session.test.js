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

import { Notification, throwError } from 'rxjs'
import { map, materialize, toArray, concat } from 'rxjs/operators'
import neo4j from '../../src'
import sharedNeo4j from '../internal/shared-neo4j'
import { newError, SERVICE_UNAVAILABLE, SESSION_EXPIRED } from '../../src/error'

describe('#integration rx-session', () => {
  let originalTimeout
  let driver
  /** @type {RxSession} */
  let session
  /** @type {number} */
  let protocolVersion

  beforeEach(async () => {
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000
    driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken)
    session = driver.rxSession()

    protocolVersion = await sharedNeo4j.cleanupAndGetProtocolVersion(driver)
  })

  afterEach(async () => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout
    if (session) {
      await session.close().toPromise()
    }
    await driver.close()
  })

  it('should be able to run a simple query', async () => {
    if (protocolVersion < 4.0) {
      return
    }

    const result = await session
      .run('UNWIND [1,2,3,4] AS n RETURN n')
      .records()
      .pipe(
        map(r => r.get('n').toInt()),
        materialize(),
        toArray()
      )
      .toPromise()

    expect(result).toEqual([
      Notification.createNext(1),
      Notification.createNext(2),
      Notification.createNext(3),
      Notification.createNext(4),
      Notification.createComplete()
    ])
  })

  it('should be able to reuse session after failure', async () => {
    if (protocolVersion < 4.0) {
      return
    }

    const result1 = await session
      .run('INVALID STATEMENT')
      .records()
      .pipe(materialize(), toArray())
      .toPromise()
    expect(result1).toEqual([
      Notification.createError(jasmine.stringMatching(/Invalid input/))
    ])

    const result2 = await session
      .run('RETURN 1')
      .records()
      .pipe(
        map(r => r.get(0).toInt()),
        materialize(),
        toArray()
      )
      .toPromise()
    expect(result2).toEqual([
      Notification.createNext(1),
      Notification.createComplete()
    ])
  })

  it('should run transactions without retries', async () => {
    if (protocolVersion < 4.0) {
      return
    }

    const txcWork = new ConfigurableTransactionWork({
      query: 'CREATE (:WithoutRetry) RETURN 5'
    })

    const result = await session
      .writeTransaction(txc => txcWork.work(txc))
      .pipe(materialize(), toArray())
      .toPromise()
    expect(result).toEqual([
      Notification.createNext(5),
      Notification.createComplete()
    ])

    expect(txcWork.invocations).toBe(1)
    expect(await countNodes('WithoutRetry')).toBe(1)
  })

  it('should run transaction with retries on reactive failures', async () => {
    if (protocolVersion < 4.0) {
      return
    }

    const txcWork = new ConfigurableTransactionWork({
      query: 'CREATE (:WithReactiveFailure) RETURN 7',
      reactiveFailures: [
        newError('service unavailable', SERVICE_UNAVAILABLE),
        newError('session expired', SESSION_EXPIRED),
        newError('transient error', 'Neo.TransientError.Transaction.NotStarted')
      ]
    })

    const result = await session
      .writeTransaction(txc => txcWork.work(txc))
      .pipe(materialize(), toArray())
      .toPromise()
    expect(result).toEqual([
      Notification.createNext(7),
      Notification.createComplete()
    ])

    expect(txcWork.invocations).toBe(4)
    expect(await countNodes('WithReactiveFailure')).toBe(1)
  })

  it('should run transaction with retries on synchronous failures', async () => {
    if (protocolVersion < 4.0) {
      return
    }

    const txcWork = new ConfigurableTransactionWork({
      query: 'CREATE (:WithSyncFailure) RETURN 9',
      syncFailures: [
        newError('service unavailable', SERVICE_UNAVAILABLE),
        newError('session expired', SESSION_EXPIRED),
        newError('transient error', 'Neo.TransientError.Transaction.NotStarted')
      ]
    })

    const result = await session
      .writeTransaction(txc => txcWork.work(txc))
      .pipe(materialize(), toArray())
      .toPromise()
    expect(result).toEqual([
      Notification.createNext(9),
      Notification.createComplete()
    ])

    expect(txcWork.invocations).toBe(4)
    expect(await countNodes('WithSyncFailure')).toBe(1)
  })

  it('should fail on transactions that cannot be retried', async () => {
    if (protocolVersion < 4.0) {
      return
    }

    const txcWork = new ConfigurableTransactionWork({
      query: 'UNWIND [10, 5, 0] AS x CREATE (:Hi) RETURN 10/x'
    })

    const result = await session
      .writeTransaction(txc => txcWork.work(txc))
      .pipe(materialize(), toArray())
      .toPromise()
    expect(result).toEqual([
      Notification.createNext(1),
      Notification.createNext(2),
      Notification.createError(jasmine.stringMatching(/\/ by zero/))
    ])

    expect(txcWork.invocations).toBe(1)
    expect(await countNodes('Hi')).toBe(0)
  })

  it('should fail even after a transient error', async () => {
    if (protocolVersion < 4.0) {
      return
    }

    const txcWork = new ConfigurableTransactionWork({
      query: 'CREATE (:Person) RETURN 1',
      syncFailures: [
        newError(
          'a transient error',
          'Neo.TransientError.Transaction.NotStarted'
        )
      ],
      reactiveFailures: [
        newError('a database error', 'Neo.Database.Not.Started')
      ]
    })

    const result = await session
      .writeTransaction(txc => txcWork.work(txc))
      .pipe(materialize(), toArray())
      .toPromise()
    expect(result).toEqual([
      Notification.createError(jasmine.stringMatching(/a database error/))
    ])

    expect(txcWork.invocations).toBe(2)
    expect(await countNodes('Person')).toBe(0)
  })

  async function countNodes (label) {
    const session = driver.rxSession()
    return await session
      .run(`MATCH (n:${label}) RETURN count(n)`)
      .records()
      .pipe(
        map(r => r.get(0).toInt()),
        concat(session.close())
      )
      .toPromise()
  }
  class ConfigurableTransactionWork {
    constructor ({ query, syncFailures = [], reactiveFailures = [] } = {}) {
      this._query = query
      this._syncFailures = syncFailures
      this._syncFailuresIndex = 0
      this._reactiveFailures = reactiveFailures
      this._reactiveFailuresIndex = 0
      this._invocations = 0
    }

    get invocations () {
      return this._invocations
    }

    work (txc) {
      this._invocations++

      if (this._syncFailuresIndex < this._syncFailures.length) {
        throw this._syncFailures[this._syncFailuresIndex++]
      }

      if (this._reactiveFailuresIndex < this._reactiveFailures.length) {
        return throwError(this._reactiveFailures[this._reactiveFailuresIndex++])
      }

      return txc
        .run(this._query)
        .records()
        .pipe(map(r => r.get(0).toInt()))
    }
  }
})

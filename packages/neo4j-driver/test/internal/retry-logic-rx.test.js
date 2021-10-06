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

import { newError, error, internal } from 'neo4j-driver-core'
import RxRetryLogic from '../../src/internal/retry-logic-rx'
import { defer, throwError, of } from 'rxjs'
import { TestScheduler } from 'rxjs/testing'

const {
  logger: { Logger }
} = internal

const { SESSION_EXPIRED, SERVICE_UNAVAILABLE } = error

describe('#unit-rx retrylogic', () => {
  let scheduler
  let loggerFunc
  let logger
  let clock

  beforeEach(() => {
    scheduler = new TestScheduler(assertDeepEqualSkipFrame)
    loggerFunc = jasmine.createSpy()
    logger = new Logger('debug', loggerFunc)

    clock = jasmine.clock()
    clock.install()
    clock.mockDate(new Date())
  })

  afterEach(() => clock.uninstall())

  describe('should not retry on non-transient errors', () => {
    let scheduler

    beforeEach(() => {
      scheduler = new TestScheduler(assertDeepEqual)
    })

    it('a js error', () => {
      verifyNoRetry(new Error('a random error'))
    })

    it('a neo4j error', () => {
      verifyNoRetry(newError('a neo4j error'))
    })

    it('a transaction terminated error', () => {
      verifyNoRetry(
        newError(
          'transaction terminated',
          'Neo.TransientError.Transaction.Terminated'
        )
      )
    })

    it('a lock client stopped error', () => {
      verifyNoRetry(
        newError(
          'lock client stopped',
          'Neo.TransientError.Transaction.LockClientStopped'
        )
      )
    })

    function verifyNoRetry (error) {
      scheduler.run(helpers => {
        const retryLogic = new RxRetryLogic({ maxRetryTimeout: 5000 })
        const observable = helpers.cold('-a-b-c-#', { a: 1, b: 2, c: 3 }, error)

        helpers
          .expectObservable(retryLogic.retry(observable))
          .toBe('-a-b-c-#', { a: 1, b: 2, c: 3 }, error)
      })
    }
  })

  describe('should retry on transient errors', () => {
    it('a database unavailable error', () => {
      verifyRetry(
        newError(
          'database unavailable',
          'Neo.TransientError.Database.Unavailable'
        )
      )
    })

    it('a session expired error', () => {
      verifyRetry(newError('session expired', SESSION_EXPIRED))
    })

    it('a service unavailable error', () => {
      verifyRetry(newError('service unavailable', SERVICE_UNAVAILABLE))
    })

    it('a Neo.ClientError.Security.AuthorizationExpired error', () => {
      verifyRetry(
        newError(
          'service unavailable',
          'Neo.ClientError.Security.AuthorizationExpired'
        )
      )
    })

    function verifyRetry (error) {
      scheduler.run(helpers => {
        const retryLogic = new RxRetryLogic({ maxRetryTimeout: 5000 })
        const observable = newFailingObserver({ value: 1, errors: [error] })

        helpers
          .expectObservable(retryLogic.retry(observable))
          .toBe('-a-|', { a: 1 })
      })
    }
  })

  describe('should log retries', () => {
    it('with 1 retry', () => {
      verifyLogging(1)
    })

    it('with 2 retries', () => {
      verifyLogging(2)
    })

    it('with 5 retries', () => {
      verifyLogging(5)
    })

    function verifyLogging (errorCount) {
      scheduler.run(helpers => {
        const retryLogic = new RxRetryLogic({ maxRetryTimeout: 60000, logger })
        const observable = newFailingObserver({
          errors: sequenceOf(
            newError('session expired', SESSION_EXPIRED),
            errorCount
          ),
          value: 10
        })

        helpers
          .expectObservable(retryLogic.retry(observable))
          .toBe('-a-|', { a: 10 })
      })

      expect(loggerFunc).toHaveBeenCalledTimes(errorCount)
      expect(loggerFunc.calls.allArgs()).toEqual(
        sequenceOf(
          [
            'warn',
            jasmine.stringMatching(/^Transaction failed and will be retried in/)
          ],
          errorCount
        )
      )
    }
  })

  it('should not retry on success', () => {
    scheduler = new TestScheduler(assertDeepEqual)
    scheduler.run(helpers => {
      const retryLogic = new RxRetryLogic({ maxRetryTimeout: 5000 })
      const observable = helpers.cold('-a-|', { a: 5 })

      helpers
        .expectObservable(retryLogic.retry(observable))
        .toBe('-a-|', { a: 5 })
    })
  })

  it('should retry at least twice', () => {
    scheduler.run(helpers => {
      const retryLogic = new RxRetryLogic({ maxRetryTimeout: 2000, logger })
      const observable = newFailingObserver({
        delayBy: 2000,
        errors: [newError('session expired', SESSION_EXPIRED)],
        value: 10
      })

      helpers
        .expectObservable(retryLogic.retry(observable))
        .toBe('-a-|', { a: 10 })
    })

    expect(loggerFunc).toHaveBeenCalledTimes(1)
    expect(loggerFunc).toHaveBeenCalledWith(
      'warn',
      jasmine.stringMatching(/^Transaction failed and will be retried in/)
    )
  })

  it('should fail with service unavailable', () => {
    scheduler.run(helpers => {
      const retryLogic = new RxRetryLogic({ maxRetryTimeout: 2000, logger })
      const observable = newFailingObserver({
        delayBy: 1000,
        errors: sequenceOf(newError('session expired', SESSION_EXPIRED), 3),
        value: 15
      })

      helpers
        .expectObservable(retryLogic.retry(observable))
        .toBe(
          '-#',
          null,
          newError(
            'Failed after retried for 3 times in 2000 ms. Make sure that your database is online and retry again.',
            SERVICE_UNAVAILABLE
          )
        )
    })

    expect(loggerFunc).toHaveBeenCalledTimes(2)
    expect(loggerFunc.calls.allArgs()).toEqual(
      sequenceOf(
        [
          'warn',
          jasmine.stringMatching(/^Transaction failed and will be retried in/)
        ],
        2
      )
    )
  })

  function newFailingObserver ({ delayBy = 0, value, errors = [] } = {}) {
    let index = 0
    return defer(() => {
      if (delayBy) {
        clock.tick(delayBy)
      }
      if (index < errors.length) {
        return throwError(errors[index++])
      } else {
        return of(value)
      }
    })
  }

  function sequenceOf (obj, n) {
    return Array.from({ length: n }, _ => obj)
  }

  function assertDeepEqual (actual, expected) {
    expect(actual).toEqual(expected)
  }

  function assertDeepEqualSkipFrame (actual, expected) {
    expect(actual.length).toBeDefined()
    expect(expected.length).toBeDefined()

    expect(actual.map(m => m.notification)).toEqual(
      expected.map(m => m.notification)
    )
  }
})

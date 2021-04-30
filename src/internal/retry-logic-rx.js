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
import { Observable, throwError, of } from 'rxjs'
import { retryWhen, flatMap, delay } from 'rxjs/operators'

const {
  logger: {
    // eslint-disable-next-line no-unused-vars
    Logger
  },
  retryStrategy: { canRetryOn }
} = internal

const { SERVICE_UNAVAILABLE, SESSION_EXPIRED } = error
const DEFAULT_MAX_RETRY_TIME_MS = 30 * 1000 // 30 seconds
const DEFAULT_INITIAL_RETRY_DELAY_MS = 1000 // 1 seconds
const DEFAULT_RETRY_DELAY_MULTIPLIER = 2.0
const DEFAULT_RETRY_DELAY_JITTER_FACTOR = 0.2

export default class RxRetryLogic {
  /**
   *
   * @param {Object} args
   * @param {Logger} args.logger
   */
  constructor ({
    maxRetryTimeout = DEFAULT_MAX_RETRY_TIME_MS,
    initialDelay = DEFAULT_INITIAL_RETRY_DELAY_MS,
    delayMultiplier = DEFAULT_RETRY_DELAY_MULTIPLIER,
    delayJitter = DEFAULT_RETRY_DELAY_JITTER_FACTOR,
    logger = null
  } = {}) {
    this._maxRetryTimeout = valueOrDefault(
      maxRetryTimeout,
      DEFAULT_MAX_RETRY_TIME_MS
    )
    this._initialDelay = valueOrDefault(
      initialDelay,
      DEFAULT_INITIAL_RETRY_DELAY_MS
    )
    this._delayMultiplier = valueOrDefault(
      delayMultiplier,
      DEFAULT_RETRY_DELAY_MULTIPLIER
    )
    this._delayJitter = valueOrDefault(
      delayJitter,
      DEFAULT_RETRY_DELAY_JITTER_FACTOR
    )
    this._logger = logger
  }

  /**
   *
   * @param {Observable<Any>} work
   */
  retry (work) {
    return work.pipe(
      retryWhen(failedWork => {
        const handledExceptions = []
        const startTime = Date.now()
        let retryCount = 1
        let delayDuration = this._initialDelay

        return failedWork.pipe(
          flatMap(err => {
            if (!canRetryOn(err)) {
              return throwError(err)
            }

            handledExceptions.push(err)

            if (
              retryCount >= 2 &&
              Date.now() - startTime >= this._maxRetryTimeout
            ) {
              const error = newError(
                `Failed after retried for ${retryCount} times in ${this._maxRetryTimeout} ms. Make sure that your database is online and retry again.`,
                SERVICE_UNAVAILABLE
              )

              error.seenErrors = handledExceptions

              return throwError(error)
            }

            const nextDelayDuration = this._computeNextDelay(delayDuration)
            delayDuration = delayDuration * this._delayMultiplier
            retryCount++
            if (this._logger) {
              this._logger.warn(
                `Transaction failed and will be retried in ${nextDelayDuration}`
              )
            }
            return of(1).pipe(delay(nextDelayDuration))
          })
        )
      })
    )
  }

  _computeNextDelay (delay) {
    const jitter = delay * this._delayJitter
    return delay - jitter + 2 * jitter * Math.random()
  }
}

function valueOrDefault (value, defaultValue) {
  if (value || value === 0) {
    return value
  }
  return defaultValue
}

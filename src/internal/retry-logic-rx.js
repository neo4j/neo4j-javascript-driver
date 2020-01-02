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

import { newError, SERVICE_UNAVAILABLE, SESSION_EXPIRED } from '../error'
import { Observable, throwError, of } from 'rxjs'
import { retryWhen, flatMap, delay } from 'rxjs/operators'
import Logger from './logger'

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
            if (!RxRetryLogic._canRetryOn(err)) {
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

  static _canRetryOn (error) {
    return (
      error &&
      error.code &&
      (error.code === SERVICE_UNAVAILABLE ||
        error.code === SESSION_EXPIRED ||
        this._isTransientError(error))
    )
  }

  static _isTransientError (error) {
    // Retries should not happen when transaction was explicitly terminated by the user.
    // Termination of transaction might result in two different error codes depending on where it was
    // terminated. These are really client errors but classification on the server is not entirely correct and
    // they are classified as transient.

    const code = error.code
    if (code.indexOf('TransientError') >= 0) {
      if (
        code === 'Neo.TransientError.Transaction.Terminated' ||
        code === 'Neo.TransientError.Transaction.LockClientStopped'
      ) {
        return false
      }
      return true
    }
    return false
  }
}

function valueOrDefault (value, defaultValue) {
  if (value || value === 0) {
    return value
  }
  return defaultValue
}

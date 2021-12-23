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

import { newError } from '../error'
import Transaction from '../transaction'
import { canRetryOn } from './retry-strategy'

const DEFAULT_MAX_RETRY_TIME_MS = 30 * 1000 // 30 seconds
const DEFAULT_INITIAL_RETRY_DELAY_MS = 1000 // 1 seconds
const DEFAULT_RETRY_DELAY_MULTIPLIER = 2.0
const DEFAULT_RETRY_DELAY_JITTER_FACTOR = 0.2

type TransactionCreator = () => Transaction
type TransactionWork<T> = (tx: Transaction) => T | Promise<T>
type Resolve<T> = (value: T | PromiseLike<T>) => void
type Reject = (value: any) => void
type Timeout = ReturnType<typeof setTimeout>

export class TransactionExecutor {
  private _maxRetryTimeMs: number
  private _initialRetryDelayMs: number
  private _multiplier: number
  private _jitterFactor: number
  private _inFlightTimeoutIds: Timeout[]

  constructor(
    maxRetryTimeMs?: number | null,
    initialRetryDelayMs?: number,
    multiplier?: number,
    jitterFactor?: number
  ) {
    this._maxRetryTimeMs = _valueOrDefault(
      maxRetryTimeMs,
      DEFAULT_MAX_RETRY_TIME_MS
    )
    this._initialRetryDelayMs = _valueOrDefault(
      initialRetryDelayMs,
      DEFAULT_INITIAL_RETRY_DELAY_MS
    )
    this._multiplier = _valueOrDefault(
      multiplier,
      DEFAULT_RETRY_DELAY_MULTIPLIER
    )
    this._jitterFactor = _valueOrDefault(
      jitterFactor,
      DEFAULT_RETRY_DELAY_JITTER_FACTOR
    )

    this._inFlightTimeoutIds = []

    this._verifyAfterConstruction()
  }

  execute<T>(
    transactionCreator: TransactionCreator,
    transactionWork: TransactionWork<T>
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this._executeTransactionInsidePromise(
        transactionCreator,
        transactionWork,
        resolve,
        reject
      )
    }).catch(error => {
      const retryStartTimeMs = Date.now()
      const retryDelayMs = this._initialRetryDelayMs
      return this._retryTransactionPromise(
        transactionCreator,
        transactionWork,
        error,
        retryStartTimeMs,
        retryDelayMs
      )
    })
  }

  close() {
    // cancel all existing timeouts to prevent further retries
    this._inFlightTimeoutIds.forEach(timeoutId => clearTimeout(timeoutId))
    this._inFlightTimeoutIds = []
  }

  _retryTransactionPromise<T>(
    transactionCreator: TransactionCreator,
    transactionWork: TransactionWork<T>,
    error: Error,
    retryStartTime: number,
    retryDelayMs: number
  ): Promise<T> {
    const elapsedTimeMs = Date.now() - retryStartTime

    if (elapsedTimeMs > this._maxRetryTimeMs || !canRetryOn(error)) {
      return Promise.reject(error)
    }

    return new Promise<T>((resolve, reject) => {
      const nextRetryTime = this._computeDelayWithJitter(retryDelayMs)
      const timeoutId = setTimeout(() => {
        // filter out this timeoutId when time has come and function is being executed
        this._inFlightTimeoutIds = this._inFlightTimeoutIds.filter(
          id => id !== timeoutId
        )
        this._executeTransactionInsidePromise(
          transactionCreator,
          transactionWork,
          resolve,
          reject
        )
      }, nextRetryTime)
      // add newly created timeoutId to the list of all in-flight timeouts
      this._inFlightTimeoutIds.push(timeoutId)
    }).catch(error => {
      const nextRetryDelayMs = retryDelayMs * this._multiplier
      return this._retryTransactionPromise(
        transactionCreator,
        transactionWork,
        error,
        retryStartTime,
        nextRetryDelayMs
      )
    })
  }

  _executeTransactionInsidePromise<T>(
    transactionCreator: TransactionCreator,
    transactionWork: TransactionWork<T>,
    resolve: Resolve<T>,
    reject: Reject
  ): void {
    let tx: Transaction
    try {
      tx = transactionCreator()
    } catch (error) {
      // failed to create a transaction
      reject(error)
      return
    }

    const resultPromise = this._safeExecuteTransactionWork(tx, transactionWork)

    resultPromise
      .then(result =>
        this._handleTransactionWorkSuccess(result, tx, resolve, reject)
      )
      .catch(error => this._handleTransactionWorkFailure(error, tx, reject))
  }

  _safeExecuteTransactionWork<T>(
    tx: Transaction,
    transactionWork: TransactionWork<T>
  ): Promise<T> {
    try {
      const result = transactionWork(tx)
      // user defined callback is supposed to return a promise, but it might not; so to protect against an
      // incorrect API usage we wrap the returned value with a resolved promise; this is effectively a
      // validation step without type checks
      return Promise.resolve(result)
    } catch (error) {
      return Promise.reject(error)
    }
  }

  _handleTransactionWorkSuccess<T>(
    result: T,
    tx: Transaction,
    resolve: Resolve<T>,
    reject: Reject
  ) {
    if (tx.isOpen()) {
      // transaction work returned resolved promise and transaction has not been committed/rolled back
      // try to commit the transaction
      tx.commit()
        .then(() => {
          // transaction was committed, return result to the user
          resolve(result)
        })
        .catch(error => {
          // transaction failed to commit, propagate the failure
          reject(error)
        })
    } else {
      // transaction work returned resolved promise and transaction is already committed/rolled back
      // return the result returned by given transaction work
      resolve(result)
    }
  }

  _handleTransactionWorkFailure(error: any, tx: Transaction, reject: Reject) {
    if (tx.isOpen()) {
      // transaction work failed and the transaction is still open, roll it back and propagate the failure
      tx.rollback()
        .catch(ignore => {
          // ignore the rollback error
        })
        .then(() => reject(error)) // propagate the original error we got from the transaction work
    } else {
      // transaction is already rolled back, propagate the error
      reject(error)
    }
  }

  _computeDelayWithJitter(delayMs: number): number {
    const jitter = delayMs * this._jitterFactor
    const min = delayMs - jitter
    const max = delayMs + jitter
    return Math.random() * (max - min) + min
  }

  _verifyAfterConstruction() {
    if (this._maxRetryTimeMs < 0) {
      throw newError('Max retry time should be >= 0: ' + this._maxRetryTimeMs)
    }
    if (this._initialRetryDelayMs < 0) {
      throw newError(
        'Initial retry delay should >= 0: ' + this._initialRetryDelayMs
      )
    }
    if (this._multiplier < 1.0) {
      throw newError('Multiplier should be >= 1.0: ' + this._multiplier)
    }
    if (this._jitterFactor < 0 || this._jitterFactor > 1) {
      throw newError(
        'Jitter factor should be in [0.0, 1.0]: ' + this._jitterFactor
      )
    }
  }
}

function _valueOrDefault(
  value: number | undefined | null,
  defaultValue: number
): number {
  if (value || value === 0) {
    return value
  }
  return defaultValue
}

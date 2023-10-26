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
import { defer, Observable, of, throwError } from 'rxjs'
import { mergeMap, catchError, concatWith } from 'rxjs/operators'
import RxResult from './result-rx'
// eslint-disable-next-line no-unused-vars
import { Session, internal } from 'neo4j-driver-core'
import RxTransaction from './transaction-rx'
import RxManagedTransaction from './transaction-managed-rx'
import RxRetryLogic from './internal/retry-logic-rx'

const {
  constants: { ACCESS_MODE_READ, ACCESS_MODE_WRITE, TELEMETRY_APIS },
  txConfig: { TxConfig }
} = internal

/**
 * A Reactive session, which provides the same functionality as {@link Session} but through a Reactive API.
 */
export default class RxSession {
  /**
   * Constructs a reactive session with given default session instance and provided driver configuration.
   *
   * @protected
   * @param {Object} param - Object parameter
   * @param {Session} param.session - The underlying session instance to relay requests
   */
  constructor ({ session, config, log } = {}) {
    this._session = session
    this._retryLogic = _createRetryLogic(config)
    this._log = log
  }

  /**
   * Creates a reactive result that will execute the  query with the provided parameters and the provided
   * transaction configuration that applies to the underlying auto-commit transaction.
   *
   * @public
   * @param {string} query - Query to be executed.
   * @param {Object} parameters - Parameter values to use in query execution.
   * @param {TransactionConfig} transactionConfig - Configuration for the new auto-commit transaction.
   * @returns {RxResult} - A reactive result
   */
  run (query, parameters, transactionConfig) {
    return new RxResult(
      new Observable(observer => {
        try {
          observer.next(this._session.run(query, parameters, transactionConfig))
          observer.complete()
        } catch (err) {
          observer.error(err)
        }

        return () => {}
      })
    )
  }

  /**
   * Starts a new explicit transaction with the provided transaction configuration.
   *
   * @public
   * @param {TransactionConfig} transactionConfig - Configuration for the new transaction.
   * @returns {Observable<RxTransaction>} - A reactive stream that will generate at most **one** RxTransaction instance.
   */
  beginTransaction (transactionConfig) {
    return this._beginTransaction(this._session._mode, transactionConfig, { api: TELEMETRY_APIS.UNMANAGED_TRANSACTION })
  }

  /**
   * Executes the provided unit of work in a {@link READ} reactive transaction which is created with the provided
   * transaction configuration.
   * @public
   * @deprecated This method will be removed in version 6.0. Please, use {@link RxSession#executeRead} instead.
   * @param {function(txc: RxTransaction): Observable} work - A unit of work to be executed.
   * @param {TransactionConfig} transactionConfig - Configuration for the enclosing transaction created by the driver.
   * @returns {Observable} - A reactive stream returned by the unit of work.
   */
  readTransaction (work, transactionConfig) {
    return this._runTransaction(ACCESS_MODE_READ, work, transactionConfig)
  }

  /**
   * Executes the provided unit of work in a {@link WRITE} reactive transaction which is created with the provided
   * transaction configuration.
   * @public
   * @deprecated This method will be removed in version 6.0. Please, use {@link RxSession#executeWrite} instead.
   * @param {function(txc: RxTransaction): Observable} work - A unit of work to be executed.
   * @param {TransactionConfig} transactionConfig - Configuration for the enclosing transaction created by the driver.
   * @returns {Observable} - A reactive stream returned by the unit of work.
   */
  writeTransaction (work, transactionConfig) {
    return this._runTransaction(ACCESS_MODE_WRITE, work, transactionConfig)
  }

  /**
   * Executes the provided unit of work in a {@link READ} reactive transaction which is created with the provided
   * transaction configuration.
   * @public
   * @param {function(txc: RxManagedTransaction): Observable} work - A unit of work to be executed.
   * @param {TransactionConfig} transactionConfig - Configuration for the enclosing transaction created by the driver.
   * @returns {Observable} - A reactive stream returned by the unit of work.
   */
  executeRead (work, transactionConfig) {
    return this._executeInTransaction(ACCESS_MODE_READ, work, transactionConfig)
  }

  /**
   * Executes the provided unit of work in a {@link WRITE} reactive transaction which is created with the provided
   * transaction configuration.
   * @public
   * @param {function(txc: RxManagedTransaction): Observable} work - A unit of work to be executed.
   * @param {TransactionConfig} transactionConfig - Configuration for the enclosing transaction created by the driver.
   * @returns {Observable} - A reactive stream returned by the unit of work.
   */
  executeWrite (work, transactionConfig) {
    return this._executeInTransaction(ACCESS_MODE_WRITE, work, transactionConfig)
  }

  /**
   * @private
   * @param {function(txc: RxManagedTransaction): Observable} work
   * @param {TransactionConfig} transactionConfig
   * @returns {Observable}
   */
  _executeInTransaction (accessMode, work, transactionConfig) {
    const wrapper = txc => new RxManagedTransaction({
      run: txc.run.bind(txc)
    })
    return this._runTransaction(accessMode, work, transactionConfig, wrapper)
  }

  /**
   * Closes this reactive session.
   *
   * @public
   * @returns {Observable} - An empty reactive stream
   */
  close () {
    return new Observable(observer => {
      this._session
        .close()
        .then(() => {
          observer.complete()
        })
        .catch(err => observer.error(err))
    })
  }

  [Symbol.asyncDispose] () {
    return this.close()
  }

  /**
   * Returns the bookmarks received following the last successfully completed query, which is executed
   * either in an {@link RxTransaction} obtained from this session instance or directly through one of
   * the {@link RxSession#run} method of this session instance.
   *
   * If no bookmarks were received or if this transaction was rolled back, the bookmarks value will not be
   * changed.
   *
   * @deprecated This method will be removed in 6.0 version. Please, use {@link RxSession#lastBookmarks} instead.
   *
   * @public
   * @returns {string[]}
   */
  lastBookmark () {
    return this.lastBookmarks()
  }

  /**
   * Returns the bookmarks received following the last successfully completed query, which is executed
   * either in an {@link RxTransaction} obtained from this session instance or directly through one of
   * the {@link RxSession#run} method of this session instance.
   *
   * If no bookmarks were received or if this transaction was rolled back, the bookmarks value will not be
   * changed.
   *
   * @public
   * @returns {string[]}
   */
  lastBookmarks () {
    return this._session.lastBookmarks()
  }

  /**
   * @private
   */
  _beginTransaction (accessMode, transactionConfig, apiTelemetryConfig) {
    let txConfig = TxConfig.empty()
    if (transactionConfig) {
      txConfig = new TxConfig(transactionConfig, this._log)
    }

    return new Observable(observer => {
      try {
        this._session._beginTransaction(accessMode, txConfig, apiTelemetryConfig)
          .then(tx => {
            observer.next(
              new RxTransaction(tx)
            )
            observer.complete()
          })
          .catch(err => observer.error(err))
      } catch (err) {
        observer.error(err)
      }

      return () => {}
    })
  }

  /**
   * @private
   */
  _runTransaction (accessMode, work, transactionConfig, transactionWrapper = (tx) => tx) {
    let txConfig = TxConfig.empty()
    if (transactionConfig) {
      txConfig = new TxConfig(transactionConfig)
    }

    const context = {
      apiTelemetryConfig: {
        api: TELEMETRY_APIS.MANAGED_TRANSACTION,
        onTelemetrySuccess: () => {
          context.apiTelemetryConfig = undefined
        }
      }
    }

    return this._retryLogic.retry(
      of(1).pipe(
        mergeMap(() => this._beginTransaction(accessMode, txConfig, context.apiTelemetryConfig)),
        mergeMap(txc =>
          defer(() => {
            try {
              return work(transactionWrapper(txc))
            } catch (err) {
              return throwError(() => err)
            }
          }).pipe(
            catchError(err => txc.rollback().pipe(concatWith(throwError(() => err)))),
            concatWith(txc.commit())
          )
        )
      )
    )
  }
}

function _createRetryLogic (config) {
  const maxRetryTimeout =
    config && config.maxTransactionRetryTime
      ? config.maxTransactionRetryTime
      : null
  return new RxRetryLogic({ maxRetryTimeout })
}

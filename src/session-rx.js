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
import { defer, Observable, throwError } from 'rxjs'
import { map, flatMap, catchError, concat } from 'rxjs/operators'
import { newError } from './error'
import RxResult from './result-rx'
import Session from './session'
import RxTransaction from './transaction-rx'
import { ACCESS_MODE_READ, ACCESS_MODE_WRITE } from './internal/constants'
import TxConfig from './internal/tx-config'
import RxRetryLogic from './internal/retry-logic-rx'

export default class RxSession {
  /**
   * @param {Session} session
   */
  constructor ({ session, config } = {}) {
    this._session = session
    this._retryLogic = _createRetryLogic(config)
  }

  run (statement, parameters, transactionConfig) {
    return new RxResult(
      new Observable(observer => {
        try {
          observer.next(
            this._session.run(statement, parameters, transactionConfig)
          )
          observer.complete()
        } catch (err) {
          observer.error(err)
        }

        return () => {}
      })
    )
  }

  beginTransaction (transactionConfig) {
    return this._beginTransaction(this._session._mode, transactionConfig)
  }

  _beginTransaction (accessMode, transactionConfig) {
    let txConfig = TxConfig.empty()
    if (transactionConfig) {
      txConfig = new TxConfig(transactionConfig)
    }

    return new Observable(observer => {
      try {
        observer.next(
          new RxTransaction(
            this._session._beginTransaction(accessMode, txConfig)
          )
        )
        observer.complete()
      } catch (err) {
        observer.error(err)
      }

      return () => {}
    })
  }

  readTransaction (transactionWork, transactionConfig) {
    return this._runTransaction(
      ACCESS_MODE_READ,
      transactionWork,
      transactionConfig
    )
  }

  writeTransaction (transactionWork, transactionConfig) {
    return this._runTransaction(
      ACCESS_MODE_WRITE,
      transactionWork,
      transactionConfig
    )
  }

  _runTransaction (accessMode, transactionWork, transactionConfig) {
    let txConfig = TxConfig.empty()
    if (transactionConfig) {
      txConfig = new TxConfig(transactionConfig)
    }

    return this._retryLogic.retry(
      this._beginTransaction(accessMode, transactionConfig).pipe(
        flatMap(txc =>
          defer(() => {
            try {
              return transactionWork(txc)
            } catch (err) {
              return throwError(err)
            }
          }).pipe(
            catchError(err => txc.rollback().pipe(concat(throwError(err)))),
            concat(txc.commit())
          )
        )
      )
    )
  }

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

  lastBookmark () {
    return this._session.lastBookmark()
  }
}

function _createRetryLogic (config) {
  const maxRetryTimeout =
    config && config.maxTransactionRetryTime
      ? config.maxTransactionRetryTime
      : null
  return new RxRetryLogic({ maxRetryTimeout })
}

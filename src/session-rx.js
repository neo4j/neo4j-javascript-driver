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
import { defer, Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { newError } from './error'
import RxResult from './result-rx'
import Session from './session'
import RxTransaction from './transaction-rx'

export default class RxSession {
  /**
   * @param {Session} session
   */
  constructor (session) {
    this._session = session
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
    return new Observable(observer => {
      try {
        observer.next(
          new RxTransaction(this._session.beginTransaction(transactionConfig))
        )
        observer.complete()
      } catch (err) {
        observer.error(err)
      }

      return () => {}
    })
  }

  readTransaction (transactionWork, transactionConfig) {
    throw newError('not implemented')
  }

  writeTransaction (transactionWork, transactionConfig) {
    throw newError('not implemented')
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

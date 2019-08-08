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
import { newError } from './error'
import { Observable, from } from 'rxjs'
import Transaction from './transaction'
import RxResult from './result-rx'

export default class RxTransaction {
  /**
   *
   * @param {Transaction} txc
   */
  constructor (txc) {
    this._txc = txc
  }

  run (statement, parameters) {
    return new RxResult(
      new Observable(observer => {
        try {
          observer.next(this._txc.run(statement, parameters))
          observer.complete()
        } catch (err) {
          observer.error(err)
        }

        return () => {}
      })
    )
  }

  commit () {
    return new Observable(observer => {
      this._txc
        .commit()
        .then(() => {
          observer.complete()
        })
        .catch(err => observer.error(err))
    })
  }

  rollback () {
    return new Observable(observer => {
      this._txc
        .rollback()
        .then(() => {
          observer.complete()
        })
        .catch(err => observer.error(err))
    })
  }
}

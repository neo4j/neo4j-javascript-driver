/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [https://neo4j.com]
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
import { Observable } from 'rxjs'
import RxResult from './result-rx'
// eslint-disable-next-line no-unused-vars
import Transaction from 'neo4j-driver-core'

/**
 * A reactive transaction, which provides the same functionality as {@link Transaction} but through a Reactive API.
 */
export default class RxTransaction {
  /**
   * @constructor
   * @protected
   * @param {Transaction} txc - The underlying transaction instance to relay requests
   */
  constructor (txc) {
    this._txc = txc
  }

  /**
   * Creates a reactive result that will execute the query in this transaction, with the provided parameters.
   *
   * @public
   * @param {string} query - Query to be executed.
   * @param {Object} parameters - Parameter values to use in query execution.
   * @returns {RxResult} - A reactive result
   */
  run (query, parameters) {
    return new RxResult(
      new Observable(observer => {
        try {
          observer.next(this._txc.run(query, parameters))
          observer.complete()
        } catch (err) {
          observer.error(err)
        }

        return () => {}
      })
    )
  }

  /**
   *  Commits the transaction.
   *
   * @public
   * @returns {Observable} - An empty observable
   */
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

  /**
   *  Rolls back the transaction.
   *
   * @public
   * @returns {Observable} - An empty observable
   */
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

  /**
   * Check if this transaction is active, which means commit and rollback did not happen.
   * @return {boolean} `true` when not committed and not rolled back, `false` otherwise.
   */
  isOpen () {
    return this._txc.isOpen()
  }

  /**
   * Closes the transaction
   *
   * This method will roll back the transaction if it is not already committed or rolled back.
   *
   * @returns {Observable} - An empty observable
   */
  close () {
    return new Observable(observer => {
      this._txc
        .close()
        .then(() => {
          observer.complete()
        })
        .catch(err => observer.error(err))
    })
  }
}

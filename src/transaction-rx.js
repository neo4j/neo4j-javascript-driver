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
import { defer, from, Observable } from 'rxjs'
import RxResult from './result-rx'
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
    return new RxResult(defer(() => [this._txc.run(query, parameters)]))
  }

  /**
   *  Commits the transaction.
   *
   * @public
   * @returns {Observable<void>} - An empty observable
   */
  commit () {
    return from(this._txc.commit())
  }

  /**
   *  Rolls back the transaction.
   *
   * @public
   * @returns {Observable<void>} - An empty observable
   */
  rollback () {
    return from(this._txc.rollback())
  }
}

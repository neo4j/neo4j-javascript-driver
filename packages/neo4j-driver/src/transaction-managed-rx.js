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

/**
 * Represents a rx transaction that is managed by the transaction executor.
 * 
 * @public
 */
class RxManagedTransaction {
  constructor({ run, isOpen }) {
    this._run = run
    this._isOpen = isOpen
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
     return this._run(query, parameters)
   }

   /**
   * Check if this transaction is active, which means commit and rollback did not happen.
   * @return {boolean} `true` when not committed and not rolled back, `false` otherwise.
   */
    isOpen() {
      return this._isOpen()
    }
}

export default RxManagedTransaction

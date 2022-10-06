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

import Result from './result.ts'
import Transaction from './transaction.ts'
import { Query } from './types.ts'

type Run = (query: Query, parameters?: any) => Result

/**
 * Represents a transaction that is managed by the transaction executor.
 *
 * @public
 */
class ManagedTransaction {
  private readonly _run: Run

  /**
   * @private
   */
  private constructor ({ run }: { run: Run }) {
    /**
     * @private
     */
    this._run = run
  }

  /**
   * @private
   * @param {Transaction} tx - Transaction to wrap
   * @returns {ManagedTransaction} the ManagedTransaction
   */
  static fromTransaction (tx: Transaction): ManagedTransaction {
    return new ManagedTransaction({
      run: tx.run.bind(tx)
    })
  }

  /**
   * Run Cypher query
   * Could be called with a query object i.e.: `{text: "MATCH ...", parameters: {param: 1}}`
   * or with the query and parameters as separate arguments.
   * @param {mixed} query - Cypher query to execute
   * @param {Object} parameters - Map with parameters to use in query
   * @return {Result} New Result
   */
  run (query: Query, parameters?: any): Result {
    return this._run(query, parameters)
  }
}

export default ManagedTransaction

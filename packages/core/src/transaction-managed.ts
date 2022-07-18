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

import { EagerQueryRunner } from './query-runner'
import Result, { QueryResult } from './result'
import Transaction from './transaction'
import { Query } from './types'

type RunMethod = (query: Query, parameters?: any) => Result
type QueryMethod = (query: Query, parameters?: any) => Promise<QueryResult>

/**
 * Represents a transaction that is managed by the transaction executor.
 *
 * @public
 */
class ManagedTransaction implements EagerQueryRunner {
  private readonly _run: RunMethod
  private readonly _query: QueryRun

  /**
   * @private
   */
  private constructor ({ run, query }: { run: RunMethod, query: QueryMethod }) {
    /**
     * @private
     */
    this._run = run
    /**
     * @private
     */
    this._query = query
  }

  /**
   * @private
   * @param {Transaction} tx - Transaction to wrap
   * @returns {ManagedTransaction} the ManagedTransaction
   */
  static fromTransaction (tx: Transaction): ManagedTransaction {
    return new ManagedTransaction({
      run: tx.run.bind(tx),
      query: tx.query.bind(tx)
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

  /**
   * @todo doc
   * @param query
   * @param parameters
   * @returns
   */
  async query (query: Query, parameters?: any): Promise<QueryResult> {
    return this._query(query, parameters)
  }
}

export default ManagedTransaction

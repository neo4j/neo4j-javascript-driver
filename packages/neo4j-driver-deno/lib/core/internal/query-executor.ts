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

import BookmarkManager from '../bookmark-manager.ts'
import Session from '../session.ts'
import Result from '../result.ts'
import ManagedTransaction from '../transaction-managed.ts'
import { Query } from '../types.ts'
import { TELEMETRY_APIS } from './constants.ts'

type SessionFactory = (config: { database?: string, bookmarkManager?: BookmarkManager, impersonatedUser?: string }) => Session

type TransactionFunction<T> = (transactionWork: (tx: ManagedTransaction) => Promise<T>) => Promise<T>

interface ExecutionConfig<T> {
  routing: 'WRITE' | 'READ'
  database?: string
  impersonatedUser?: string
  bookmarkManager?: BookmarkManager
  resultTransformer: (result: Result) => Promise<T>
}

export default class QueryExecutor {
  constructor (private readonly _createSession: SessionFactory) {

  }

  public async execute<T>(config: ExecutionConfig<T>, query: Query, parameters?: any): Promise<T> {
    const session = this._createSession({
      database: config.database,
      bookmarkManager: config.bookmarkManager,
      impersonatedUser: config.impersonatedUser
    })

    // @ts-expect-error The method is private for external users
    session._configureTransactionExecutor(true, TELEMETRY_APIS.EXECUTE_QUERY)

    try {
      const executeInTransaction: TransactionFunction<T> = config.routing === 'READ'
        ? session.executeRead.bind(session)
        : session.executeWrite.bind(session)

      return await executeInTransaction(async (tx: ManagedTransaction) => {
        const result = tx.run(query, parameters)
        return await config.resultTransformer(result)
      })
    } finally {
      await session.close()
    }
  }
}

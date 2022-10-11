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

import BookmarkManager from '../bookmark-manager'
import Session from '../session'
import Result from '../result'
import ManagedTransaction from '../transaction-managed'
import { Query } from '../types'

type SessionFactory = (config: { database?: string, bookmarkManager?: BookmarkManager, impersonatedUser?: string }) => Session
interface ExecutionConfig<T> {
  routing: 'WRITERS' | 'READERS'
  database?: string
  impersonatedUser?: string
  bookmarkManager?: BookmarkManager
  resultTransformer: (result: Result) => Promise<T>
}

export default class QueryExecutor {
  constructor (private readonly _createSession: SessionFactory) {

  }

  public async execute<T> (config: ExecutionConfig<T>, query: Query, parameters?: any): Promise<T> {
    const session = this._createSession({
      database: config.database,
      bookmarkManager: config.bookmarkManager,
      impersonatedUser: config.impersonatedUser
    })
    try {
      const execute = config.routing === 'READERS'
        ? session.executeRead.bind(session)
        : session.executeWrite.bind(session)

      return execute(async (tx: ManagedTransaction) => {
        const result = tx.run(query, parameters)
        return await config.resultTransformer(result)
      })
    } finally {
      await session.close()
    }
  }
}

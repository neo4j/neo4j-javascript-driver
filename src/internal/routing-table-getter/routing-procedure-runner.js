/**
 * Copyright (c) 2002-2020 "Neo4j,"
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
import Result from '../../result'
import TxConfig from '../tx-config'

export default class RoutingProcedureRunner {
  /**
   * @param {Connection} connection the connection
   * @param {string} database the database
   * @param {object} routerContext the router context
   * @param {Session} session the session which was used to get the connection,
   *                 it will be used to get lastBookmark and other properties
   *
   * @returns {Result} the result of the query
   */
  run (connection, database, routerContext, session) {
    throw new Error('not implemented')
  }

  /**
   * Run query using the connection
   * @param {Connection} connection the connectiom
   * @param {string} query the query
   * @param {object} params the query params
   * @param {Session} session the session which was used to get the connection,
   *                 it will be used to get lastBookmark and other properties
   *
   * @returns {Result} the result of the query
   */
  _runQuery (connection, query, params, session) {
    const resultOberserver = connection.protocol().run(query, params, {
      bookmark: session._lastBookmark,
      txConfig: TxConfig.empty(),
      mode: session._mode,
      database: session._database,
      afterComplete: session._onComplete
    })
    return new Result(Promise.resolve(resultOberserver))
  }
}

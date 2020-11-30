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
import RoutingProcedureRunner from './routing-procedure-runner'

const CONTEXT = 'context'
const DATABASE = 'database'
const CALL_GET_ROUTING_TABLE_MULTI_DB = `CALL dbms.routing.getRoutingTable($${CONTEXT}, $${DATABASE})`

/**
 * Runs the Multi-Database procedure to get the Routing Table
 */
export default class MultiDatabaseRoutingProcedureRunner extends RoutingProcedureRunner {
  constructor (initialAddress) {
    super()
    this._initialAddress = initialAddress
  }

  /**
   * Run the procedure
   *
   * @param {Connection} connection The connection use
   * @param {string} database the database
   * @param {string} routerAddress the router address
   * @param {Session} session the session which was used to get the connection,
   *                 it will be used to get lastBookmark and other properties
   *
   * @returns {Result} the result of the query
   */
  run (connection, database, context, session) {
    return this._runQuery(
      connection,
      CALL_GET_ROUTING_TABLE_MULTI_DB,
      {
        context: {
          ...context,
          address: this._initialAddress
        },
        database: database || null
      },
      session
    )
  }
}

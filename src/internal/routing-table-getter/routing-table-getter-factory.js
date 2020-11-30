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
import { BOLT_PROTOCOL_V4_0 } from '../constants'
import Connection from '../connection'
import ProcedureRoutingTableGetter from './routing-table-getter-procedure'
import SingleDatabaseRoutingProcedureRunner from './routing-procedure-runner-single-database'
import MultiDatabaseRoutingProcedureRunner from './routing-procedure-runner-multi-database'

/**
 * Constructs the RoutingTableGetter according to the correct protocol version.
 */
export default class RoutingTableGetterFactory {
  /**
   * Constructor
   * @param {Object} routingContext Context which the be used to define the routing table
   * @param {string} initialAddress The address that the driver is connecting to,
   *                                used by routing as a fallback when routing and clustering isn't configured.
   */
  constructor (routingContext, initialAddress) {
    this._routingContext = routingContext
    this._initialAddress = initialAddress
  }

  /**
   * Creates the RoutingTableGetter using the given session and database
   *
   * @param {Connection} connection the connection to use
   * @param {string} database the database name
   * @param {string} routerAddress the URL of the router.
   * @returns {ProcedureRoutingTableGetter} The routing table getter
   */
  create (connection) {
    const runner =
      connection.protocol().version < BOLT_PROTOCOL_V4_0
        ? new SingleDatabaseRoutingProcedureRunner()
        : new MultiDatabaseRoutingProcedureRunner(this._initialAddress)

    return new ProcedureRoutingTableGetter(this._routingContext, runner)
  }
}

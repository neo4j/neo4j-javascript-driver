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
import RoutingTable from './routing-table'
import Session from '../session'
import { RoutingTableGetterFactory } from './routing-table-getter'
import ServerAddress from './server-address'

export default class Rediscovery {
  /**
   * @constructor
   * @param {RoutingTableGetterFactory} routingTableGetterFactory the util to use.
   */
  constructor (routingTableGetterFactory) {
    this._routingTableGetterFactory = routingTableGetterFactory
  }

  /**
   * Try to fetch new routing table from the given router.
   * @param {Session} session the session to use.
   * @param {string} database the database for which to lookup routing table.
   * @param {ServerAddress} routerAddress the URL of the router.
   * @return {Promise<RoutingTable>} promise resolved with new routing table or null when connection error happened.
   */
  lookupRoutingTableOnRouter (session, database, routerAddress) {
    return session._acquireConnection(connection => {
      const routingTableGetter = this._routingTableGetterFactory.create(
        connection
      )
      return routingTableGetter.get(
        connection,
        database,
        routerAddress,
        session
      )
    })
  }
}

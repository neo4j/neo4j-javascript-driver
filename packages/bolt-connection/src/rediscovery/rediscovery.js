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
import RoutingTable from './routing-table'

export default class Rediscovery {
  /**
   * @constructor
   * @param {object} routingContext
   */
  constructor (routingContext) {
    this._routingContext = routingContext
  }

  /**
   * Try to fetch new routing table from the given router.
   * @param {Connection} connection the session to use.
   * @param {string} database the database for which to lookup routing table.
   * @param {ServerAddress} routerAddress the URL of the router.
   * @param {string} impersonatedUser The impersonated user
   * @return {Promise<RoutingTable>} promise resolved with new routing table or null when connection error happened.
   */
  lookupRoutingTableOnRouter (connection, sessionContext, database, routerAddress, impersonatedUser) {
    return this._requestRawRoutingTable(
      connection,
      sessionContext,
      database,
      routerAddress,
      impersonatedUser
    ).then(rawRoutingTable => {
      if (rawRoutingTable.isNull) {
        return null
      }
      return RoutingTable.fromRawRoutingTable(
        database,
        routerAddress,
        rawRoutingTable
      )
    })
  }

  _requestRawRoutingTable (connection, sessionContext, database, routerAddress, impersonatedUser) {
    return new Promise((resolve, reject) => {
      connection.protocol().requestRoutingInformation({
        routingContext: this._routingContext,
        databaseName: database,
        impersonatedUser,
        sessionContext,
        onCompleted: resolve,
        onError: reject
      })
    }).finally(async () => await connection.release())
  }
}

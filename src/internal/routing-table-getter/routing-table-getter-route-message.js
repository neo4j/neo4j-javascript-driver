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
import Session from '../../session'
import Connection from '../connection'
import {
  runWithExceptionTreament,
  RawRoutingTable,
  createValidRoutingTable
} from './routing-table-factory'

export default class RouteMessageRoutingTableGetter {
  /**
   * Constructor
   * @param {Object} routingContext
   */
  constructor (routingContext, initialAddress) {
    this._routingContext = routingContext
    this._initialAddress = initialAddress
  }

  /**
   * Get the routing table by running the routing table procedure
   *
   * @param {Connection} connection The connection use
   * @param {string} database the database
   * @param {ServerAddress} routerAddress the router address
   * @param {Session} session the session used to get the connection.
   *
   * @returns {Promise<RoutingTable>} The routing table
   */
  async get (connection, database, routerAddress, session) {
    const response = await runWithExceptionTreament(routerAddress, () =>
      this._requestRoutingTable(connection, database)
    )
    if (response === null) {
      return null
    }

    const rawRoutingTable = new ResponseRawRoutingTable(response)

    return createValidRoutingTable(database, routerAddress, rawRoutingTable)
  }

  /**
   * Request routing table
   *
   * @param {Connection} connection the connection
   * @param {string} database the database name
   * @param {Session} session the session
   * @returns {Promise<Object>} The metadata
   */
  _requestRoutingTable (connection, database) {
    return new Promise((resolve, reject) => {
      connection.protocol().requestRoutingInformation({
        routingContext: {
          ...this._routingContext,
          address: this._initialAddress
        },
        databaseName: database,
        onError: error => {
          reject(error)
        },
        onComplete: (...args) => {
          resolve(...args)
        }
      })
    })
  }
}

/**
 * Get the raw routing table information from route message response
 */
class ResponseRawRoutingTable extends RawRoutingTable {
  constructor (response) {
    super()
    this._response = response
  }

  get ttl () {
    return this._response.rt.ttl
  }

  get servers () {
    return this._response.rt.servers
  }
}

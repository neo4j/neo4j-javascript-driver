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
import RoutingTable from './routing-table'
import { RawRoutingTable } from './bolt'
import Session from '../session'
import ServerAddress from './server-address'
import { newError, error } from 'neo4j-driver-core'

const { SERVICE_UNAVAILABLE } = error
const PROCEDURE_NOT_FOUND_CODE = 'Neo.ClientError.Procedure.ProcedureNotFound'
const DATABASE_NOT_FOUND_CODE = 'Neo.ClientError.Database.DatabaseNotFound'

export default class Rediscovery {
  /**
   * @constructor
   * @param {object} routingContext
   * @param {string} initialAddress
   */
  constructor (routingContext, initialAddress) {
    this._routingContext = routingContext
    this._initialAddress = initialAddress
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
      return this._requestRawRoutingTable(
        connection,
        session,
        database,
        routerAddress
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
    })
  }

  _requestRawRoutingTable (connection, session, database, routerAddress) {
    return new Promise((resolve, reject) => {
      connection.protocol().requestRoutingInformation({
        routingContext: this._routingContext,
        initialAddress: this._initialAddress,
        databaseName: database,
        sessionContext: {
          bookmark: session._lastBookmark,
          mode: session._mode,
          database: session._database,
          afterComplete: session._onComplete
        },
        onCompleted: resolve,
        onError: error => {
          if (error.code === DATABASE_NOT_FOUND_CODE) {
            reject(error)
          } else if (error.code === PROCEDURE_NOT_FOUND_CODE) {
            // throw when getServers procedure not found because this is clearly a configuration issue
            reject(
              newError(
                `Server at ${routerAddress.asHostPort()} can't perform routing. Make sure you are connecting to a causal cluster`,
                SERVICE_UNAVAILABLE
              )
            )
          } else {
            // return nothing when failed to connect because code higher in the callstack is still able to retry with a
            // different session towards a different router
            resolve(RawRoutingTable.ofNull())
          }
        }
      })
    })
  }
}

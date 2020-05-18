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

import { newError, PROTOCOL_ERROR, SERVICE_UNAVAILABLE } from '../error'
import Integer, { int } from '../integer'
import { ServerVersion, VERSION_4_0_0 } from './server-version'
import Bookmark from './bookmark'
import Session from '../session'
import TxConfig from './tx-config'
import ServerAddress from './server-address'

const CONTEXT = 'context'
const CALL_GET_ROUTING_TABLE = `CALL dbms.cluster.routing.getRoutingTable($${CONTEXT})`
const DATABASE = 'database'
const CALL_GET_ROUTING_TABLE_MULTI_DB = `CALL dbms.routing.getRoutingTable($${CONTEXT}, $${DATABASE})`
const PROCEDURE_NOT_FOUND_CODE = 'Neo.ClientError.Procedure.ProcedureNotFound'
const DATABASE_NOT_FOUND_CODE = 'Neo.ClientError.Database.DatabaseNotFound'

export default class RoutingUtil {
  constructor (routingContext) {
    this._routingContext = routingContext
  }

  /**
   * Invoke routing procedure using the given session.
   * @param {Session} session the session to use.
   * @param {string} routerAddress the URL of the router.
   * @return {Promise<Record[]>} promise resolved with records returned by the procedure call or null if
   * connection error happened.
   */
  async callRoutingProcedure (session, database, routerAddress) {
    try {
      const result = await this._callAvailableRoutingProcedure(
        session,
        database
      )

      await session.close()

      return result.records
    } catch (error) {
      if (error.code === DATABASE_NOT_FOUND_CODE) {
        throw error
      } else if (error.code === PROCEDURE_NOT_FOUND_CODE) {
        // throw when getServers procedure not found because this is clearly a configuration issue
        throw newError(
          `Server at ${routerAddress.asHostPort()} can't perform routing. Make sure you are connecting to a causal cluster`,
          SERVICE_UNAVAILABLE
        )
      } else {
        // return nothing when failed to connect because code higher in the callstack is still able to retry with a
        // different session towards a different router
        return null
      }
    }
  }

  parseTtl (record, routerAddress) {
    try {
      const now = int(Date.now())
      const expires = int(record.get('ttl'))
        .multiply(1000)
        .add(now)
      // if the server uses a really big expire time like Long.MAX_VALUE this may have overflowed
      if (expires.lessThan(now)) {
        return Integer.MAX_VALUE
      }
      return expires
    } catch (error) {
      throw newError(
        `Unable to parse TTL entry from router ${routerAddress} from record:\n${JSON.stringify(
          record
        )}\nError message: ${error.message}`,
        PROTOCOL_ERROR
      )
    }
  }

  parseServers (record, routerAddress) {
    try {
      const servers = record.get('servers')

      let routers = []
      let readers = []
      let writers = []

      servers.forEach(server => {
        const role = server.role
        const addresses = server.addresses

        if (role === 'ROUTE') {
          routers = parseArray(addresses).map(address =>
            ServerAddress.fromUrl(address)
          )
        } else if (role === 'WRITE') {
          writers = parseArray(addresses).map(address =>
            ServerAddress.fromUrl(address)
          )
        } else if (role === 'READ') {
          readers = parseArray(addresses).map(address =>
            ServerAddress.fromUrl(address)
          )
        } else {
          throw newError('Unknown server role "' + role + '"', PROTOCOL_ERROR)
        }
      })

      return {
        routers: routers,
        readers: readers,
        writers: writers
      }
    } catch (error) {
      throw newError(
        `Unable to parse servers entry from router ${routerAddress} from record:\n${JSON.stringify(
          record
        )}\nError message: ${error.message}`,
        PROTOCOL_ERROR
      )
    }
  }

  _callAvailableRoutingProcedure (session, database) {
    return session._run(null, null, connection => {
      let query
      let params

      const protocolVersion = connection.protocol().version
      if (protocolVersion >= 4.0) {
        query = CALL_GET_ROUTING_TABLE_MULTI_DB
        params = {
          context: this._routingContext,
          database: database || null
        }
      } else {
        query = CALL_GET_ROUTING_TABLE
        params = { context: this._routingContext }
      }

      return connection.protocol().run(query, params, {
        bookmark: session._lastBookmark,
        txConfig: TxConfig.empty(),
        mode: session._mode,
        database: session._database,
        afterComplete: session._onComplete
      })
    })
  }
}

function parseArray (addresses) {
  if (!Array.isArray(addresses)) {
    throw new TypeError('Array expected but got: ' + addresses)
  }
  return Array.from(addresses)
}

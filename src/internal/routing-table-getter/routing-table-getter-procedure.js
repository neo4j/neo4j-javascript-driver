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
import { newError, PROTOCOL_ERROR, SERVICE_UNAVAILABLE } from '../../error'
import ServerAddress from '../server-address'
import RoutingTable from '../routing-table'
import Integer, { int } from '../../integer'
import Session from '../../session'
import RoutingProcedureRunner from './routing-procedure-runner'

const PROCEDURE_NOT_FOUND_CODE = 'Neo.ClientError.Procedure.ProcedureNotFound'
const DATABASE_NOT_FOUND_CODE = 'Neo.ClientError.Database.DatabaseNotFound'

/**
 * Get the routing table by running the procedure
 */
export default class ProcedureRoutingTableGetter {
  /**
   * Constructor
   * @param {Object} routingContext
   * @param {RoutingProcedureRunner} runner the procedure runner
   */
  constructor (routingContext, runner) {
    this._runner = runner
    this._routingContext = routingContext
  }

  /**
   * Get the routing table by running the routing table procedure
   *
   * @param {Connection} connection The connection use
   * @param {string} database the database
   * @param {ServerAddress} routerAddress the router address
   * @param {Session} session the session which was used to get the connection,
   *                 it will be used to get lastBookmark and other properties
   *
   * @returns {Promise<RoutingTable>} The routing table
   */
  async get (connection, database, routerAddress, session) {
    const records = await this._runProcedure(
      connection,
      database,
      routerAddress,
      session
    )
    if (records === null) {
      return null // it should go to another layer to retry
    }

    if (records.length !== 1) {
      throw newError(
        'Illegal response from router "' +
          routerAddress +
          '". ' +
          'Received ' +
          records.length +
          ' records but expected only one.\n' +
          JSON.stringify(records),
        PROTOCOL_ERROR
      )
    }

    const record = records[0]

    const expirationTime = this._parseTtl(record, routerAddress)
    const { routers, readers, writers } = this._parseServers(
      record,
      routerAddress
    )

    assertNonEmpty(routers, 'routers', routerAddress)
    assertNonEmpty(readers, 'readers', routerAddress)

    return new RoutingTable({
      database,
      routers,
      readers,
      writers,
      expirationTime
    })
  }

  /**
   * Run the routing query and fetch the records
   *
   * @param {Connection} connection the connection
   * @param {string} database the database
   * @param {string} routerAddress the router address
   * @param {Session} session the session which was used to get the connection,
   *                 it will be used to get lastBookmark and other properties
   *
   * @returns {Promise<Record[]>} the list of records fetched
   */
  async _runProcedure (connection, database, routerAddress, session) {
    try {
      const result = await this._runner.run(
        connection,
        database,
        this._routingContext,
        session
      )
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

  /**
   * Parse the ttls from the record and return it
   *
   * @param {Record} record the record
   * @param {string} routerAddress the router address
   * @returns {number} the ttl
   */
  _parseTtl (record, routerAddress) {
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

  /**
   * Parse server from the Record.
   *
   * @param {Record} record the record
   * @param {string} routerAddress the router address
   * @returns {Object} The object with the list of routers, readers and writers
   */
  _parseServers (record, routerAddress) {
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
}

/**
 * Assset if serverAddressesArray is not empty, throws and PROTOCOL_ERROR otherwise
 *
 * @param {string[]} serverAddressesArray array of addresses
 * @param {string} serversName the server name
 * @param {string} routerAddress the router address
 */
function assertNonEmpty (serverAddressesArray, serversName, routerAddress) {
  if (serverAddressesArray.length === 0) {
    throw newError(
      'Received no ' + serversName + ' from router ' + routerAddress,
      PROTOCOL_ERROR
    )
  }
}

function parseArray (addresses) {
  if (!Array.isArray(addresses)) {
    throw new TypeError('Array expected but got: ' + addresses)
  }
  return Array.from(addresses)
}

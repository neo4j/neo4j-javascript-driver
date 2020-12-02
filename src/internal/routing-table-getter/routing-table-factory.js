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
import Integer, { int } from '../../integer'
import ServerAddress from '../server-address'
import RoutingTable from '../routing-table'

const PROCEDURE_NOT_FOUND_CODE = 'Neo.ClientError.Procedure.ProcedureNotFound'
const DATABASE_NOT_FOUND_CODE = 'Neo.ClientError.Database.DatabaseNotFound'

/**
 * Represente the raw version of the routing table
 */
export class RawRoutingTable {
  /**
   * Get raw ttl
   *
   * @returns {number|string} ttl Time to live
   */
  get ttl () {
    throw new Error('Not implemented')
  }

  /**
   *
   * @typedef {Object} ServerRole
   * @property {string} role the role of the address on the cluster
   * @property {string[]} addresses the address within the role
   *
   * @return {ServerRole[]} list of servers addresses
   */
  get servers () {
    throw new Error('Not implemented')
  }
}

/**
 * This method is used to safe run a command to the server to get some data providing a standard exception treatment
 *
 * @param {ServerAddress} routerAddress The router address, it is used for loggin purposes
 * @param {function():Promise} runSupplier The supplier which will be runned
 * @return {Promise} the result of the supplier
 */
export async function runWithExceptionTreament (routerAddress, runSupplier) {
  try {
    return await runSupplier()
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
 * Create a valid routing table from a raw object
 *
 * @param {string} database the database name. It is used for logging purposes
 * @param {ServerAddress} routerAddress The router address, it is used for loggin purposes
 * @param {RawRoutingTable} rawRoutingTable Method used to get the raw routing table to be processed
 * @param {RoutingTable} The valid Routing Table
 */
export function createValidRoutingTable (
  database,
  routerAddress,
  rawRoutingTable
) {
  const expirationTime = parseTtl(rawRoutingTable, routerAddress)
  const { routers, readers, writers } = parseServers(
    rawRoutingTable,
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
 * Parse server from the RawRoutingTable.
 *
 * @param {RawRoutingTable} rawRoutingTable the raw routing table
 * @param {string} routerAddress the router address
 * @returns {Object} The object with the list of routers, readers and writers
 */
function parseServers (rawRoutingTable, routerAddress) {
  try {
    let routers = []
    let readers = []
    let writers = []

    rawRoutingTable.servers.forEach(server => {
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
      `Unable to parse servers entry from router ${routerAddress} from addresses:\n${JSON.stringify(
        rawRoutingTable.servers
      )}\nError message: ${error.message}`,
      PROTOCOL_ERROR
    )
  }
}

/**
 * Parse the ttls from the raw routing table and return it
 *
 * @param {RawRoutingTable} rawRoutingTable the routing table
 * @param {string} routerAddress the router address
 * @returns {number} the ttl
 */
function parseTtl (rawRoutingTable, routerAddress) {
  try {
    const now = int(Date.now())
    const expires = int(rawRoutingTable.ttl)
      .multiply(1000)
      .add(now)
    // if the server uses a really big expire time like Long.MAX_VALUE this may have overflowed
    if (expires.lessThan(now)) {
      return Integer.MAX_VALUE
    }
    return expires
  } catch (error) {
    throw newError(
      `Unable to parse TTL entry from router ${routerAddress} from raw routing table:\n${JSON.stringify(
        rawRoutingTable
      )}\nError message: ${error.message}`,
      PROTOCOL_ERROR
    )
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

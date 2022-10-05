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
import {
  newError,
  error,
  Integer,
  int,
  internal,
  json
} from '../../core/index.ts'

const {
  constants: { ACCESS_MODE_WRITE: WRITE, ACCESS_MODE_READ: READ },
  serverAddress: { ServerAddress }
} = internal
const { PROTOCOL_ERROR } = error

const MIN_ROUTERS = 1

/**
 * The routing table object used to determine the role of the servers in the driver.
 */
export default class RoutingTable {
  constructor ({
    database,
    routers,
    readers,
    writers,
    expirationTime,
    ttl
  } = {}) {
    this.database = database || null
    this.databaseName = database || 'default database'
    this.routers = routers || []
    this.readers = readers || []
    this.writers = writers || []
    this.expirationTime = expirationTime || int(0)
    this.ttl = ttl
  }

  /**
   * Create a valid routing table from a raw object
   *
   * @param {string} database the database name. It is used for logging purposes
   * @param {ServerAddress} routerAddress The router address, it is used for loggin purposes
   * @param {RawRoutingTable} rawRoutingTable Method used to get the raw routing table to be processed
   * @param {RoutingTable} The valid Routing Table
   */
  static fromRawRoutingTable (database, routerAddress, rawRoutingTable) {
    return createValidRoutingTable(database, routerAddress, rawRoutingTable)
  }

  forget (address) {
    // Don't remove it from the set of routers, since that might mean we lose our ability to re-discover,
    // just remove it from the set of readers and writers, so that we don't use it for actual work without
    // performing discovery first.

    this.readers = removeFromArray(this.readers, address)
    this.writers = removeFromArray(this.writers, address)
  }

  forgetRouter (address) {
    this.routers = removeFromArray(this.routers, address)
  }

  forgetWriter (address) {
    this.writers = removeFromArray(this.writers, address)
  }

  /**
   * Check if this routing table is fresh to perform the required operation.
   * @param {string} accessMode the type of operation. Allowed values are {@link READ} and {@link WRITE}.
   * @return {boolean} `true` when this table contains servers to serve the required operation, `false` otherwise.
   */
  isStaleFor (accessMode) {
    return (
      this.expirationTime.lessThan(Date.now()) ||
      this.routers.length < MIN_ROUTERS ||
      (accessMode === READ && this.readers.length === 0) ||
      (accessMode === WRITE && this.writers.length === 0)
    )
  }

  /**
   * Check if this routing table is expired for specified amount of duration
   *
   * @param {Integer} duration amount of duration in milliseconds to check for expiration
   * @returns {boolean}
   */
  isExpiredFor (duration) {
    return this.expirationTime.add(duration).lessThan(Date.now())
  }

  allServers () {
    return [...this.routers, ...this.readers, ...this.writers]
  }

  toString () {
    return (
      'RoutingTable[' +
      `database=${this.databaseName}, ` +
      `expirationTime=${this.expirationTime}, ` +
      `currentTime=${Date.now()}, ` +
      `routers=[${this.routers}], ` +
      `readers=[${this.readers}], ` +
      `writers=[${this.writers}]]`
    )
  }
}

/**
 * Remove all occurrences of the element in the array.
 * @param {Array} array the array to filter.
 * @param {Object} element the element to remove.
 * @return {Array} new filtered array.
 */
function removeFromArray (array, element) {
  return array.filter(item => item.asKey() !== element.asKey())
}

/**
 * Create a valid routing table from a raw object
 *
 * @param {string} db the database name. It is used for logging purposes
 * @param {ServerAddress} routerAddress The router address, it is used for loggin purposes
 * @param {RawRoutingTable} rawRoutingTable Method used to get the raw routing table to be processed
 * @param {RoutingTable} The valid Routing Table
 */
export function createValidRoutingTable (
  database,
  routerAddress,
  rawRoutingTable
) {
  const ttl = rawRoutingTable.ttl
  const expirationTime = calculateExpirationTime(rawRoutingTable, routerAddress)
  const { routers, readers, writers } = parseServers(
    rawRoutingTable,
    routerAddress
  )

  assertNonEmpty(routers, 'routers', routerAddress)
  assertNonEmpty(readers, 'readers', routerAddress)

  return new RoutingTable({
    database: database || rawRoutingTable.db,
    routers,
    readers,
    writers,
    expirationTime,
    ttl
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
      }
    })

    return {
      routers: routers,
      readers: readers,
      writers: writers
    }
  } catch (error) {
    throw newError(
      `Unable to parse servers entry from router ${routerAddress} from addresses:\n${json.stringify(
        rawRoutingTable.servers
      )}\nError message: ${error.message}`,
      PROTOCOL_ERROR
    )
  }
}

/**
 * Call the expiration time using the ttls from the raw routing table and return it
 *
 * @param {RawRoutingTable} rawRoutingTable the routing table
 * @param {string} routerAddress the router address
 * @returns {number} the ttl
 */
function calculateExpirationTime (rawRoutingTable, routerAddress) {
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
      `Unable to parse TTL entry from router ${routerAddress} from raw routing table:\n${json.stringify(
        rawRoutingTable
      )}\nError message: ${error.message}`,
      PROTOCOL_ERROR
    )
  }
}

/**
 * Assert if serverAddressesArray is not empty, throws and PROTOCOL_ERROR otherwise
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

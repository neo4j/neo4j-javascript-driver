/**
 * Copyright (c) 2002-2019 "Neo4j,"
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

import { newError, SERVICE_UNAVAILABLE, SESSION_EXPIRED } from '../error'
import { READ, WRITE } from '../driver'
import Session from '../session'
import RoutingTable from './routing-table'
import Rediscovery from './rediscovery'
import RoutingUtil from './routing-util'
import { HostNameResolver } from './node'
import SingleConnectionProvider from './connection-provider-single'
import { ServerVersion, VERSION_4_0_0 } from './server-version'
import PooledConnectionProvider from './connection-provider-pooled'
import ConnectionErrorHandler from './connection-error-handler'
import DelegateConnection from './connection-delegate'
import LeastConnectedLoadBalancingStrategy from './least-connected-load-balancing-strategy'

const UNAUTHORIZED_ERROR_CODE = 'Neo.ClientError.Security.Unauthorized'
const DATABASE_NOT_FOUND_ERROR_CODE =
  'Neo.ClientError.Database.DatabaseNotFound'
const SYSTEM_DB_NAME = 'system'
const DEFAULT_DB_NAME = ''

export default class RoutingConnectionProvider extends PooledConnectionProvider {
  constructor ({
    id,
    address,
    routingContext,
    hostNameResolver,
    config,
    log,
    userAgent,
    authToken
  }) {
    super({ id, config, log, userAgent, authToken })

    this._seedRouter = address
    this._routingTables = {}
    this._rediscovery = new Rediscovery(new RoutingUtil(routingContext))
    this._loadBalancingStrategy = new LeastConnectedLoadBalancingStrategy(
      this._connectionPool
    )
    this._hostNameResolver = hostNameResolver
    this._dnsResolver = new HostNameResolver()
    this._log = log
    this._useSeedRouter = true
  }

  _createConnectionErrorHandler () {
    // connection errors mean SERVICE_UNAVAILABLE for direct driver but for routing driver they should only
    // result in SESSION_EXPIRED because there might still exist other servers capable of serving the request
    return new ConnectionErrorHandler(SESSION_EXPIRED)
  }

  _handleUnavailability (error, address, database) {
    this._log.warn(
      `Routing driver ${
        this._id
      } will forget ${address} for database '${database}' because of an error ${
        error.code
      } '${error.message}'`
    )
    this.forget(address, database || '')
    return error
  }

  _handleWriteFailure (error, address, database) {
    this._log.warn(
      `Routing driver ${
        this._id
      } will forget writer ${address} for database '${database}' because of an error ${
        error.code
      } '${error.message}'`
    )
    this.forgetWriter(address, database || '')
    return newError(
      'No longer possible to write to server at ' + address,
      SESSION_EXPIRED
    )
  }

  acquireConnection (accessMode, database) {
    const databaseSpecificErrorHandler = new ConnectionErrorHandler(
      SESSION_EXPIRED,
      (error, address) => this._handleUnavailability(error, address, database),
      (error, address) => this._handleWriteFailure(error, address, database)
    )

    return this._freshRoutingTable(accessMode, database || DEFAULT_DB_NAME)
      .then(routingTable => {
        let name
        let address

        if (accessMode === READ) {
          address = this._loadBalancingStrategy.selectReader(
            routingTable.readers
          )
          name = 'read'
        } else if (accessMode === WRITE) {
          address = this._loadBalancingStrategy.selectWriter(
            routingTable.writers
          )
          name = 'write'
        } else {
          throw newError('Illegal mode ' + accessMode)
        }

        if (!address) {
          throw newError(
            `Failed to obtain connection towards ${name} server. Known routing table is: ${routingTable}`,
            SESSION_EXPIRED
          )
        }

        return this._acquireConnectionToServer(
          address,
          name,
          routingTable
        ).catch(error => {
          const transformed = databaseSpecificErrorHandler.handleAndTransformError(
            error,
            address
          )
          throw transformed
        })
      })
      .then(
        connection =>
          new DelegateConnection(connection, databaseSpecificErrorHandler)
      )
  }

  forget (address, database) {
    if (database || database === '') {
      this._routingTables[database].forget(address)
    } else {
      Object.values(this._routingTables).forEach(routingTable =>
        routingTable.forget(address)
      )
    }

    this._connectionPool.purge(address)
  }

  forgetWriter (address, database) {
    if (database || database === '') {
      this._routingTables[database].forgetWriter(address)
    } else {
      Object.values(this._routingTables).forEach(routingTable =>
        routingTable.forgetWriter(address)
      )
    }
  }

  _acquireConnectionToServer (address, serverName, routingTable) {
    return this._connectionPool.acquire(address)
  }

  _freshRoutingTable (accessMode, database) {
    const currentRoutingTable =
      this._routingTables[database] || new RoutingTable({ database })

    if (!currentRoutingTable.isStaleFor(accessMode)) {
      return Promise.resolve(currentRoutingTable)
    }
    this._log.info(
      `Routing table is stale for database: "${database}" and access mode: "${accessMode}": ${currentRoutingTable}`
    )
    return this._refreshRoutingTable(currentRoutingTable)
  }

  _refreshRoutingTable (currentRoutingTable) {
    const knownRouters = currentRoutingTable.routers

    if (this._useSeedRouter) {
      return this._fetchRoutingTableFromSeedRouterFallbackToKnownRouters(
        knownRouters,
        currentRoutingTable
      )
    }
    return this._fetchRoutingTableFromKnownRoutersFallbackToSeedRouter(
      knownRouters,
      currentRoutingTable
    )
  }

  _fetchRoutingTableFromSeedRouterFallbackToKnownRouters (
    knownRouters,
    currentRoutingTable
  ) {
    // we start with seed router, no routers were probed before
    const seenRouters = []
    return this._fetchRoutingTableUsingSeedRouter(
      seenRouters,
      this._seedRouter,
      currentRoutingTable
    )
      .then(newRoutingTable => {
        if (newRoutingTable) {
          this._useSeedRouter = false
          return newRoutingTable
        }

        // seed router did not return a valid routing table - try to use other known routers
        return this._fetchRoutingTableUsingKnownRouters(
          knownRouters,
          currentRoutingTable
        )
      })
      .then(newRoutingTable => {
        this._applyRoutingTableIfPossible(currentRoutingTable, newRoutingTable)
        return newRoutingTable
      })
  }

  _fetchRoutingTableFromKnownRoutersFallbackToSeedRouter (
    knownRouters,
    currentRoutingTable
  ) {
    return this._fetchRoutingTableUsingKnownRouters(
      knownRouters,
      currentRoutingTable
    )
      .then(newRoutingTable => {
        if (newRoutingTable) {
          return newRoutingTable
        }

        // none of the known routers returned a valid routing table - try to use seed router address for rediscovery
        return this._fetchRoutingTableUsingSeedRouter(
          knownRouters,
          this._seedRouter,
          currentRoutingTable
        )
      })
      .then(newRoutingTable => {
        this._applyRoutingTableIfPossible(currentRoutingTable, newRoutingTable)
        return newRoutingTable
      })
  }

  _fetchRoutingTableUsingKnownRouters (knownRouters, currentRoutingTable) {
    return this._fetchRoutingTable(knownRouters, currentRoutingTable).then(
      newRoutingTable => {
        if (newRoutingTable) {
          // one of the known routers returned a valid routing table - use it
          return newRoutingTable
        }

        // returned routing table was undefined, this means a connection error happened and the last known
        // router did not return a valid routing table, so we need to forget it
        const lastRouterIndex = knownRouters.length - 1
        RoutingConnectionProvider._forgetRouter(
          currentRoutingTable,
          knownRouters,
          lastRouterIndex
        )

        return null
      }
    )
  }

  _fetchRoutingTableUsingSeedRouter (seenRouters, seedRouter, routingTable) {
    const resolvedAddresses = this._resolveSeedRouter(seedRouter)
    return resolvedAddresses.then(resolvedRouterAddresses => {
      // filter out all addresses that we've already tried
      const newAddresses = resolvedRouterAddresses.filter(
        address => seenRouters.indexOf(address) < 0
      )
      return this._fetchRoutingTable(newAddresses, routingTable)
    })
  }

  _resolveSeedRouter (seedRouter) {
    const customResolution = this._hostNameResolver.resolve(seedRouter)
    const dnsResolutions = customResolution.then(resolvedAddresses => {
      return Promise.all(
        resolvedAddresses.map(address => {
          return this._dnsResolver.resolve(address)
        })
      )
    })
    return dnsResolutions.then(results => {
      return [].concat.apply([], results)
    })
  }

  _fetchRoutingTable (routerAddresses, routingTable) {
    return routerAddresses.reduce(
      (refreshedTablePromise, currentRouter, currentIndex) => {
        return refreshedTablePromise.then(newRoutingTable => {
          if (newRoutingTable) {
            // valid routing table was fetched - just return it, try next router otherwise
            return newRoutingTable
          } else {
            // returned routing table was undefined, this means a connection error happened and we need to forget the
            // previous router and try the next one
            const previousRouterIndex = currentIndex - 1
            RoutingConnectionProvider._forgetRouter(
              routingTable,
              routerAddresses,
              previousRouterIndex
            )
          }

          // try next router
          return this._createSessionForRediscovery(currentRouter).then(
            session => {
              if (session) {
                return this._rediscovery
                  .lookupRoutingTableOnRouter(
                    session,
                    routingTable.database,
                    currentRouter
                  )
                  .catch(error => {
                    if (error && error.code === DATABASE_NOT_FOUND_ERROR_CODE) {
                      // not finding the target database is a sign of a configuration issue
                      throw error
                    }
                    this._log.warn(
                      `unable to fetch routing table because of an error ${error}`
                    )
                    return null
                  })
              } else {
                // unable to acquire connection and create session towards the current router
                // return null to signal that the next router should be tried
                return null
              }
            }
          )
        })
      },
      Promise.resolve(null)
    )
  }

  _createSessionForRediscovery (routerAddress) {
    return this._connectionPool
      .acquire(routerAddress)
      .then(connection => {
        const connectionProvider = new SingleConnectionProvider(connection)

        const version = ServerVersion.fromString(connection.version)
        if (version.compareTo(VERSION_4_0_0) < 0) {
          return new Session({ mode: WRITE, connectionProvider })
        }

        return new Session({
          mode: READ,
          database: SYSTEM_DB_NAME,
          connectionProvider
        })
      })
      .catch(error => {
        // unable to acquire connection towards the given router
        if (error && error.code === UNAUTHORIZED_ERROR_CODE) {
          // auth error and not finding system database is a sign of a configuration issue
          // discovery should not proceed
          throw error
        }
        return null
      })
  }

  _applyRoutingTableIfPossible (currentRoutingTable, newRoutingTable) {
    if (!newRoutingTable) {
      // none of routing servers returned valid routing table, throw exception
      throw newError(
        `Could not perform discovery. No routing servers available. Known routing table: ${currentRoutingTable}`,
        SERVICE_UNAVAILABLE
      )
    }

    if (newRoutingTable.writers.length === 0) {
      // use seed router next time. this is important when cluster is partitioned. it tries to make sure driver
      // does not always get routing table without writers because it talks exclusively to a minority partition
      this._useSeedRouter = true
    }

    this._updateRoutingTable(newRoutingTable)
  }

  _updateRoutingTable (newRoutingTable) {
    // close old connections to servers not present in the new routing table
    this._connectionPool.keepAll(newRoutingTable.allServers())

    // make this driver instance aware of the new table
    this._routingTables[newRoutingTable.database] = newRoutingTable
    this._log.info(`Updated routing table ${newRoutingTable}`)
  }

  static _forgetRouter (routingTable, routersArray, routerIndex) {
    const address = routersArray[routerIndex]
    if (routingTable && address) {
      routingTable.forgetRouter(address)
    }
  }
}

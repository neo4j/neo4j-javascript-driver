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

import { newError, error, int, Session, internal } from 'neo4j-driver-core'
import Rediscovery, { RoutingTable } from '../rediscovery'
import { HostNameResolver } from '../channel'
import SingleConnectionProvider from './connection-provider-single'
import PooledConnectionProvider from './connection-provider-pooled'
import { LeastConnectedLoadBalancingStrategy } from '../load-balancing'
import {
  createChannelConnection,
  ConnectionErrorHandler,
  DelegateConnection
} from '../connection'

const { SERVICE_UNAVAILABLE, SESSION_EXPIRED } = error
const {
  bookmark: { Bookmark },
  constants: {
    ACCESS_MODE_READ: READ,
    ACCESS_MODE_WRITE: WRITE,
    BOLT_PROTOCOL_V3,
    BOLT_PROTOCOL_V4_0,
    BOLT_PROTOCOL_V4_4
  }
} = internal

const UNAUTHORIZED_ERROR_CODE = 'Neo.ClientError.Security.Unauthorized'
const DATABASE_NOT_FOUND_ERROR_CODE =
  'Neo.ClientError.Database.DatabaseNotFound'
const SYSTEM_DB_NAME = 'system'
const DEFAULT_DB_NAME = null
const DEFAULT_ROUTING_TABLE_PURGE_DELAY = int(30000)

export default class RoutingConnectionProvider extends PooledConnectionProvider {
  constructor ({
    id,
    address,
    routingContext,
    hostNameResolver,
    config,
    log,
    userAgent,
    authToken,
    routingTablePurgeDelay
  }) {
    super({ id, config, log, userAgent, authToken }, address => {
      return createChannelConnection(
        address,
        this._config,
        this._createConnectionErrorHandler(),
        this._log,
        this._routingContext
      )
    })

    this._routingContext = { ...routingContext, address: address.toString() }
    this._seedRouter = address
    this._rediscovery = new Rediscovery(this._routingContext)
    this._loadBalancingStrategy = new LeastConnectedLoadBalancingStrategy(
      this._connectionPool
    )
    this._hostNameResolver = hostNameResolver
    this._dnsResolver = new HostNameResolver()
    this._log = log
    this._useSeedRouter = true
    this._routingTableRegistry = new RoutingTableRegistry(
      routingTablePurgeDelay
        ? int(routingTablePurgeDelay)
        : DEFAULT_ROUTING_TABLE_PURGE_DELAY
    )
  }

  _createConnectionErrorHandler () {
    // connection errors mean SERVICE_UNAVAILABLE for direct driver but for routing driver they should only
    // result in SESSION_EXPIRED because there might still exist other servers capable of serving the request
    return new ConnectionErrorHandler(SESSION_EXPIRED)
  }

  _handleUnavailability (error, address, database) {
    this._log.warn(
      `Routing driver ${this._id} will forget ${address} for database '${database}' because of an error ${error.code} '${error.message}'`
    )
    this.forget(address, database || DEFAULT_DB_NAME)
    return error
  }

  _handleAuthorizationExpired (error, address, database) {
    this._log.warn(
      `Routing driver ${this._id} will close connections to ${address} for database '${database}' because of an error ${error.code} '${error.message}'`
    )
    this._connectionPool.purge(address).catch(() => {})
    return error
  }

  _handleWriteFailure (error, address, database) {
    this._log.warn(
      `Routing driver ${this._id} will forget writer ${address} for database '${database}' because of an error ${error.code} '${error.message}'`
    )
    this.forgetWriter(address, database || DEFAULT_DB_NAME)
    return newError(
      'No longer possible to write to server at ' + address,
      SESSION_EXPIRED
    )
  }

  /**
   * See {@link ConnectionProvider} for more information about this method and
   * its arguments.
   */
  async acquireConnection ({ accessMode, database, bookmarks, impersonatedUser, onDatabaseNameResolved } = {}) {
    let name
    let address
    const context = { database: database || DEFAULT_DB_NAME }

    const databaseSpecificErrorHandler = new ConnectionErrorHandler(
      SESSION_EXPIRED,
      (error, address) => this._handleUnavailability(error, address, context.database),
      (error, address) => this._handleWriteFailure(error, address, context.database),
      (error, address) =>
        this._handleAuthorizationExpired(error, address, context.database)
    )

    const routingTable = await this._freshRoutingTable({
      accessMode,
      database: context.database,
      bookmark: bookmarks,
      impersonatedUser,
      onDatabaseNameResolved: (databaseName) => {
        context.database = context.database || databaseName
        if (onDatabaseNameResolved) {
          onDatabaseNameResolved(databaseName)
        }
      }
    })

    // select a target server based on specified access mode
    if (accessMode === READ) {
      address = this._loadBalancingStrategy.selectReader(routingTable.readers)
      name = 'read'
    } else if (accessMode === WRITE) {
      address = this._loadBalancingStrategy.selectWriter(routingTable.writers)
      name = 'write'
    } else {
      throw newError('Illegal mode ' + accessMode)
    }

    // we couldn't select a target server
    if (!address) {
      throw newError(
        `Failed to obtain connection towards ${name} server. Known routing table is: ${routingTable}`,
        SESSION_EXPIRED
      )
    }

    try {
      const connection = await this._acquireConnectionToServer(
        address,
        name,
        routingTable
      )

      return new DelegateConnection(connection, databaseSpecificErrorHandler)
    } catch (error) {
      const transformed = databaseSpecificErrorHandler.handleAndTransformError(
        error,
        address
      )
      throw transformed
    }
  }

  async _hasProtocolVersion (versionPredicate) {
    const addresses = await this._resolveSeedRouter(this._seedRouter)

    let lastError
    for (let i = 0; i < addresses.length; i++) {
      try {
        const connection = await createChannelConnection(
          addresses[i],
          this._config,
          this._createConnectionErrorHandler(),
          this._log
        )
        const protocolVersion = connection.protocol()
          ? connection.protocol().version
          : null

        await connection.close()

        if (protocolVersion) {
          return versionPredicate(protocolVersion)
        }

        return false
      } catch (error) {
        lastError = error
      }
    }

    if (lastError) {
      throw lastError
    }

    return false
  }

  async supportsMultiDb () {
    return await this._hasProtocolVersion(
      version => version >= BOLT_PROTOCOL_V4_0
    )
  }

  async supportsTransactionConfig () {
    return await this._hasProtocolVersion(
      version => version >= BOLT_PROTOCOL_V3
    )
  }

  async supportsUserImpersonation () {
    return await this._hasProtocolVersion(
      version => version >= BOLT_PROTOCOL_V4_4
    )
  }  

  forget (address, database) {
    this._routingTableRegistry.apply(database, {
      applyWhenExists: routingTable => routingTable.forget(address)
    })

    // We're firing and forgetting this operation explicitly and listening for any
    // errors to avoid unhandled promise rejection
    this._connectionPool.purge(address).catch(() => {})
  }

  forgetWriter (address, database) {
    this._routingTableRegistry.apply( database, {
      applyWhenExists: routingTable => routingTable.forgetWriter(address)
    })
  }

  _acquireConnectionToServer (address, serverName, routingTable) {
    return this._connectionPool.acquire(address)
  }

  _freshRoutingTable ({ accessMode, database, bookmark, impersonatedUser, onDatabaseNameResolved } = {}) {
    const currentRoutingTable = this._routingTableRegistry.get(
      database,
      () => new RoutingTable({ database })
    )

    if (!currentRoutingTable.isStaleFor(accessMode)) {
      return currentRoutingTable
    }
    this._log.info(
      `Routing table is stale for database: "${database}" and access mode: "${accessMode}": ${currentRoutingTable}`
    )
    return this._refreshRoutingTable(currentRoutingTable, bookmark, impersonatedUser, onDatabaseNameResolved)
  }

  _refreshRoutingTable (currentRoutingTable, bookmark, impersonatedUser, onDatabaseNameResolved) {
    const knownRouters = currentRoutingTable.routers

    if (this._useSeedRouter) {
      return this._fetchRoutingTableFromSeedRouterFallbackToKnownRouters(
        knownRouters,
        currentRoutingTable,
        bookmark,
        impersonatedUser,
        onDatabaseNameResolved
      )
    }
    return this._fetchRoutingTableFromKnownRoutersFallbackToSeedRouter(
      knownRouters,
      currentRoutingTable,
      bookmark,
      impersonatedUser,
      onDatabaseNameResolved
    )
  }

  async _fetchRoutingTableFromSeedRouterFallbackToKnownRouters (
    knownRouters,
    currentRoutingTable,
    bookmark,
    impersonatedUser,
    onDatabaseNameResolved
  ) {
    // we start with seed router, no routers were probed before
    const seenRouters = []
    let newRoutingTable = await this._fetchRoutingTableUsingSeedRouter(
      seenRouters,
      this._seedRouter,
      currentRoutingTable,
      bookmark,
      impersonatedUser
    )

    if (newRoutingTable) {
      this._useSeedRouter = false
    } else {
      // seed router did not return a valid routing table - try to use other known routers
      newRoutingTable = await this._fetchRoutingTableUsingKnownRouters(
        knownRouters,
        currentRoutingTable,
        bookmark,
        impersonatedUser
      )
    }

    return await this._applyRoutingTableIfPossible(
      currentRoutingTable,
      newRoutingTable,
      onDatabaseNameResolved
    )
  }

  async _fetchRoutingTableFromKnownRoutersFallbackToSeedRouter (
    knownRouters,
    currentRoutingTable,
    bookmark,
    impersonatedUser,
    onDatabaseNameResolved
  ) {
    let newRoutingTable = await this._fetchRoutingTableUsingKnownRouters(
      knownRouters,
      currentRoutingTable,
      bookmark,
      impersonatedUser
    )

    if (!newRoutingTable) {
      // none of the known routers returned a valid routing table - try to use seed router address for rediscovery
      newRoutingTable = await this._fetchRoutingTableUsingSeedRouter(
        knownRouters,
        this._seedRouter,
        currentRoutingTable,
        bookmark,
        impersonatedUser
      )
    }

    return await this._applyRoutingTableIfPossible(
      currentRoutingTable,
      newRoutingTable,
      onDatabaseNameResolved
    )
  }

  async _fetchRoutingTableUsingKnownRouters (
    knownRouters,
    currentRoutingTable,
    bookmark,
    impersonatedUser
  ) {
    const newRoutingTable = await this._fetchRoutingTable(
      knownRouters,
      currentRoutingTable,
      bookmark,
      impersonatedUser
    )

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

  async _fetchRoutingTableUsingSeedRouter (
    seenRouters,
    seedRouter,
    routingTable,
    bookmark,
    impersonatedUser
  ) {
    const resolvedAddresses = await this._resolveSeedRouter(seedRouter)

    // filter out all addresses that we've already tried
    const newAddresses = resolvedAddresses.filter(
      address => seenRouters.indexOf(address) < 0
    )

    return await this._fetchRoutingTable(newAddresses, routingTable, bookmark, impersonatedUser)
  }

  async _resolveSeedRouter (seedRouter) {
    const resolvedAddresses = await this._hostNameResolver.resolve(seedRouter)
    const dnsResolvedAddresses = await Promise.all(
      resolvedAddresses.map(address => this._dnsResolver.resolve(address))
    )

    return [].concat.apply([], dnsResolvedAddresses)
  }

  _fetchRoutingTable (routerAddresses, routingTable, bookmark, impersonatedUser) {
    return routerAddresses.reduce(
      async (refreshedTablePromise, currentRouter, currentIndex) => {
        const newRoutingTable = await refreshedTablePromise

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
        const session = await this._createSessionForRediscovery(
          currentRouter,
          bookmark,
          impersonatedUser
        )
        if (session) {
          try {
            return await this._rediscovery.lookupRoutingTableOnRouter(
              session,
              routingTable.database,
              currentRouter,
              impersonatedUser
            )
          } catch (error) {
            if (error && error.code === DATABASE_NOT_FOUND_ERROR_CODE) {
              // not finding the target database is a sign of a configuration issue
              throw error
            }
            this._log.warn(
              `unable to fetch routing table because of an error ${error}`
            )
            return null
          } finally {
            session.close()
          }
        } else {
          // unable to acquire connection and create session towards the current router
          // return null to signal that the next router should be tried
          return null
        }
      },
      Promise.resolve(null)
    )
  }

  async _createSessionForRediscovery (routerAddress, bookmark, impersonatedUser) {
    try {
      const connection = await this._connectionPool.acquire(routerAddress)

      const databaseSpecificErrorHandler = ConnectionErrorHandler.create({
        errorCode: SESSION_EXPIRED,
        handleAuthorizationExpired: (error, address) => this._handleAuthorizationExpired(error, address)
      })
      
      const connectionProvider = new SingleConnectionProvider(
        new DelegateConnection(connection, databaseSpecificErrorHandler))

      const protocolVersion = connection.protocol().version
      if (protocolVersion < 4.0) {
        return new Session({
          mode: WRITE,
          bookmark: Bookmark.empty(),
          connectionProvider
        })
      }

      return new Session({
        mode: READ,
        database: SYSTEM_DB_NAME,
        bookmark,
        connectionProvider,
        impersonatedUser
      })
    } catch (error) {
      // unable to acquire connection towards the given router
      if (error && error.code === UNAUTHORIZED_ERROR_CODE) {
        // auth error and not finding system database is a sign of a configuration issue
        // discovery should not proceed
        throw error
      }
      return null
    }
  }

  async _applyRoutingTableIfPossible (currentRoutingTable, newRoutingTable, onDatabaseNameResolved) {
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

    await this._updateRoutingTable(newRoutingTable, onDatabaseNameResolved)

    return newRoutingTable
  }

  async _updateRoutingTable (newRoutingTable, onDatabaseNameResolved) {
    // close old connections to servers not present in the new routing table
    await this._connectionPool.keepAll(newRoutingTable.allServers())
    this._routingTableRegistry.removeExpired()
    this._routingTableRegistry.register(
      newRoutingTable
    )
    
    onDatabaseNameResolved(newRoutingTable.database)
    
    this._log.info(`Updated routing table ${newRoutingTable}`)
  }

  static _forgetRouter (routingTable, routersArray, routerIndex) {
    const address = routersArray[routerIndex]
    if (routingTable && address) {
      routingTable.forgetRouter(address)
    }
  }
}

/**
 * Responsible for keeping track of the existing routing tables
 */
class RoutingTableRegistry {
  /**
   * Constructor
   * @param {int} routingTablePurgeDelay The routing table purge delay
   */
  constructor (routingTablePurgeDelay) {
    this._tables = new Map()
    this._routingTablePurgeDelay = routingTablePurgeDelay
  }

  /**
   * Put a routing table in the registry
   *
   * @param {RoutingTable} table The routing table
   * @returns {RoutingTableRegistry} this
   */
  register (table) {
    this._tables.set(table.database, table)
    return this
  }

  /**
   * Apply function in the routing table for an specific database. If the database name is not defined, the function will
   * be applied for each element
   *
   * @param {string} database The database name
   * @param {object} callbacks The actions
   * @param {function (RoutingTable)} callbacks.applyWhenExists Call when the db exists or when the database property is not informed
   * @param {function ()} callbacks.applyWhenDontExists Call when the database doesn't have the routing table registred
   * @returns {RoutingTableRegistry} this
   */
  apply (database, { applyWhenExists, applyWhenDontExists = () => {} } = {}) {
    if (this._tables.has(database)) {
      applyWhenExists(this._tables.get(database))
    } else if (typeof database === 'string' || database === null) {
      applyWhenDontExists()
    } else {
      this._forEach(applyWhenExists)
    }
    return this
  }

  /**
   * Retrieves a routing table from a given database name
   * 
   * @param {string|impersonatedUser} impersonatedUser The impersonated User
   * @param {string} database The database name
   * @param {function()|RoutingTable} defaultSupplier The routing table supplier, if it's not a function or not exists, it will return itself as default value
   * @returns {RoutingTable} The routing table for the respective database
   */
  get (database, defaultSupplier) {
    if (this._tables.has(database) ) {
      return this._tables.get(database)
    }
    return typeof defaultSupplier === 'function'
      ? defaultSupplier()
      : defaultSupplier
  }

  /**
   * Remove the routing table which is already expired
   * @returns {RoutingTableRegistry} this
   */
  removeExpired () {
    return this._removeIf(value =>
      value.isExpiredFor(this._routingTablePurgeDelay)
    )
  }

  _forEach (apply) {
    for (const [, value] of this._tables) {
      apply(value)
    }
    return this
  }

  _remove (key) {
    this._tables.delete(key)
    return this
  }

  _removeIf (predicate) {
    for (const [key, value] of this._tables) {
      if (predicate(value)) {
        this._remove(key)
      }
    }
    return this
  }
}

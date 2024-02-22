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
import { functional } from '../lang'

const { SERVICE_UNAVAILABLE, SESSION_EXPIRED } = error
const {
  bookmarks: { Bookmarks },
  constants: {
    ACCESS_MODE_READ: READ,
    ACCESS_MODE_WRITE: WRITE,
    BOLT_PROTOCOL_V3,
    BOLT_PROTOCOL_V4_0,
    BOLT_PROTOCOL_V4_4,
    BOLT_PROTOCOL_V5_1
  }
} = internal

const PROCEDURE_NOT_FOUND_CODE = 'Neo.ClientError.Procedure.ProcedureNotFound'
const DATABASE_NOT_FOUND_CODE = 'Neo.ClientError.Database.DatabaseNotFound'
const INVALID_BOOKMARK_CODE = 'Neo.ClientError.Transaction.InvalidBookmark'
const INVALID_BOOKMARK_MIXTURE_CODE =
  'Neo.ClientError.Transaction.InvalidBookmarkMixture'
const AUTHORIZATION_EXPIRED_CODE =
  'Neo.ClientError.Security.AuthorizationExpired'
const INVALID_ARGUMENT_ERROR = 'Neo.ClientError.Statement.ArgumentError'
const INVALID_REQUEST_ERROR = 'Neo.ClientError.Request.Invalid'
const STATEMENT_TYPE_ERROR = 'Neo.ClientError.Statement.TypeError'
const NOT_AVAILABLE = 'N/A'

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
    boltAgent,
    authTokenManager,
    routingTablePurgeDelay,
    newPool
  }) {
    super({ id, config, log, userAgent, boltAgent, authTokenManager, newPool }, async address => {
      await this._updateClientCertificateWhenNeeded()
      return createChannelConnection(
        address,
        this._config,
        this._createConnectionErrorHandler(),
        this._log,
        await this._clientCertificate,
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

    this._refreshRoutingTable = functional.reuseOngoingRequest(this._refreshRoutingTable, this)
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

  _handleSecurityError (error, address, connection, database) {
    this._log.warn(
      `Routing driver ${this._id} will close connections to ${address} for database '${database}' because of an error ${error.code} '${error.message}'`
    )

    return super._handleSecurityError(error, address, connection, database)
  }

  _handleWriteFailure (error, address, database) {
    this._log.warn(
      `Routing driver ${this._id} will forget writer ${address} for database '${database}' because of an error ${error.code} '${error.message}'`
    )
    this.forgetWriter(address, database || DEFAULT_DB_NAME)
    return newError(
      'No longer possible to write to server at ' + address,
      SESSION_EXPIRED,
      error
    )
  }

  /**
   * See {@link ConnectionProvider} for more information about this method and
   * its arguments.
   */
  async acquireConnection ({ accessMode, database, bookmarks, impersonatedUser, onDatabaseNameResolved, auth } = {}) {
    let name
    let address
    const context = { database: database || DEFAULT_DB_NAME }

    const databaseSpecificErrorHandler = new ConnectionErrorHandler(
      SESSION_EXPIRED,
      (error, address) => this._handleUnavailability(error, address, context.database),
      (error, address) => this._handleWriteFailure(error, address, context.database),
      (error, address, conn) =>
        this._handleSecurityError(error, address, conn, context.database)
    )

    const routingTable = await this._freshRoutingTable({
      accessMode,
      database: context.database,
      bookmarks,
      impersonatedUser,
      auth,
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
      const connection = await this._connectionPool.acquire({ auth }, address)

      if (auth) {
        await this._verifyStickyConnection({
          auth,
          connection,
          address
        })
        return connection
      }

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
        const connection = await this._createChannelConnection(addresses[i])
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

  async supportsSessionAuth () {
    return await this._hasProtocolVersion(
      version => version >= BOLT_PROTOCOL_V5_1
    )
  }

  getNegotiatedProtocolVersion () {
    return new Promise((resolve, reject) => {
      this._hasProtocolVersion(resolve)
        .catch(reject)
    })
  }

  async verifyAuthentication ({ database, accessMode, auth }) {
    return this._verifyAuthentication({
      auth,
      getAddress: async () => {
        const context = { database: database || DEFAULT_DB_NAME }

        const routingTable = await this._freshRoutingTable({
          accessMode,
          database: context.database,
          auth,
          onDatabaseNameResolved: (databaseName) => {
            context.database = context.database || databaseName
          }
        })

        const servers = accessMode === WRITE ? routingTable.writers : routingTable.readers

        if (servers.length === 0) {
          throw newError(
            `No servers available for database '${context.database}' with access mode '${accessMode}'`,
            SERVICE_UNAVAILABLE
          )
        }

        return servers[0]
      }
    })
  }

  async verifyConnectivityAndGetServerInfo ({ database, accessMode }) {
    const context = { database: database || DEFAULT_DB_NAME }

    const routingTable = await this._freshRoutingTable({
      accessMode,
      database: context.database,
      onDatabaseNameResolved: (databaseName) => {
        context.database = context.database || databaseName
      }
    })

    const servers = accessMode === WRITE ? routingTable.writers : routingTable.readers

    let error = newError(
      `No servers available for database '${context.database}' with access mode '${accessMode}'`,
      SERVICE_UNAVAILABLE
    )

    for (const address of servers) {
      try {
        const serverInfo = await this._verifyConnectivityAndGetServerVersion({ address })
        return serverInfo
      } catch (e) {
        error = e
      }
    }
    throw error
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
    this._routingTableRegistry.apply(database, {
      applyWhenExists: routingTable => routingTable.forgetWriter(address)
    })
  }

  _freshRoutingTable ({ accessMode, database, bookmarks, impersonatedUser, onDatabaseNameResolved, auth } = {}) {
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
    return this._refreshRoutingTable(currentRoutingTable, bookmarks, impersonatedUser, auth)
      .then(newRoutingTable => {
        onDatabaseNameResolved(newRoutingTable.database)
        return newRoutingTable
      })
  }

  _refreshRoutingTable (currentRoutingTable, bookmarks, impersonatedUser, auth) {
    const knownRouters = currentRoutingTable.routers

    if (this._useSeedRouter) {
      return this._fetchRoutingTableFromSeedRouterFallbackToKnownRouters(
        knownRouters,
        currentRoutingTable,
        bookmarks,
        impersonatedUser,
        auth
      )
    }
    return this._fetchRoutingTableFromKnownRoutersFallbackToSeedRouter(
      knownRouters,
      currentRoutingTable,
      bookmarks,
      impersonatedUser,
      auth
    )
  }

  async _fetchRoutingTableFromSeedRouterFallbackToKnownRouters (
    knownRouters,
    currentRoutingTable,
    bookmarks,
    impersonatedUser,
    auth
  ) {
    // we start with seed router, no routers were probed before
    const seenRouters = []
    let [newRoutingTable, error] = await this._fetchRoutingTableUsingSeedRouter(
      seenRouters,
      this._seedRouter,
      currentRoutingTable,
      bookmarks,
      impersonatedUser,
      auth
    )

    if (newRoutingTable) {
      this._useSeedRouter = false
    } else {
      // seed router did not return a valid routing table - try to use other known routers
      const [newRoutingTable2, error2] = await this._fetchRoutingTableUsingKnownRouters(
        knownRouters,
        currentRoutingTable,
        bookmarks,
        impersonatedUser,
        auth
      )
      newRoutingTable = newRoutingTable2
      error = error2 || error
    }

    return await this._applyRoutingTableIfPossible(
      currentRoutingTable,
      newRoutingTable,
      error
    )
  }

  async _fetchRoutingTableFromKnownRoutersFallbackToSeedRouter (
    knownRouters,
    currentRoutingTable,
    bookmarks,
    impersonatedUser,
    auth
  ) {
    let [newRoutingTable, error] = await this._fetchRoutingTableUsingKnownRouters(
      knownRouters,
      currentRoutingTable,
      bookmarks,
      impersonatedUser,
      auth
    )

    if (!newRoutingTable) {
      // none of the known routers returned a valid routing table - try to use seed router address for rediscovery
      [newRoutingTable, error] = await this._fetchRoutingTableUsingSeedRouter(
        knownRouters,
        this._seedRouter,
        currentRoutingTable,
        bookmarks,
        impersonatedUser,
        auth
      )
    }

    return await this._applyRoutingTableIfPossible(
      currentRoutingTable,
      newRoutingTable,
      error
    )
  }

  async _fetchRoutingTableUsingKnownRouters (
    knownRouters,
    currentRoutingTable,
    bookmarks,
    impersonatedUser,
    auth
  ) {
    const [newRoutingTable, error] = await this._fetchRoutingTable(
      knownRouters,
      currentRoutingTable,
      bookmarks,
      impersonatedUser,
      auth
    )

    if (newRoutingTable) {
      // one of the known routers returned a valid routing table - use it
      return [newRoutingTable, null]
    }

    // returned routing table was undefined, this means a connection error happened and the last known
    // router did not return a valid routing table, so we need to forget it
    const lastRouterIndex = knownRouters.length - 1
    RoutingConnectionProvider._forgetRouter(
      currentRoutingTable,
      knownRouters,
      lastRouterIndex
    )

    return [null, error]
  }

  async _fetchRoutingTableUsingSeedRouter (
    seenRouters,
    seedRouter,
    routingTable,
    bookmarks,
    impersonatedUser,
    auth
  ) {
    const resolvedAddresses = await this._resolveSeedRouter(seedRouter)

    // filter out all addresses that we've already tried
    const newAddresses = resolvedAddresses.filter(
      address => seenRouters.indexOf(address) < 0
    )

    return await this._fetchRoutingTable(newAddresses, routingTable, bookmarks, impersonatedUser, auth)
  }

  async _resolveSeedRouter (seedRouter) {
    const resolvedAddresses = await this._hostNameResolver.resolve(seedRouter)
    const dnsResolvedAddresses = await Promise.all(
      resolvedAddresses.map(address => this._dnsResolver.resolve(address))
    )

    return [].concat.apply([], dnsResolvedAddresses)
  }

  async _fetchRoutingTable (routerAddresses, routingTable, bookmarks, impersonatedUser, auth) {
    return routerAddresses.reduce(
      async (refreshedTablePromise, currentRouter, currentIndex) => {
        const [newRoutingTable] = await refreshedTablePromise

        if (newRoutingTable) {
          // valid routing table was fetched - just return it, try next router otherwise
          return [newRoutingTable, null]
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
        const [session, error] = await this._createSessionForRediscovery(
          currentRouter,
          bookmarks,
          impersonatedUser,
          auth
        )
        if (session) {
          try {
            return [await this._rediscovery.lookupRoutingTableOnRouter(
              session,
              routingTable.database,
              currentRouter,
              impersonatedUser
            ), null]
          } catch (error) {
            return this._handleRediscoveryError(error, currentRouter)
          } finally {
            session.close()
          }
        } else {
          // unable to acquire connection and create session towards the current router
          // return null to signal that the next router should be tried
          return [null, error]
        }
      },
      Promise.resolve([null, null])
    )
  }

  async _createSessionForRediscovery (routerAddress, bookmarks, impersonatedUser, auth) {
    try {
      const connection = await this._connectionPool.acquire({ auth }, routerAddress)

      if (auth) {
        await this._verifyStickyConnection({
          auth,
          connection,
          address: routerAddress
        })
      }

      const databaseSpecificErrorHandler = ConnectionErrorHandler.create({
        errorCode: SESSION_EXPIRED,
        handleSecurityError: (error, address, conn) => this._handleSecurityError(error, address, conn)
      })

      const delegateConnection = !connection._sticky
        ? new DelegateConnection(connection, databaseSpecificErrorHandler)
        : new DelegateConnection(connection)

      const connectionProvider = new SingleConnectionProvider(delegateConnection)

      const protocolVersion = connection.protocol().version
      if (protocolVersion < 4.0) {
        return [new Session({
          mode: WRITE,
          bookmarks: Bookmarks.empty(),
          connectionProvider
        }), null]
      }

      return [new Session({
        mode: READ,
        database: SYSTEM_DB_NAME,
        bookmarks,
        connectionProvider,
        impersonatedUser
      }), null]
    } catch (error) {
      return this._handleRediscoveryError(error, routerAddress)
    }
  }

  _handleRediscoveryError (error, routerAddress) {
    if (_isFailFastError(error) || _isFailFastSecurityError(error)) {
      throw error
    } else if (error.code === PROCEDURE_NOT_FOUND_CODE) {
      // throw when getServers procedure not found because this is clearly a configuration issue
      throw newError(
        `Server at ${routerAddress.asHostPort()} can't perform routing. Make sure you are connecting to a causal cluster`,
        SERVICE_UNAVAILABLE,
        error
      )
    }
    this._log.warn(
      `unable to fetch routing table because of an error ${error}`
    )
    return [null, error]
  }

  async _applyRoutingTableIfPossible (currentRoutingTable, newRoutingTable, error) {
    if (!newRoutingTable) {
      // none of routing servers returned valid routing table, throw exception
      throw newError(
        `Could not perform discovery. No routing servers available. Known routing table: ${currentRoutingTable}`,
        SERVICE_UNAVAILABLE,
        error
      )
    }

    if (newRoutingTable.writers.length === 0) {
      // use seed router next time. this is important when cluster is partitioned. it tries to make sure driver
      // does not always get routing table without writers because it talks exclusively to a minority partition
      this._useSeedRouter = true
    }

    await this._updateRoutingTable(newRoutingTable)

    return newRoutingTable
  }

  async _updateRoutingTable (newRoutingTable) {
    // close old connections to servers not present in the new routing table
    await this._connectionPool.keepAll(newRoutingTable.allServers())
    this._routingTableRegistry.removeExpired()
    this._routingTableRegistry.register(
      newRoutingTable
    )

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
    if (this._tables.has(database)) {
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

function _isFailFastError (error) {
  return [
    DATABASE_NOT_FOUND_CODE,
    INVALID_BOOKMARK_CODE,
    INVALID_BOOKMARK_MIXTURE_CODE,
    INVALID_ARGUMENT_ERROR,
    INVALID_REQUEST_ERROR,
    STATEMENT_TYPE_ERROR,
    NOT_AVAILABLE
  ].includes(error.code)
}

function _isFailFastSecurityError (error) {
  return error.code.startsWith('Neo.ClientError.Security.') &&
    ![
      AUTHORIZATION_EXPIRED_CODE
    ].includes(error.code)
}

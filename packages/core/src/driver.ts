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
/* eslint-disable @typescript-eslint/promise-function-async */
import ConnectionProvider from './connection-provider'
import { Bookmarks } from './internal/bookmarks'
import ConfiguredCustomResolver from './internal/resolver/configured-custom-resolver'

import {
  ACCESS_MODE_READ,
  ACCESS_MODE_WRITE,
  FETCH_ALL,
  DEFAULT_CONNECTION_TIMEOUT_MILLIS,
  DEFAULT_POOL_ACQUISITION_TIMEOUT,
  DEFAULT_POOL_MAX_SIZE
} from './internal/constants'
import { Logger } from './internal/logger'
import Session from './session'
import { ServerInfo } from './result-summary'
import { ENCRYPTION_ON } from './internal/util'
import {
  EncryptionLevel,
  LoggingConfig,
  TrustStrategy,
  SessionMode
} from './types'
import { ServerAddress } from './internal/server-address'
import BookmarkManager from './bookmark-manager'

const DEFAULT_MAX_CONNECTION_LIFETIME: number = 60 * 60 * 1000 // 1 hour

/**
 * The default record fetch size. This is used in Bolt V4 protocol to pull query execution result in batches.
 * @type {number}
 */
const DEFAULT_FETCH_SIZE: number = 1000

/**
 * Constant that represents read session access mode.
 * Should be used like this: `driver.session({ defaultAccessMode: neo4j.session.READ })`.
 * @type {string}
 */
const READ: SessionMode = ACCESS_MODE_READ

/**
 * Constant that represents write session access mode.
 * Should be used like this: `driver.session({ defaultAccessMode: neo4j.session.WRITE })`.
 * @type {string}
 */
const WRITE: SessionMode = ACCESS_MODE_WRITE

let idGenerator = 0

interface MetaInfo {
  routing: boolean
  typename: string
  address: string | ServerAddress
}

type CreateConnectionProvider = (
  id: number,
  config: Object,
  log: Logger,
  hostNameResolver: ConfiguredCustomResolver
) => ConnectionProvider

type CreateSession = (args: {
  mode: SessionMode
  connectionProvider: ConnectionProvider
  bookmarks?: Bookmarks
  database: string
  config: any
  reactive: boolean
  fetchSize: number
  impersonatedUser?: string
  bookmarkManager?: BookmarkManager
}) => Session

interface DriverConfig {
  encrypted?: EncryptionLevel | boolean
  trust?: TrustStrategy
  fetchSize?: number
  logging?: LoggingConfig
}

/**
 * The session configuration
 *
 * @interface
 *
 * @param {string} defaultAccessMode=WRITE - The access mode of this session, allowed values are {@link READ} and {@link WRITE}.
 * @param {string|string[]} bookmarks - The initial reference or references to some previous
 * transactions. Value is optional and absence indicates that that the bookmarks do not exist or are unknown.
 * @param {number} fetchSize - The record fetch size of each batch of this session.
 * Use {@link FETCH_ALL} to always pull all records in one batch. This will override the config value set on driver config.
 * @param {string} database - The database this session will operate on.
 * @param {string} impersonatedUser - The username which the user wants to impersonate for the duration of the session.
 * @param {BookmarkManager} [bookmarkManager] = The bookmark manager
 */
class SessionConfig {
  defaultAccessMode?: SessionMode
  bookmarks?: string | string[]
  database?: string
  impersonatedUser?: string
  fetchSize?: number
  bookmarkManager?: BookmarkManager

  /**
   * @constructor
   * @private
   */
  constructor () {
    /**
     * The access mode of this session, allowed values are {@link READ} and {@link WRITE}.
     * **Default**: {@link WRITE}
     * @type {string}
     */
    this.defaultAccessMode = WRITE
    /**
     * The initial reference or references to some previous
     * transactions. Value is optional and absence indicates that that the bookmarks do not exist or are unknown.
     * @type {string|string[]|undefined}
     */
    this.bookmarks = []

    /**
     * The database this session will operate on.
     *
     * @type {string|undefined}
     */
    this.database = ''

    /**
     * The username which the user wants to impersonate for the duration of the session.
     *
     * @type {string|undefined}
     */
    this.impersonatedUser = undefined

    /**
     * The record fetch size of each batch of this session.
     *
     * Use {@link FETCH_ALL} to always pull all records in one batch. This will override the config value set on driver config.
     *
     * @type {number|undefined}
     */
    this.fetchSize = undefined
    /**
     * Configure a BookmarkManager for the session to use
     *
     * A BookmarkManager is a piece of software responsible for keeping casual consistency between different sessions by sharing bookmarks
     * between the them.
     * Enabling it is done by supplying an BookmarkManager implementation instance to this param.
     * A default implementation could be acquired by calling the factory function {@link bookmarkManager}.
     *
     * **Warning**: Share the same BookmarkManager instance accross all session can have a negative impact
     * on performance since all the queries will wait for the latest changes being propagated across the cluster.
     * For keeping consistency between a group of queries, use {@link Session} for grouping them.
     * For keeping consistency between a group of sessions, use {@link BookmarkManager} instance for groupping them.
     *
     * @example
     * const bookmarkManager = neo4j.bookmarkManager()
     * const linkedSession1 = driver.session({ database:'neo4j', bookmarkManager })
     * const linkedSession2 = driver.session({ database:'neo4j', bookmarkManager })
     * const unlinkedSession = driver.session({ database:'neo4j' })
     *
     * // Creating Driver User
     * const createUserQueryResult = await linkedSession1.run('CREATE (p:Person {name: $name})', { name: 'Driver User'})
     *
     * // Reading Driver User will *NOT* wait of the changes being propagated to the server before RUN the query
     * // So the 'Driver User' person might not exist in the Result
     * const unlinkedReadResult = await unlinkedSession.run('CREATE (p:Person {name: $name}) RETURN p', { name: 'Driver User'})
     *
     * // Reading Driver User will wait of the changes being propagated to the server before RUN the query
     * // So the 'Driver User' person should exist in the Result, unless deleted.
     * const linkedSesssion2 = await linkedSession2.run('CREATE (p:Person {name: $name}) RETURN p', { name: 'Driver User'})
     *
     * await linkedSession1.close()
     * await linkedSession2.close()
     * await unlinkedSession.close()
     *
     * @experimental
     * @type {BookmarkManager|undefined}
     * @since 5.0
     */
    this.bookmarkManager = undefined
  }
}

/**
 * A driver maintains one or more {@link Session}s with a remote
 * Neo4j instance. Through the {@link Session}s you can send queries
 * and retrieve results from the database.
 *
 * Drivers are reasonably expensive to create - you should strive to keep one
 * driver instance around per Neo4j Instance you connect to.
 *
 * @access public
 */
class Driver {
  private readonly _id: number
  private readonly _meta: MetaInfo
  private readonly _config: DriverConfig
  private readonly _log: Logger
  private readonly _createConnectionProvider: CreateConnectionProvider
  private _connectionProvider: ConnectionProvider | null
  private readonly _createSession: CreateSession

  /**
   * You should not be calling this directly, instead use {@link driver}.
   * @constructor
   * @protected
   * @param {Object} meta Metainformation about the driver
   * @param {Object} config
   * @param {function(id: number, config:Object, log:Logger, hostNameResolver: ConfiguredCustomResolver): ConnectionProvider } createConnectonProvider Creates the connection provider
   * @param {function(args): Session } createSession Creates the a session
  */
  constructor (
    meta: MetaInfo,
    config: DriverConfig = {},
    createConnectonProvider: CreateConnectionProvider,
    createSession: CreateSession = args => new Session(args)
  ) {
    sanitizeConfig(config)

    const log = Logger.create(config)

    validateConfig(config, log)

    this._id = idGenerator++
    this._meta = meta
    this._config = config
    this._log = log
    this._createConnectionProvider = createConnectonProvider
    this._createSession = createSession

    /**
     * Reference to the connection provider. Initialized lazily by {@link _getOrCreateConnectionProvider}.
     * @type {ConnectionProvider}
     * @protected
     */
    this._connectionProvider = null

    this._afterConstruction()
  }

  /**
   * Verifies connectivity of this driver by trying to open a connection with the provided driver options.
   *
   * @deprecated This return of this method will change in 6.0.0 to not async return the {@link ServerInfo} and
   * async return {@link void} instead. If you need to use the server info, use {@link getServerInfo} instead.
   *
   * @public
   * @param {Object} param - The object parameter
   * @param {string} param.database - The target database to verify connectivity for.
   * @returns {Promise<ServerInfo>} promise resolved with server info or rejected with error.
   */
  verifyConnectivity ({ database = '' }: { database?: string } = {}): Promise<ServerInfo> {
    const connectionProvider = this._getOrCreateConnectionProvider()
    return connectionProvider.verifyConnectivityAndGetServerInfo({ database, accessMode: READ })
  }

  /**
   * Get ServerInfo for the giver database.
   *
   * @param {Object} param - The object parameter
   * @param {string} param.database - The target database to verify connectivity for.
   * @returns {Promise<void>} promise resolved with void or rejected with error.
   */
  getServerInfo ({ database = '' }: { database?: string } = {}): Promise<ServerInfo> {
    const connectionProvider = this._getOrCreateConnectionProvider()
    return connectionProvider.verifyConnectivityAndGetServerInfo({ database, accessMode: READ })
  }

  /**
   * Returns whether the server supports multi database capabilities based on the protocol
   * version negotiated via handshake.
   *
   * Note that this function call _always_ causes a round-trip to the server.
   *
   * @returns {Promise<boolean>} promise resolved with a boolean or rejected with error.
   */
  supportsMultiDb (): Promise<boolean> {
    const connectionProvider = this._getOrCreateConnectionProvider()
    return connectionProvider.supportsMultiDb()
  }

  /**
   * Returns whether the server supports transaction config capabilities based on the protocol
   * version negotiated via handshake.
   *
   * Note that this function call _always_ causes a round-trip to the server.
   *
   * @returns {Promise<boolean>} promise resolved with a boolean or rejected with error.
   */
  supportsTransactionConfig (): Promise<boolean> {
    const connectionProvider = this._getOrCreateConnectionProvider()
    return connectionProvider.supportsTransactionConfig()
  }

  /**
   * Returns whether the server supports user impersonation capabilities based on the protocol
   * version negotiated via handshake.
   *
   * Note that this function call _always_ causes a round-trip to the server.
   *
   * @returns {Promise<boolean>} promise resolved with a boolean or rejected with error.
   */
  supportsUserImpersonation (): Promise<boolean> {
    const connectionProvider = this._getOrCreateConnectionProvider()
    return connectionProvider.supportsUserImpersonation()
  }

  /**
   * Returns the protocol version negotiated via handshake.
   *
   * Note that this function call _always_ causes a round-trip to the server.
   *
   * @returns {Promise<number>} the protocol version negotiated via handshake.
   * @throws {Error} When protocol negotiation fails
   */
  getNegotiatedProtocolVersion (): Promise<number> {
    const connectionProvider = this._getOrCreateConnectionProvider()
    return connectionProvider.getNegotiatedProtocolVersion()
  }

  /**
   * Returns boolean to indicate if driver has been configured with encryption enabled.
   *
   * @returns {boolean}
   */
  isEncrypted (): boolean {
    return this._isEncrypted()
  }

  /**
   * @protected
   * @returns {boolean}
   */
  _supportsRouting (): boolean {
    return this._meta.routing
  }

  /**
   * Returns boolean to indicate if driver has been configured with encryption enabled.
   *
   * @protected
   * @returns {boolean}
   */
  _isEncrypted (): boolean {
    return this._config.encrypted === ENCRYPTION_ON || this._config.encrypted === true
  }

  /**
   * Returns the configured trust strategy that the driver has been configured with.
   *
   * @protected
   * @returns {TrustStrategy}
   */
  _getTrust (): TrustStrategy | undefined {
    return this._config.trust
  }

  /**
   * Acquire a session to communicate with the database. The session will
   * borrow connections from the underlying connection pool as required and
   * should be considered lightweight and disposable.
   *
   * This comes with some responsibility - make sure you always call
   * {@link close} when you are done using a session, and likewise,
   * make sure you don't close your session before you are done using it. Once
   * it is closed, the underlying connection will be released to the connection
   * pool and made available for others to use.
   *
   * @public
   * @param {SessionConfig} param - The session configuration
   * @return {Session} new session.
   */
  session ({
    defaultAccessMode = WRITE,
    bookmarks: bookmarkOrBookmarks,
    database = '',
    impersonatedUser,
    fetchSize,
    bookmarkManager
  }: SessionConfig = {}): Session {
    return this._newSession({
      defaultAccessMode,
      bookmarkOrBookmarks,
      database,
      reactive: false,
      impersonatedUser,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      fetchSize: validateFetchSizeValue(fetchSize, this._config.fetchSize!),
      bookmarkManager
    })
  }

  /**
   * Close all open sessions and other associated resources. You should
   * make sure to use this when you are done with this driver instance.
   * @public
   * @return {Promise<void>} promise resolved when the driver is closed.
   */
  close (): Promise<void> {
    this._log.info(`Driver ${this._id} closing`)
    if (this._connectionProvider != null) {
      return this._connectionProvider.close()
    }
    return Promise.resolve()
  }

  /**
   * @protected
   */
  _afterConstruction (): void {
    this._log.info(
      `${this._meta.typename} driver ${this._id} created for server address ${this._meta.address.toString()}`
    )
  }

  /**
   * @private
   */
  _newSession ({
    defaultAccessMode,
    bookmarkOrBookmarks,
    database,
    reactive,
    impersonatedUser,
    fetchSize,
    bookmarkManager
  }: {
    defaultAccessMode: SessionMode
    bookmarkOrBookmarks?: string | string[]
    database: string
    reactive: boolean
    impersonatedUser?: string
    fetchSize: number
    bookmarkManager?: BookmarkManager
  }): Session {
    const sessionMode = Session._validateSessionMode(defaultAccessMode)
    const connectionProvider = this._getOrCreateConnectionProvider()
    const bookmarks = bookmarkOrBookmarks != null
      ? new Bookmarks(bookmarkOrBookmarks)
      : Bookmarks.empty()

    return this._createSession({
      mode: sessionMode,
      database: database ?? '',
      connectionProvider,
      bookmarks,
      config: this._config,
      reactive,
      impersonatedUser,
      fetchSize,
      bookmarkManager
    })
  }

  /**
   * @private
   */
  _getOrCreateConnectionProvider (): ConnectionProvider {
    if (this._connectionProvider == null) {
      this._connectionProvider = this._createConnectionProvider(
        this._id,
        this._config,
        this._log,
        createHostNameResolver(this._config)
      )
    }

    return this._connectionProvider
  }
}

/**
 * @private
 * @returns {Object} the given config.
 */
function validateConfig (config: any, log: Logger): any {
  const resolver = config.resolver
  if (resolver !== null && resolver !== undefined && typeof resolver !== 'function') {
    throw new TypeError(
      `Configured resolver should be a function. Got: ${typeof resolver}`
    )
  }

  if (config.connectionAcquisitionTimeout < config.connectionTimeout) {
    log.warn(
      'Configuration for "connectionAcquisitionTimeout" should be greater than ' +
      'or equal to "connectionTimeout". Otherwise, the connection acquisition ' +
      'timeout will take precedence for over the connection timeout in scenarios ' +
      'where a new connection is created while it is acquired'
    )
  }
  return config
}

/**
 * @private
 */
function sanitizeConfig (config: any): void {
  config.maxConnectionLifetime = sanitizeIntValue(
    config.maxConnectionLifetime,
    DEFAULT_MAX_CONNECTION_LIFETIME
  )
  config.maxConnectionPoolSize = sanitizeIntValue(
    config.maxConnectionPoolSize,
    DEFAULT_POOL_MAX_SIZE
  )
  config.connectionAcquisitionTimeout = sanitizeIntValue(
    config.connectionAcquisitionTimeout,
    DEFAULT_POOL_ACQUISITION_TIMEOUT
  )
  config.fetchSize = validateFetchSizeValue(
    config.fetchSize,
    DEFAULT_FETCH_SIZE
  )
  config.connectionTimeout = extractConnectionTimeout(config)
}

/**
 * @private
 */
function sanitizeIntValue (rawValue: any, defaultWhenAbsent: number): number {
  const sanitizedValue = parseInt(rawValue, 10)
  if (sanitizedValue > 0 || sanitizedValue === 0) {
    return sanitizedValue
  } else if (sanitizedValue < 0) {
    return Number.MAX_SAFE_INTEGER
  } else {
    return defaultWhenAbsent
  }
}

/**
 * @private
 */
function validateFetchSizeValue (
  rawValue: any,
  defaultWhenAbsent: number
): number {
  const fetchSize = parseInt(rawValue, 10)
  if (fetchSize > 0 || fetchSize === FETCH_ALL) {
    return fetchSize
  } else if (fetchSize === 0 || fetchSize < 0) {
    throw new Error(
      `The fetch size can only be a positive value or ${FETCH_ALL} for ALL. However fetchSize = ${fetchSize}`
    )
  } else {
    return defaultWhenAbsent
  }
}

/**
 * @private
 */
function extractConnectionTimeout (config: any): number | null {
  const configuredTimeout = parseInt(config.connectionTimeout, 10)
  if (configuredTimeout === 0) {
    // timeout explicitly configured to 0
    return null
  } else if (!isNaN(configuredTimeout) && configuredTimeout < 0) {
    // timeout explicitly configured to a negative value
    return null
  } else if (isNaN(configuredTimeout)) {
    // timeout not configured, use default value
    return DEFAULT_CONNECTION_TIMEOUT_MILLIS
  } else {
    // timeout configured, use the provided value
    return configuredTimeout
  }
}

/**
 * @private
 * @returns {ConfiguredCustomResolver} new custom resolver that wraps the passed-in resolver function.
 *              If resolved function is not specified, it defaults to an identity resolver.
 */
function createHostNameResolver (config: any): ConfiguredCustomResolver {
  return new ConfiguredCustomResolver(config.resolver)
}

export { Driver, READ, WRITE }
export type { SessionConfig }
export default Driver

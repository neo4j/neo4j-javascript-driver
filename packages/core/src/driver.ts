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

import ConnectionProvider from './connection-provider'
import { Bookmark } from './internal/bookmark'
import { ConnectivityVerifier } from './internal/connectivity-verifier'
import ConfiguredCustomResolver from './internal/resolver/configured-custom-resolver'

import {
  ACCESS_MODE_READ,
  ACCESS_MODE_WRITE,
  FETCH_ALL,
  DEFAULT_POOL_ACQUISITION_TIMEOUT,
  DEFAULT_POOL_MAX_SIZE
} from './internal/constants'
import { Logger } from './internal/logger'
import Session from './session'
import { ServerInfo } from './result-summary'
import { ENCRYPTION_ON, ENCRYPTION_OFF } from './internal/util'
import {
  EncryptionLevel,
  LoggingConfig,
  TrustStrategy,
  SessionMode
} from './types'
import { ServerAddress } from './internal/server-address'

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
  bookmark?: Bookmark
  database: string
  config: any
  reactive: boolean
  fetchSize: number,
  impersonatedUser?: string
}) => Session

interface DriverConfig {
  encrypted?: EncryptionLevel | boolean
  trust?: TrustStrategy
  fetchSize?: number
  logging?: LoggingConfig
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
  constructor(
    meta: MetaInfo,
    config: DriverConfig = {},
    createConnectonProvider: CreateConnectionProvider,
    createSession: CreateSession = args => new Session(args)
  ) {
    sanitizeConfig(config)
    validateConfig(config)

    this._id = idGenerator++
    this._meta = meta
    this._config = config
    this._log = Logger.create(config)
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
   * @public
   * @param {Object} param - The object parameter
   * @param {string} param.database - The target database to verify connectivity for.
   * @returns {Promise<ServerInfo>} promise resolved with server info or rejected with error.
   */
  verifyConnectivity({ database = '' }: { database?: string } = {}): Promise<
    ServerInfo
  > {
    const connectionProvider = this._getOrCreateConnectionProvider()
    const connectivityVerifier = new ConnectivityVerifier(connectionProvider)
    return connectivityVerifier.verify({ database })
  }

  /**
   * Returns whether the server supports multi database capabilities based on the protocol
   * version negotiated via handshake.
   *
   * Note that this function call _always_ causes a round-trip to the server.
   *
   * @returns {Promise<boolean>} promise resolved with a boolean or rejected with error.
   */
  supportsMultiDb(): Promise<boolean> {
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
  supportsTransactionConfig(): Promise<boolean> {
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
   supportsUserImpersonation(): Promise<boolean> {
    const connectionProvider = this._getOrCreateConnectionProvider()
    return connectionProvider.supportsUserImpersonation()
  }

  /**
   * @protected
   * @returns {boolean}
   */
  _supportsRouting(): boolean {
    return this._meta.routing
  }

  /**
   * Returns boolean to indicate if driver has been configured with encryption enabled.
   *
   * @protected
   * @returns {boolean}
   */
  _isEncrypted() {
    return this._config.encrypted === ENCRYPTION_ON
  }

  /**
   * Returns the configured trust strategy that the driver has been configured with.
   *
   * @protected
   * @returns {TrustStrategy}
   */
  _getTrust(): TrustStrategy | undefined {
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
   * @param {Object} param - The object parameter
   * @param {string} param.defaultAccessMode=WRITE - The access mode of this session, allowed values are {@link READ} and {@link WRITE}.
   * @param {string|string[]} param.bookmarks - The initial reference or references to some previous
   * transactions. Value is optional and absence indicates that that the bookmarks do not exist or are unknown.
   * @param {number} param.fetchSize - The record fetch size of each batch of this session.
   * Use {@link FETCH_ALL} to always pull all records in one batch. This will override the config value set on driver config.
   * @param {string} param.database - The database this session will operate on.
   * @param {string} param.impersonatedUser - The username which the user wants to impersonate for the duration of the session.
   * @return {Session} new session.
   */
  session({
    defaultAccessMode = WRITE,
    bookmarks: bookmarkOrBookmarks,
    database = '',
    impersonatedUser,
    fetchSize
  }: {
    defaultAccessMode?: SessionMode
    bookmarks?: string | string[]
    database?: string
    impersonatedUser?: string
    fetchSize?: number
  } = {}): Session {
    return this._newSession({
      defaultAccessMode,
      bookmarkOrBookmarks,
      database,
      reactive: false,
      impersonatedUser,
      fetchSize: validateFetchSizeValue(fetchSize, this._config.fetchSize!!)
    })
  }

  /**
   * Close all open sessions and other associated resources. You should
   * make sure to use this when you are done with this driver instance.
   * @public
   * @return {Promise<void>} promise resolved when the driver is closed.
   */
  close(): Promise<void> {
    this._log.info(`Driver ${this._id} closing`)
    if (this._connectionProvider) {
      return this._connectionProvider.close()
    }
    return Promise.resolve()
  }

  /**
   * @protected
   */
  _afterConstruction() {
    this._log.info(
      `${this._meta.typename} driver ${this._id} created for server address ${this._meta.address}`
    )
  }

  /**
   * @private
   */
  _newSession({
    defaultAccessMode,
    bookmarkOrBookmarks,
    database,
    reactive,
    impersonatedUser,
    fetchSize
  }: {
    defaultAccessMode: SessionMode
    bookmarkOrBookmarks?: string | string[]
    database: string
    reactive: boolean
    impersonatedUser?: string
    fetchSize: number
  }) {
    const sessionMode = Session._validateSessionMode(defaultAccessMode)
    const connectionProvider = this._getOrCreateConnectionProvider()
    const bookmark = bookmarkOrBookmarks
      ? new Bookmark(bookmarkOrBookmarks)
      : Bookmark.empty()
    return this._createSession({
      mode: sessionMode,
      database: database || '',
      connectionProvider,
      bookmark,
      config: this._config,
      reactive,
      impersonatedUser,
      fetchSize
    })
  }

  /**
   * @private
   */
  _getOrCreateConnectionProvider(): ConnectionProvider {
    if (!this._connectionProvider) {
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
function validateConfig(config: any): any {
  const resolver = config.resolver
  if (resolver && typeof resolver !== 'function') {
    throw new TypeError(
      `Configured resolver should be a function. Got: ${resolver}`
    )
  }
  return config
}

/**
 * @private
 */
function sanitizeConfig(config: any) {
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
}

/**
 * @private
 */
function sanitizeIntValue(rawValue: any, defaultWhenAbsent: number): number {
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
function validateFetchSizeValue(
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
 * @returns {ConfiguredCustomResolver} new custom resolver that wraps the passed-in resolver function.
 *              If resolved function is not specified, it defaults to an identity resolver.
 */
function createHostNameResolver(config: any): ConfiguredCustomResolver {
  return new ConfiguredCustomResolver(config.resolver)
}

export { Driver, READ, WRITE }

export default Driver

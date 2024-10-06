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
import Session, { TransactionConfig } from './session'
import { ServerInfo } from './result-summary'
import { ENCRYPTION_ON } from './internal/util'
import {
  EncryptionLevel,
  LoggingConfig,
  TrustStrategy,
  SessionMode,
  Query,
  AuthToken
} from './types'
import { ServerAddress } from './internal/server-address'
import BookmarkManager, { bookmarkManager } from './bookmark-manager'
import EagerResult from './result-eager'
import resultTransformers, { ResultTransformer } from './result-transformers'
import QueryExecutor from './internal/query-executor'
import { newError } from './error'
import NotificationFilter from './notification-filter'

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
  notificationFilter?: NotificationFilter
  auth?: AuthToken
  log: Logger
}) => Session

type CreateQueryExecutor = (createSession: (config: { database?: string, bookmarkManager?: BookmarkManager }) => Session) => QueryExecutor

interface DriverConfig {
  encrypted?: EncryptionLevel | boolean
  trust?: TrustStrategy
  fetchSize?: number
  logging?: LoggingConfig
  notificationFilter?: NotificationFilter
  connectionLivenessCheckTimeout?: number
}

/**
 * The session configuration
 *
 * @interface
 */
class SessionConfig {
  defaultAccessMode?: SessionMode
  bookmarks?: string | string[]
  database?: string
  impersonatedUser?: string
  fetchSize?: number
  bookmarkManager?: BookmarkManager
  notificationFilter?: NotificationFilter
  auth?: AuthToken

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
     * This option has no explicit value by default, but it is recommended to set
     * one if the target database is known in advance. This has the benefit of
     * ensuring a consistent target database name throughout the session in a
     * straightforward way and potentially simplifies driver logic as well as
     * reduces network communication resulting in better performance.
     *
     * Usage of Cypher clauses like USE is not a replacement for this option.
     * The driver does not parse any Cypher.
     *
     * When no explicit name is set, the driver behavior depends on the connection
     * URI scheme supplied to the driver on instantiation and Bolt protocol
     * version.
     *
     * Specifically, the following applies:
     *
     * - **bolt schemes** - queries are dispatched to the server for execution
     *   without explicit database name supplied, meaning that the target database
     *   name for query execution is determined by the server. It is important to
     *   note that the target database may change (even within the same session),
     *   for instance if the user's home database is changed on the server.
     *
     * - **neo4j schemes** - providing that Bolt protocol version 4.4, which was
     *   introduced with Neo4j server 4.4, or above is available, the driver
     *   fetches the user's home database name from the server on first query
     *   execution within the session and uses the fetched database name
     *   explicitly for all queries executed within the session. This ensures that
     *   the database name remains consistent within the given session. For
     *   instance, if the user's home database name is 'movies' and the server
     *   supplies it to the driver upon database name fetching for the session,
     *   all queries within that session are executed with the explicit database
     *   name 'movies' supplied. Any change to the user’s home database is
     *   reflected only in sessions created after such change takes effect. This
     *   behavior requires additional network communication. In clustered
     *   environments, it is strongly recommended to avoid a single point of
     *   failure. For instance, by ensuring that the connection URI resolves to
     *   multiple endpoints. For older Bolt protocol versions the behavior is the
     *   same as described for the **bolt schemes** above.
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
     * The {@link AuthToken} which will be used for the duration of the session.
     *
     * By default, the session will use connections authenticated with the {@link AuthToken} configured on
     * driver creation. This configuration allows switching user and/or authorization information for the
     * session lifetime.
     *
     * **Warning**: This option is only available when the driver is connected to Neo4j Database servers
     * which supports Bolt 5.1 or newer.
     *
     * @type {AuthToken|undefined}
     * @see {@link driver}
     */
    this.auth = undefined

    /**
     * The record fetch size of each batch of this session.
     *
     * Use {@link FETCH_ALL} to always pull all records in one batch. This will override the config value set on driver config.
     * **Default**: {@link DEFAULT_FETCH_SIZE}
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
     * **Warning**: Sharing the same BookmarkManager instance across multiple sessions can have a negative impact
     * on performance since all the queries will wait for the latest changes being propagated across the cluster.
     * For keeping consistency between a group of queries, use {@link Session} for grouping them.
     * For keeping consistency between a group of sessions, use {@link BookmarkManager} instance for grouping them.
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
     * const linkedResult = await linkedSession2.run('CREATE (p:Person {name: $name}) RETURN p', { name: 'Driver User'})
     *
     * await linkedSession1.close()
     * await linkedSession2.close()
     * await unlinkedSession.close()
     *
     * @type {BookmarkManager|undefined}
     * @since 5.0
     */
    this.bookmarkManager = undefined

    /**
     * Configure filter for {@link Notification} objects returned in {@link ResultSummary#notifications}.
     *
     * This configuration enables filter notifications by:
     *
     * * the minimum severity level ({@link NotificationFilterMinimumSeverityLevel})
     * * disabling notification categories ({@link NotificationFilterDisabledCategory})
     *
     *
     * Disabling notifications can be done by defining the minimum severity level to 'OFF'.
     * At driver level, when omitted, uses the server's default.
     * At session level, when omitted, defaults to what filters have been configured at driver level.
     *
     * Disabling categories or severities allows the server to skip analysis for those, which can speed up query
     * execution.
     *
     * @example
     * // enabling warning notification, but disabling `HINT` and `DEPRECATION` notifications.
     * const session = driver.session({
     *     database: 'neo4j',
     *     notificationFilter: {
     *         minimumSeverityLevel: neo4j.notificationFilterMinimumSeverityLevel.WARNING, // or 'WARNING
     *         disabledCategories: [
     *             neo4j.notificationFilterDisabledCategory.HINT, // or 'HINT'
     *             neo4j.notificationFilterDisabledCategory.DEPRECATION // or 'DEPRECATION'
     *        ]
     *     }
     * })
     *
     * @example
     * // disabling notifications for a session
     * const session = driver.session({
     *     database: 'neo4j',
     *     notificationFilter: {
     *         minimumSeverityLevel: neo4j.notificationFilterMinimumSeverityLevel.OFF // or 'OFF'
     *     }
     * })
     *
     * @example
     * // using default values configured in the driver
     * const sessionWithDefaultValues = driver.session({ database: 'neo4j' })
     * // or driver.session({ database: 'neo4j', notificationFilter: undefined })
     *
     * // using default minimum severity level, but disabling 'HINT' and 'UNRECOGNIZED'
     * // notification categories
     * const sessionWithDefaultSeverityLevel = driver.session({
     *     database: 'neo4j',
     *     notificationFilter: {
     *         disabledCategories: [
     *             neo4j.notificationFilterDisabledCategory.HINT, // or 'HINT'
     *             neo4j.notificationFilterDisabledCategory.UNRECOGNIZED // or 'UNRECOGNIZED'
     *        ]
     *     }
     * })
     *
     * // using default disabled categories, but configuring minimum severity level to 'WARNING'
     * const sessionWithDefaultSeverityLevel = driver.session({
     *     database: 'neo4j',
     *     notificationFilter: {
     *         minimumSeverityLevel: neo4j.notificationFilterMinimumSeverityLevel.WARNING // or 'WARNING'
     *     }
     * })
     *
     * @type {NotificationFilter|undefined}
     * @since 5.7
     */
    this.notificationFilter = undefined
  }
}

type RoutingControl = 'WRITE' | 'READ'
const ROUTING_WRITE: RoutingControl = 'WRITE'
const ROUTING_READ: RoutingControl = 'READ'
/**
 * @typedef {'WRITE'|'READ'} RoutingControl
 */
/**
 * Constants that represents routing modes.
 *
 * @example
 * driver.executeQuery("<QUERY>", <PARAMETERS>, { routing: neo4j.routing.WRITE })
 */
const routing = {
  WRITE: ROUTING_WRITE,
  READ: ROUTING_READ
}

Object.freeze(routing)

/**
 * The query configuration
 * @interface
 */
class QueryConfig<T = EagerResult> {
  routing?: RoutingControl
  database?: string
  impersonatedUser?: string
  bookmarkManager?: BookmarkManager | null
  resultTransformer?: ResultTransformer<T>
  transactionConfig?: TransactionConfig
  auth?: AuthToken
  signal?: AbortSignal

  /**
   * @constructor
   * @private
   */
  private constructor () {
    /**
     * Define the type of cluster member the query will be routed to.
     *
     * @type {RoutingControl}
     */
    this.routing = routing.WRITE

    /**
     * Define the transformation will be applied to the Result before return from the
     * query method.
     *
     * @type {ResultTransformer}
     * @see {@link resultTransformers} for provided implementations.
     */
    this.resultTransformer = undefined

    /**
     * The database this session will operate on.
     *
     * @type {string|undefined}
     */
    this.database = ''

    /**
     * The username which the user wants to impersonate for the duration of the query.
     *
     * @type {string|undefined}
     */
    this.impersonatedUser = undefined

    /**
     * Configure a BookmarkManager for the session to use
     *
     * A BookmarkManager is a piece of software responsible for keeping casual consistency between different pieces of work by sharing bookmarks
     * between the them.
     *
     * By default, it uses the driver's non mutable driver level bookmark manager. See, {@link Driver.executeQueryBookmarkManager}
     *
     * Can be set to null to disable causal chaining.
     * @type {BookmarkManager|undefined|null}
     */
    this.bookmarkManager = undefined

    /**
     * Configuration for all transactions started to execute the query.
     *
     * @type {TransactionConfig|undefined}
     *
     */
    this.transactionConfig = undefined

    /**
     * The {@link AuthToken} which will be used for executing the query.
     *
     * By default, the query executor will use connections authenticated with the {@link AuthToken} configured on
     * driver creation. This configuration allows switching user and/or authorization information for the
     * underlying transaction's lifetime.
     *
     * **Warning**: This option is only available when the driver is connected to Neo4j Database servers
     * which support Bolt 5.1 or newer.
     *
     * @type {AuthToken|undefined}
     * @see {@link driver}
     */
    this.auth = undefined

    /**
     * The {@link AbortSignal} for aborting query execution.
     *
     * When aborted, the signal triggers the result consumption cancelation and
     * transactions are reset. However, due to race conditions,
     * there is no guarantee the transaction will be rolled back.
     * Equivalent to {@link Session.close}
     *
     * **Warning**: This option is only available in runtime which supports AbortSignal.addEventListener.
     *
     * @since 5.22.0
     * @type {AbortSignal|undefined}
     * @experimental
     * @see https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
     */
    this.signal = undefined
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
  private readonly _defaultExecuteQueryBookmarkManager: BookmarkManager
  private readonly _queryExecutor: QueryExecutor

  /**
   * You should not be calling this directly, instead use {@link driver}.
   * @constructor
   * @protected
   * @param {Object} meta Metainformation about the driver
   * @param {Object} config
   * @param {function(id: number, config:Object, log:Logger, hostNameResolver: ConfiguredCustomResolver): ConnectionProvider } createConnectionProvider Creates the connection provider
   * @param {function(args): Session } createSession Creates the a session
  */
  constructor (
    meta: MetaInfo,
    config: DriverConfig = {},
    createConnectionProvider: CreateConnectionProvider,
    createSession: CreateSession = args => new Session(args),
    createQueryExecutor: CreateQueryExecutor = createSession => new QueryExecutor(createSession)
  ) {
    sanitizeConfig(config)

    const log = Logger.create(config)

    validateConfig(config, log)

    this._id = idGenerator++
    this._meta = meta
    this._config = config
    this._log = log
    this._createConnectionProvider = createConnectionProvider
    this._createSession = createSession
    this._defaultExecuteQueryBookmarkManager = bookmarkManager()
    this._queryExecutor = createQueryExecutor(this.session.bind(this))

    /**
     * Reference to the connection provider. Initialized lazily by {@link _getOrCreateConnectionProvider}.
     * @type {ConnectionProvider}
     * @protected
     */
    this._connectionProvider = null

    this._afterConstruction()
  }

  /**
   * The bookmark managed used by {@link Driver.executeQuery}
   *
   * @type {BookmarkManager}
   */
  get executeQueryBookmarkManager (): BookmarkManager {
    return this._defaultExecuteQueryBookmarkManager
  }

  /**
   * Executes a query in a retriable context and returns a {@link EagerResult}.
   *
   * This method is a shortcut for a {@link Session#executeRead} and {@link Session#executeWrite}.
   *
   * NOTE: Because it is an explicit transaction from the server point of view, Cypher queries using
   * "CALL {} IN TRANSACTIONS" or the older "USING PERIODIC COMMIT" construct will not work (call
   * {@link Session#run} for these).
   *
   * @example
   * // Run a simple write query
   * const { keys, records, summary } = await driver.executeQuery('CREATE (p:Person{ name: $name }) RETURN p', { name: 'Person1'})
   *
   * @example
   * // Run a read query
   * const { keys, records, summary } = await driver.executeQuery(
   *    'MATCH (p:Person{ name: $name }) RETURN p',
   *    { name: 'Person1'},
   *    { routing: neo4j.routing.READ})
   *
   * @example
   * // Run a read query returning a Person Nodes per elementId
   * const peopleMappedById = await driver.executeQuery(
   *    'MATCH (p:Person{ name: $name }) RETURN p',
   *    { name: 'Person1'},
   *    {
   *      resultTransformer: neo4j.resultTransformers.mappedResultTransformer({
   *        map(record) {
   *          const p = record.get('p')
   *          return [p.elementId, p]
   *        },
   *        collect(elementIdPersonPairArray) {
   *          return new Map(elementIdPersonPairArray)
   *        }
   *      })
   *    }
   * )
   *
   * const person = peopleMappedById.get("<ELEMENT_ID>")
   *
   * @example
   * // these lines
   * const transformedResult = await driver.executeQuery(
   *    "<QUERY>",
   *    <PARAMETERS>,
   *    {
   *       routing: neo4j.routing.WRITE,
   *       resultTransformer: transformer,
   *       database: "<DATABASE>",
   *       impersonatedUser: "<USER>",
   *       bookmarkManager: bookmarkManager
   *    })
   * // are equivalent to those
   * const session = driver.session({
   *    database: "<DATABASE>",
   *    impersonatedUser: "<USER>",
   *    bookmarkManager: bookmarkManager
   * })
   *
   * try {
   *    const transformedResult = await session.executeWrite(tx => {
   *        const result = tx.run("<QUERY>", <PARAMETERS>)
   *        return transformer(result)
   *    })
   * } finally {
   *    await session.close()
   * }
   *
   * @public
   * @param {string | {text: string, parameters?: object}} query - Cypher query to execute
   * @param {Object} parameters - Map with parameters to use in the query
   * @param {QueryConfig<T>} config - The query configuration
   * @returns {Promise<T>}
   *
   * @see {@link resultTransformers} for provided result transformers.
   */
  async executeQuery<T = EagerResult> (query: Query, parameters?: any, config: QueryConfig<T> = {}): Promise<T> {
    const bookmarkManager = config.bookmarkManager === null ? undefined : (config.bookmarkManager ?? this.executeQueryBookmarkManager)
    const resultTransformer = (config.resultTransformer ?? resultTransformers.eagerResultTransformer()) as ResultTransformer<T>
    const routingConfig: string = config.routing ?? routing.WRITE

    if (routingConfig !== routing.READ && routingConfig !== routing.WRITE) {
      throw newError(`Illegal query routing config: "${routingConfig}"`)
    }

    return await this._queryExecutor.execute({
      resultTransformer,
      bookmarkManager,
      routing: routingConfig,
      database: config.database,
      impersonatedUser: config.impersonatedUser,
      transactionConfig: config.transactionConfig,
      auth: config.auth,
      signal: config.signal
    }, query, parameters)
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
   * This method verifies the authorization credentials work by trying to acquire a connection
   * to one of the servers with the given credentials.
   *
   * @param {object} param - object parameter
   * @property {AuthToken} param.auth - the target auth for the to-be-acquired connection
   * @property {string} param.database - the target database for the to-be-acquired connection
   *
   * @returns {Promise<boolean>} promise resolved with true if succeed, false if failed with
   *  authentication issue and rejected with error if non-authentication error happens.
   */
  async verifyAuthentication ({ database, auth }: { auth?: AuthToken, database?: string } = {}): Promise<boolean> {
    const connectionProvider = this._getOrCreateConnectionProvider()
    return await connectionProvider.verifyAuthentication({
      database: database ?? 'system',
      auth,
      accessMode: READ
    })
  }

  /**
   * Get ServerInfo for the giver database.
   *
   * @param {Object} param - The object parameter
   * @param {string} param.database - The target database to verify connectivity for.
   * @returns {Promise<ServerInfo>} promise resolved with the ServerInfo or rejected with error.
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
   * Returns whether the driver session re-auth functionality capabilities based on the protocol
   * version negotiated via handshake.
   *
   * Note that this function call _always_ causes a round-trip to the server.
   *
   * @returns {Promise<boolean>} promise resolved with a boolean or rejected with error.
   */
  supportsSessionAuth (): Promise<boolean> {
    const connectionProvider = this._getOrCreateConnectionProvider()
    return connectionProvider.supportsSessionAuth()
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
    bookmarkManager,
    notificationFilter,
    auth
  }: SessionConfig = {}): Session {
    return this._newSession({
      defaultAccessMode,
      bookmarkOrBookmarks,
      database,
      reactive: false,
      impersonatedUser,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      fetchSize: validateFetchSizeValue(fetchSize, this._config.fetchSize!),
      bookmarkManager,
      notificationFilter,
      auth
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

  // eslint-disable-next-line
  // @ts-ignore
  [Symbol.asyncDispose] (): Promise<void> {
    return this.close()
  }

  /**
   * @protected
   * @returns {void}
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
    bookmarkManager,
    notificationFilter,
    auth
  }: {
    defaultAccessMode: SessionMode
    bookmarkOrBookmarks?: string | string[]
    database: string
    reactive: boolean
    impersonatedUser?: string
    fetchSize: number
    bookmarkManager?: BookmarkManager
    notificationFilter?: NotificationFilter
    auth?: AuthToken
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
      bookmarkManager,
      notificationFilter,
      auth,
      log: this._log
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

  if (config.notificationFilter?.disabledCategories != null && config.notificationFilter?.disabledClassifications != null) {
    throw new Error('The notificationFilter can\'t have both "disabledCategories" and  "disabledClassifications" configured at the same time.')
  }

  return config
}

/**
 * @private
 * @returns {void}
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

  config.connectionLivenessCheckTimeout =
    validateConnectionLivenessCheckTimeoutSizeValue(config.connectionLivenessCheckTimeout)
}

/**
 * @private
 * @returns {number}
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
 */
function validateConnectionLivenessCheckTimeoutSizeValue (
  rawValue: any
): number | undefined {
  if (rawValue == null) {
    return undefined
  }
  const connectionLivenessCheckTimeout = parseInt(rawValue, 10)
  if (connectionLivenessCheckTimeout < 0 || Number.isNaN(connectionLivenessCheckTimeout)) {
    throw new Error(
      `The connectionLivenessCheckTimeout can only be a positive value or 0 for always. However connectionLivenessCheckTimeout = ${connectionLivenessCheckTimeout}`
    )
  }
  return connectionLivenessCheckTimeout
}

/**
 * @private
 * @returns {ConfiguredCustomResolver} new custom resolver that wraps the passed-in resolver function.
 *              If resolved function is not specified, it defaults to an identity resolver.
 */
function createHostNameResolver (config: any): ConfiguredCustomResolver {
  return new ConfiguredCustomResolver(config.resolver)
}

export { Driver, READ, WRITE, routing, SessionConfig, QueryConfig }
export type { RoutingControl }
export default Driver

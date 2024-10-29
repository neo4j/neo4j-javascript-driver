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

import { FailedObserver, ResultStreamObserver } from './internal/observers.ts'
import { validateQueryAndParameters } from './internal/util.ts'
import { FETCH_ALL, ACCESS_MODE_READ, ACCESS_MODE_WRITE, TELEMETRY_APIS } from './internal/constants.ts'
import { newError } from './error.ts'
import Result from './result.ts'
import Transaction, { NonAutoCommitApiTelemetryConfig, NonAutoCommitTelemetryApis } from './transaction.ts'
import { ConnectionHolder } from './internal/connection-holder.ts'
import { TransactionExecutor } from './internal/transaction-executor.ts'
import { Bookmarks } from './internal/bookmarks.ts'
import { TxConfig } from './internal/tx-config.ts'
import ConnectionProvider from './connection-provider.ts'
import { AuthToken, Query, SessionMode } from './types.ts'
import Connection from './connection.ts'
import { NumberOrInteger } from './graph-types.ts'
import TransactionPromise from './transaction-promise.ts'
import ManagedTransaction from './transaction-managed.ts'
import BookmarkManager from './bookmark-manager.ts'
import { RecordShape } from './record.ts'
import NotificationFilter from './notification-filter.ts'
import { Logger } from './internal/logger.ts'

type ConnectionConsumer<T> = (connection: Connection) => Promise<T> | T
type TransactionWork<T> = (tx: Transaction) => Promise<T> | T
type ManagedTransactionWork<T> = (tx: ManagedTransaction) => Promise<T> | T

interface TransactionConfig {
  timeout?: NumberOrInteger
  metadata?: object
}

/**
 * A Session instance is used for handling the connection and
 * sending queries through the connection.
 * In a single session, multiple queries will be executed serially.
 * In order to execute parallel queries, multiple sessions are required.
 * @access public
 */
class Session {
  private readonly _mode: SessionMode
  private _database: string
  private readonly _reactive: boolean
  private readonly _fetchSize: number
  private readonly _readConnectionHolder: ConnectionHolder
  private readonly _writeConnectionHolder: ConnectionHolder
  private _open: boolean
  private _hasTx: boolean
  private _lastBookmarks: Bookmarks
  private _configuredBookmarks: Bookmarks
  private readonly _transactionExecutor: TransactionExecutor
  private readonly _impersonatedUser?: string
  private _databaseNameResolved: boolean
  private readonly _lowRecordWatermark: number
  private readonly _highRecordWatermark: number
  private readonly _results: Result[]
  private readonly _bookmarkManager?: BookmarkManager
  private readonly _notificationFilter?: NotificationFilter
  private readonly _log: Logger
  /**
   * @constructor
   * @protected
   * @param {Object} args
   * @param {string} args.mode the default access mode for this session.
   * @param {ConnectionProvider} args.connectionProvider - The connection provider to acquire connections from.
   * @param {Bookmarks} args.bookmarks - The initial bookmarks for this session.
   * @param {string} args.database the database name
   * @param {Object} args.config={} - This driver configuration.
   * @param {boolean} args.reactive - Whether this session should create reactive streams
   * @param {number} args.fetchSize - Defines how many records is pulled in each pulling batch
   * @param {string} args.impersonatedUser - The username which the user wants to impersonate for the duration of the session.
   * @param {AuthToken} args.auth - the target auth for the to-be-acquired connection
   * @param {NotificationFilter} args.notificationFilter - The notification filter used for this session.
   */
  constructor ({
    mode,
    connectionProvider,
    bookmarks,
    database,
    config,
    reactive,
    fetchSize,
    impersonatedUser,
    bookmarkManager,
    notificationFilter,
    auth,
    log
  }: {
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
  }) {
    this._mode = mode
    this._database = database
    this._reactive = reactive
    this._fetchSize = fetchSize
    this._onDatabaseNameResolved = this._onDatabaseNameResolved.bind(this)
    this._getConnectionAcquistionBookmarks = this._getConnectionAcquistionBookmarks.bind(this)
    this._readConnectionHolder = new ConnectionHolder({
      mode: ACCESS_MODE_READ,
      auth,
      database,
      bookmarks,
      connectionProvider,
      impersonatedUser,
      onDatabaseNameResolved: this._onDatabaseNameResolved,
      getConnectionAcquistionBookmarks: this._getConnectionAcquistionBookmarks,
      log
    })
    this._writeConnectionHolder = new ConnectionHolder({
      mode: ACCESS_MODE_WRITE,
      auth,
      database,
      bookmarks,
      connectionProvider,
      impersonatedUser,
      onDatabaseNameResolved: this._onDatabaseNameResolved,
      getConnectionAcquistionBookmarks: this._getConnectionAcquistionBookmarks,
      log
    })
    this._open = true
    this._hasTx = false
    this._impersonatedUser = impersonatedUser
    this._lastBookmarks = bookmarks ?? Bookmarks.empty()
    this._configuredBookmarks = this._lastBookmarks
    this._transactionExecutor = _createTransactionExecutor(config)
    this._databaseNameResolved = this._database !== ''
    const calculatedWatermaks = this._calculateWatermaks()
    this._lowRecordWatermark = calculatedWatermaks.low
    this._highRecordWatermark = calculatedWatermaks.high
    this._results = []
    this._bookmarkManager = bookmarkManager
    this._notificationFilter = notificationFilter
    this._log = log
  }

  /**
   * Run Cypher query
   * Could be called with a query object i.e.: `{text: "MATCH ...", parameters: {param: 1}}`
   * or with the query and parameters as separate arguments.
   *
   * @public
   * @param {mixed} query - Cypher query to execute
   * @param {Object} parameters - Map with parameters to use in query
   * @param {TransactionConfig} [transactionConfig] - Configuration for the new auto-commit transaction.
   * @return {Result} New Result.
   */
  run<R extends RecordShape = RecordShape> (
    query: Query,
    parameters?: any,
    transactionConfig?: TransactionConfig
  ): Result<R> {
    const { validatedQuery, params } = validateQueryAndParameters(
      query,
      parameters
    )
    const autoCommitTxConfig = (transactionConfig != null)
      ? new TxConfig(transactionConfig, this._log)
      : TxConfig.empty()

    const result = this._run(validatedQuery, params, async connection => {
      const bookmarks = await this._bookmarks()
      this._assertSessionIsOpen()
      return connection.run(validatedQuery, params, {
        bookmarks,
        txConfig: autoCommitTxConfig,
        mode: this._mode,
        database: this._database,
        apiTelemetryConfig: {
          api: TELEMETRY_APIS.AUTO_COMMIT_TRANSACTION
        },
        impersonatedUser: this._impersonatedUser,
        afterComplete: (meta: any) => this._onCompleteCallback(meta, bookmarks),
        reactive: this._reactive,
        fetchSize: this._fetchSize,
        lowRecordWatermark: this._lowRecordWatermark,
        highRecordWatermark: this._highRecordWatermark,
        notificationFilter: this._notificationFilter
      })
    })
    this._results.push(result)
    return result
  }

  _run <T extends ResultStreamObserver = ResultStreamObserver>(
    query: Query,
    parameters: any,
    customRunner: ConnectionConsumer<T>
  ): Result {
    const { connectionHolder, resultPromise } = this._acquireAndConsumeConnection(customRunner)
    const observerPromise = resultPromise.catch(error => Promise.resolve(new FailedObserver({ error })))
    const watermarks = { high: this._highRecordWatermark, low: this._lowRecordWatermark }
    return new Result(observerPromise, query, parameters, connectionHolder, watermarks)
  }

  /**
   * This method is used by Rediscovery on the neo4j-driver-bolt-protocol package.
   *
   * @private
   * @param {function()} connectionConsumer The method which will use the connection
   * @returns {Promise<T>} A connection promise
   */
  _acquireConnection<T> (connectionConsumer: ConnectionConsumer<T>): Promise<T> {
    const { connectionHolder, resultPromise } = this._acquireAndConsumeConnection(connectionConsumer)

    return resultPromise.then(async (result: T) => {
      await connectionHolder.releaseConnection()
      return result
    })
  }

  /**
   * Acquires a {@link Connection}, consume it and return a promise of the result along with
   * the {@link ConnectionHolder} used in the process.
   *
   * @private
   * @param connectionConsumer
   * @returns {object} The connection holder and connection promise.
   */

  private _acquireAndConsumeConnection<T>(connectionConsumer: ConnectionConsumer<T>): {
    connectionHolder: ConnectionHolder
    resultPromise: Promise<T>
  } {
    let resultPromise: Promise<T>
    const connectionHolder = this._connectionHolderWithMode(this._mode)
    if (!this._open) {
      resultPromise = Promise.reject(
        newError('Cannot run query in a closed session.')
      )
    } else if (!this._hasTx && connectionHolder.initializeConnection()) {
      resultPromise = connectionHolder
        .getConnection()
        // Connection won't be null at this point since the initialize method
        // return
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        .then(connection => connectionConsumer(connection!))
    } else {
      resultPromise = Promise.reject(
        newError(
          'Queries cannot be run directly on a ' +
            'session with an open transaction; either run from within the ' +
            'transaction or use a different session.'
        )
      )
    }

    return { connectionHolder, resultPromise }
  }

  /**
   * Begin a new transaction in this session. A session can have at most one transaction running at a time, if you
   * want to run multiple concurrent transactions, you should use multiple concurrent sessions.
   *
   * While a transaction is open the session cannot be used to run queries outside the transaction.
   *
   * @param {TransactionConfig} [transactionConfig] - Configuration for the new auto-commit transaction.
   * @returns {TransactionPromise} New Transaction.
   */
  beginTransaction (transactionConfig?: TransactionConfig): TransactionPromise {
    // this function needs to support bookmarks parameter for backwards compatibility
    // parameter was of type {string|string[]} and represented either a single or multiple bookmarks
    // that's why we need to check parameter type and decide how to interpret the value
    const arg = transactionConfig

    let txConfig = TxConfig.empty()
    if (arg != null) {
      txConfig = new TxConfig(arg, this._log)
    }

    return this._beginTransaction(this._mode, txConfig, { api: TELEMETRY_APIS.UNMANAGED_TRANSACTION })
  }

  _beginTransaction (accessMode: SessionMode, txConfig: TxConfig, apiTelemetryConfig?: NonAutoCommitApiTelemetryConfig): TransactionPromise {
    if (!this._open) {
      throw newError('Cannot begin a transaction on a closed session.')
    }
    if (this._hasTx) {
      throw newError(
        'You cannot begin a transaction on a session with an open transaction; ' +
          'either run from within the transaction or use a different session.'
      )
    }

    const mode = Session._validateSessionMode(accessMode)
    const connectionHolder = this._connectionHolderWithMode(mode)
    connectionHolder.initializeConnection()
    this._hasTx = true

    const tx = new TransactionPromise({
      connectionHolder,
      impersonatedUser: this._impersonatedUser,
      onClose: this._transactionClosed.bind(this),
      onBookmarks: (newBm, oldBm, db) => this._updateBookmarks(newBm, oldBm, db),
      onConnection: this._assertSessionIsOpen.bind(this),
      reactive: this._reactive,
      fetchSize: this._fetchSize,
      lowRecordWatermark: this._lowRecordWatermark,
      highRecordWatermark: this._highRecordWatermark,
      notificationFilter: this._notificationFilter,
      apiTelemetryConfig
    })
    tx._begin(() => this._bookmarks(), txConfig)
    return tx
  }

  /**
   * @private
   * @returns {void}
   */
  _assertSessionIsOpen (): void {
    if (!this._open) {
      throw newError('You cannot run more transactions on a closed session.')
    }
  }

  /**
   * @private
   * @returns {void}
   */
  _transactionClosed (): void {
    this._hasTx = false
  }

  /**
   * Return the bookmarks received following the last completed {@link Transaction}.
   *
   * @deprecated This method will be removed in version 6.0. Please, use {@link Session#lastBookmarks} instead.
   *
   * @return {string[]} A reference to a previous transaction.
   * @see {@link Session#lastBookmarks}
   */
  lastBookmark (): string[] {
    return this.lastBookmarks()
  }

  /**
   * Return the bookmarks received following the last completed {@link Transaction}.
   *
   * @return {string[]} A reference to a previous transaction.
   */
  lastBookmarks (): string[] {
    return this._lastBookmarks.values()
  }

  private async _bookmarks (): Promise<Bookmarks> {
    const bookmarks = await this._bookmarkManager?.getBookmarks()
    if (bookmarks === undefined) {
      return this._lastBookmarks
    }
    return new Bookmarks([...bookmarks, ...this._configuredBookmarks])
  }

  /**
   * Execute given unit of work in a {@link READ} transaction.
   *
   * Transaction will automatically be committed unless the given function throws or returns a rejected promise.
   * Some failures of the given function or the commit itself will be retried with exponential backoff with initial
   * delay of 1 second and maximum retry time of 30 seconds. Maximum retry time is configurable via driver config's
   * `maxTransactionRetryTime` property in milliseconds.
   *
   * @deprecated This method will be removed in version 6.0. Please, use {@link Session#executeRead} instead.
   *
   * @param {function(tx: Transaction): Promise} transactionWork - Callback that executes operations against
   * a given {@link Transaction}.
   * @param {TransactionConfig} [transactionConfig] - Configuration for all transactions started to execute the unit of work.
   * @return {Promise} Resolved promise as returned by the given function or rejected promise when given
   * function or commit fails.
   * @see {@link Session#executeRead}
   */
  readTransaction<T>(
    transactionWork: TransactionWork<T>,
    transactionConfig?: TransactionConfig
  ): Promise<T> {
    const config = new TxConfig(transactionConfig, this._log)
    return this._runTransaction(ACCESS_MODE_READ, config, transactionWork)
  }

  /**
   * Execute given unit of work in a {@link WRITE} transaction.
   *
   * Transaction will automatically be committed unless the given function throws or returns a rejected promise.
   * Some failures of the given function or the commit itself will be retried with exponential backoff with initial
   * delay of 1 second and maximum retry time of 30 seconds. Maximum retry time is configurable via driver config's
   * `maxTransactionRetryTime` property in milliseconds.
   *
   * @deprecated This method will be removed in version 6.0. Please, use {@link Session#executeWrite} instead.
   *
   * @param {function(tx: Transaction): Promise} transactionWork - Callback that executes operations against
   * a given {@link Transaction}.
   * @param {TransactionConfig} [transactionConfig] - Configuration for all transactions started to execute the unit of work.
   * @return {Promise} Resolved promise as returned by the given function or rejected promise when given
   * function or commit fails.
   * @see {@link Session#executeWrite}
   */
  writeTransaction<T>(
    transactionWork: TransactionWork<T>,
    transactionConfig?: TransactionConfig
  ): Promise<T> {
    const config = new TxConfig(transactionConfig, this._log)
    return this._runTransaction(ACCESS_MODE_WRITE, config, transactionWork)
  }

  _runTransaction<T>(
    accessMode: SessionMode,
    transactionConfig: TxConfig,
    transactionWork: TransactionWork<T>
  ): Promise<T> {
    return this._transactionExecutor.execute(
      (apiTelemetryConfig?: NonAutoCommitApiTelemetryConfig) => this._beginTransaction(accessMode, transactionConfig, apiTelemetryConfig),
      transactionWork
    )
  }

  /**
   * Execute given unit of work in a {@link READ} transaction.
   *
   * Transaction will automatically be committed unless the given function throws or returns a rejected promise.
   * Some failures of the given function or the commit itself will be retried with exponential backoff with initial
   * delay of 1 second and maximum retry time of 30 seconds. Maximum retry time is configurable via driver config's
   * `maxTransactionRetryTime` property in milliseconds.
   *
   * NOTE: Because it is an explicit transaction from the server point of view, Cypher queries using
   * "CALL {} IN TRANSACTIONS" or the older "USING PERIODIC COMMIT" construct will not work (call
   * {@link Session#run} for these).
   *
   * @param {function(tx: ManagedTransaction): Promise} transactionWork - Callback that executes operations against
   * a given {@link Transaction}.
   * @param {TransactionConfig} [transactionConfig] - Configuration for all transactions started to execute the unit of work.
   * @return {Promise} Resolved promise as returned by the given function or rejected promise when given
   * function or commit fails.
   */
  executeRead<T>(
    transactionWork: ManagedTransactionWork<T>,
    transactionConfig?: TransactionConfig
  ): Promise<T> {
    const config = new TxConfig(transactionConfig, this._log)
    return this._executeInTransaction(ACCESS_MODE_READ, config, transactionWork)
  }

  /**
   * Execute given unit of work in a {@link WRITE} transaction.
   *
   * Transaction will automatically be committed unless the given function throws or returns a rejected promise.
   * Some failures of the given function or the commit itself will be retried with exponential backoff with initial
   * delay of 1 second and maximum retry time of 30 seconds. Maximum retry time is configurable via driver config's
   * `maxTransactionRetryTime` property in milliseconds.
   *
   * NOTE: Because it is an explicit transaction from the server point of view, Cypher queries using
   * "CALL {} IN TRANSACTIONS" or the older "USING PERIODIC COMMIT" construct will not work (call
   * {@link Session#run} for these).
   *
   * @param {function(tx: ManagedTransaction): Promise} transactionWork - Callback that executes operations against
   * a given {@link Transaction}.
   * @param {TransactionConfig} [transactionConfig] - Configuration for all transactions started to execute the unit of work.
   * @return {Promise} Resolved promise as returned by the given function or rejected promise when given
   * function or commit fails.
   */
  executeWrite<T>(
    transactionWork: ManagedTransactionWork<T>,
    transactionConfig?: TransactionConfig
  ): Promise<T> {
    const config = new TxConfig(transactionConfig, this._log)
    return this._executeInTransaction(ACCESS_MODE_WRITE, config, transactionWork)
  }

  /**
   * @private
   * @param {SessionMode} accessMode
   * @param {TxConfig} transactionConfig
   * @param {ManagedTransactionWork} transactionWork
   * @returns {Promise}
   */
  private _executeInTransaction<T>(
    accessMode: SessionMode,
    transactionConfig: TxConfig,
    transactionWork: ManagedTransactionWork<T>
  ): Promise<T> {
    return this._transactionExecutor.execute(
      (apiTelemetryConfig?: NonAutoCommitApiTelemetryConfig) => this._beginTransaction(accessMode, transactionConfig, apiTelemetryConfig),
      transactionWork,
      ManagedTransaction.fromTransaction
    )
  }

  /**
   * Sets the resolved database name in the session context.
   * @private
   * @param {string|undefined} database The resolved database name
   * @returns {void}
   */
  _onDatabaseNameResolved (database?: string): void {
    if (!this._databaseNameResolved) {
      const normalizedDatabase = database ?? ''
      this._database = normalizedDatabase
      this._readConnectionHolder.setDatabase(normalizedDatabase)
      this._writeConnectionHolder.setDatabase(normalizedDatabase)
      this._databaseNameResolved = true
    }
  }

  private async _getConnectionAcquistionBookmarks (): Promise<Bookmarks> {
    const bookmarks = await this._bookmarkManager?.getBookmarks()
    if (bookmarks === undefined) {
      return this._lastBookmarks
    }
    return new Bookmarks([...this._configuredBookmarks, ...bookmarks])
  }

  /**
   * Update value of the last bookmarks.
   * @private
   * @param {Bookmarks} newBookmarks - The new bookmarks.
   * @returns {void}
   */
  _updateBookmarks (newBookmarks?: Bookmarks, previousBookmarks?: Bookmarks, database?: string): void {
    if ((newBookmarks != null) && !newBookmarks.isEmpty()) {
      this._bookmarkManager?.updateBookmarks(
        previousBookmarks?.values() ?? [],
        newBookmarks?.values() ?? []
      ).catch(() => {})
      this._lastBookmarks = newBookmarks
      this._configuredBookmarks = Bookmarks.empty()
    }
  }

  /**
   * Close this session.
   * @return {Promise}
   */
  async close (): Promise<void> {
    if (this._open) {
      this._open = false

      this._results.forEach(result => result._cancel())

      this._transactionExecutor.close()

      await this._readConnectionHolder.close(this._hasTx)
      await this._writeConnectionHolder.close(this._hasTx)
    }
  }

  // eslint-disable-next-line
  // @ts-ignore
  [Symbol.asyncDispose] (): Promise<void> {
    return this.close()
  }

  _connectionHolderWithMode (mode: SessionMode): ConnectionHolder {
    if (mode === ACCESS_MODE_READ) {
      return this._readConnectionHolder
    } else if (mode === ACCESS_MODE_WRITE) {
      return this._writeConnectionHolder
    } else {
      throw newError('Unknown access mode: ' + (mode as string))
    }
  }

  /**
   * @private
   * @param {Object} meta Connection metadatada
   * @returns {void}
   */
  _onCompleteCallback (meta: { bookmark: string | string[], db?: string }, previousBookmarks?: Bookmarks): void {
    this._updateBookmarks(new Bookmarks(meta.bookmark), previousBookmarks, meta.db)
  }

  /**
   * @private
   * @returns {void}
   */
  private _calculateWatermaks (): { low: number, high: number } {
    if (this._fetchSize === FETCH_ALL) {
      return {
        low: Number.MAX_VALUE, // we shall always lower than this number to enable auto pull
        high: Number.MAX_VALUE // we shall never reach this number to disable auto pull
      }
    }
    return {
      low: 0.3 * this._fetchSize,
      high: 0.7 * this._fetchSize
    }
  }

  /**
   * Configure the transaction executor
   *
   * This used by {@link Driver#executeQuery}
   * @private
   * @returns {void}
   */
  private _configureTransactionExecutor (pipelined: boolean, telemetryApi: NonAutoCommitTelemetryApis): void {
    this._transactionExecutor.pipelineBegin = pipelined
    this._transactionExecutor.telemetryApi = telemetryApi
  }

  /**
   * @protected
   */
  static _validateSessionMode (rawMode?: SessionMode): SessionMode {
    const mode: string = rawMode ?? ACCESS_MODE_WRITE
    if (mode !== ACCESS_MODE_READ && mode !== ACCESS_MODE_WRITE) {
      throw newError('Illegal session mode ' + mode)
    }
    return mode as SessionMode
  }
}

/**
 * @private
 * @param {object} config
 * @returns {TransactionExecutor} The transaction executor
 */
function _createTransactionExecutor (config?: {
  maxTransactionRetryTime: number | null
}): TransactionExecutor {
  const maxRetryTimeMs = config?.maxTransactionRetryTime ?? null
  return new TransactionExecutor(maxRetryTimeMs)
}

export default Session
export type { TransactionConfig }

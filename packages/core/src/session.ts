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
import { ResultStreamObserver, FailedObserver } from './internal/observers'
import { validateQueryAndParameters } from './internal/util'
import { newError } from './error'
import Result from './result'
import Transaction from './transaction'
import { ConnectionHolder } from './internal/connection-holder'
import { ACCESS_MODE_READ, ACCESS_MODE_WRITE } from './internal/constants'
import { TransactionExecutor } from './internal/transaction-executor'
import { Bookmark } from './internal/bookmark'
import { TxConfig } from './internal/tx-config'
import ConnectionProvider from './connection-provider'
import { Query, SessionMode } from './types'
import Connection from './connection'
import { NumberOrInteger } from './graph-types'

type ConnectionConsumer = (connection: Connection | void) => any | undefined
type TransactionWork<T> = (tx: Transaction) => Promise<T> | T

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
  private _mode: SessionMode
  private _database: string
  private _reactive: boolean
  private _fetchSize: number
  private _readConnectionHolder: ConnectionHolder
  private _writeConnectionHolder: ConnectionHolder
  private _open: boolean
  private _hasTx: boolean
  private _lastBookmark: Bookmark
  private _transactionExecutor: TransactionExecutor
  private _impersonatedUser?: string
  private _onComplete: (meta: any) => void
  private _databaseNameResolved: boolean

  /**
   * @constructor
   * @protected
   * @param {Object} args
   * @param {string} args.mode the default access mode for this session.
   * @param {ConnectionProvider} args.connectionProvider - The connection provider to acquire connections from.
   * @param {Bookmark} args.bookmark - The initial bookmark for this session.
   * @param {string} args.database the database name
   * @param {Object} args.config={} - This driver configuration.
   * @param {boolean} args.reactive - Whether this session should create reactive streams
   * @param {number} args.fetchSize - Defines how many records is pulled in each pulling batch
   * @param {string} args.impersonatedUser - The username which the user wants to impersonate for the duration of the session.
   */
  constructor({
    mode,
    connectionProvider,
    bookmark,
    database,
    config,
    reactive,
    fetchSize,
    impersonatedUser
  }: {
    mode: SessionMode
    connectionProvider: ConnectionProvider
    bookmark?: Bookmark
    database: string
    config: any
    reactive: boolean
    fetchSize: number,
    impersonatedUser?: string
  }) {
    this._mode = mode
    this._database = database
    this._reactive = reactive
    this._fetchSize = fetchSize
    this._onDatabaseNameResolved = this._onDatabaseNameResolved.bind(this)
    this._readConnectionHolder = new ConnectionHolder({
      mode: ACCESS_MODE_READ,
      database,
      bookmark,
      connectionProvider,
      impersonatedUser,
      onDatabaseNameResolved: this._onDatabaseNameResolved
    })
    this._writeConnectionHolder = new ConnectionHolder({
      mode: ACCESS_MODE_WRITE,
      database,
      bookmark,
      connectionProvider,
      impersonatedUser,
      onDatabaseNameResolved: this._onDatabaseNameResolved
    })
    this._open = true
    this._hasTx = false
    this._impersonatedUser = impersonatedUser
    this._lastBookmark = bookmark || Bookmark.empty()
    this._transactionExecutor = _createTransactionExecutor(config)
    this._onComplete = this._onCompleteCallback.bind(this)
    this._databaseNameResolved = this._database !== ''
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
  run(
    query: Query,
    parameters?: any,
    transactionConfig?: TransactionConfig
  ): Result {
    const { validatedQuery, params } = validateQueryAndParameters(
      query,
      parameters
    )
    const autoCommitTxConfig = transactionConfig
      ? new TxConfig(transactionConfig)
      : TxConfig.empty()

    return this._run(validatedQuery, params, connection => {
      this._assertSessionIsOpen()
      return (connection as Connection).protocol().run(validatedQuery, params, {
        bookmark: this._lastBookmark,
        txConfig: autoCommitTxConfig,
        mode: this._mode,
        database: this._database,
        impersonatedUser: this._impersonatedUser,
        afterComplete: this._onComplete,
        reactive: this._reactive,
        fetchSize: this._fetchSize
      })
    })
  }

  _run(
    query: Query,
    parameters: any,
    customRunner: ConnectionConsumer
  ): Result {
    const connectionHolder = this._connectionHolderWithMode(this._mode)

    let observerPromise
    if (!this._open) {
      observerPromise = Promise.resolve(
        new FailedObserver({
          error: newError('Cannot run query in a closed session.')
        })
      )
    } else if (!this._hasTx && connectionHolder.initializeConnection()) {
      observerPromise = connectionHolder
        .getConnection()
        .then(connection => customRunner(connection))
        .catch(error => Promise.resolve(new FailedObserver({ error })))
    } else {
      observerPromise = Promise.resolve(
        new FailedObserver({
          error: newError(
            'Queries cannot be run directly on a ' +
              'session with an open transaction; either run from within the ' +
              'transaction or use a different session.'
          )
        })
      )
    }
    return new Result(observerPromise, query, parameters, connectionHolder)
  }

  async _acquireConnection(connectionConsumer: ConnectionConsumer) {
    let promise
    const connectionHolder = this._connectionHolderWithMode(this._mode)
    if (!this._open) {
      promise = Promise.reject(
        newError('Cannot run query in a closed session.')
      )
    } else if (!this._hasTx && connectionHolder.initializeConnection()) {
      promise = connectionHolder
        .getConnection()
        .then(connection => connectionConsumer(connection))
        .then(async result => {
          await connectionHolder.releaseConnection()
          return result
        })
    } else {
      promise = Promise.reject(
        newError(
          'Queries cannot be run directly on a ' +
            'session with an open transaction; either run from within the ' +
            'transaction or use a different session.'
        )
      )
    }

    return promise
  }

  /**
   * Begin a new transaction in this session. A session can have at most one transaction running at a time, if you
   * want to run multiple concurrent transactions, you should use multiple concurrent sessions.
   *
   * While a transaction is open the session cannot be used to run queries outside the transaction.
   *
   * @param {TransactionConfig} [transactionConfig] - Configuration for the new auto-commit transaction.
   * @returns {Transaction} New Transaction.
   */
  beginTransaction(transactionConfig?: TransactionConfig): Transaction {
    // this function needs to support bookmarks parameter for backwards compatibility
    // parameter was of type {string|string[]} and represented either a single or multiple bookmarks
    // that's why we need to check parameter type and decide how to interpret the value
    const arg = transactionConfig

    let txConfig = TxConfig.empty()
    if (arg) {
      txConfig = new TxConfig(arg)
    }

    return this._beginTransaction(this._mode, txConfig)
  }

  _beginTransaction(accessMode: SessionMode, txConfig: TxConfig): Transaction {
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

    const tx = new Transaction({
      connectionHolder,
      impersonatedUser: this._impersonatedUser,
      onClose: this._transactionClosed.bind(this),
      onBookmark: this._updateBookmark.bind(this),
      onConnection: this._assertSessionIsOpen.bind(this),
      reactive: this._reactive,
      fetchSize: this._fetchSize
    })
    tx._begin(this._lastBookmark, txConfig)
    return tx
  }

  /**
   * @private
   * @returns {void}
   */
  _assertSessionIsOpen() {
    if (!this._open) {
      throw newError('You cannot run more transactions on a closed session.')
    }
  }

  /**
   * @private
   * @returns {void}
   */
  _transactionClosed() {
    this._hasTx = false
  }

  /**
   * Return the bookmark received following the last completed {@link Transaction}.
   *
   * @return {string[]} A reference to a previous transaction.
   */
  lastBookmark(): string[] {
    return this._lastBookmark.values()
  }

  /**
   * Execute given unit of work in a {@link READ} transaction.
   *
   * Transaction will automatically be committed unless the given function throws or returns a rejected promise.
   * Some failures of the given function or the commit itself will be retried with exponential backoff with initial
   * delay of 1 second and maximum retry time of 30 seconds. Maximum retry time is configurable via driver config's
   * `maxTransactionRetryTime` property in milliseconds.
   *
   * @param {function(tx: Transaction): Promise} transactionWork - Callback that executes operations against
   * a given {@link Transaction}.
   * @param {TransactionConfig} [transactionConfig] - Configuration for all transactions started to execute the unit of work.
   * @return {Promise} Resolved promise as returned by the given function or rejected promise when given
   * function or commit fails.
   */
  readTransaction<T>(
    transactionWork: TransactionWork<T>,
    transactionConfig?: TransactionConfig
  ): Promise<T> {
    const config = new TxConfig(transactionConfig)
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
   * @param {function(tx: Transaction): Promise} transactionWork - Callback that executes operations against
   * a given {@link Transaction}.
   * @param {TransactionConfig} [transactionConfig] - Configuration for all transactions started to execute the unit of work.
   * @return {Promise} Resolved promise as returned by the given function or rejected promise when given
   * function or commit fails.
   */
  writeTransaction<T>(
    transactionWork: TransactionWork<T>,
    transactionConfig?: TransactionConfig
  ): Promise<T> {
    const config = new TxConfig(transactionConfig)
    return this._runTransaction(ACCESS_MODE_WRITE, config, transactionWork)
  }

  _runTransaction<T>(
    accessMode: SessionMode,
    transactionConfig: TxConfig,
    transactionWork: TransactionWork<T>
  ): Promise<T> {
    return this._transactionExecutor.execute(
      () => this._beginTransaction(accessMode, transactionConfig),
      transactionWork
    )
  }

  /**
   * Sets the resolved database name in the session context.
   * @private
   * @param {string|undefined} database The resolved database name
   * @returns {void}
   */
  _onDatabaseNameResolved(database?: string): void {
    if (!this._databaseNameResolved) {
      const normalizedDatabase = database || ''
      this._database = normalizedDatabase
      this._readConnectionHolder.setDatabase(normalizedDatabase)
      this._writeConnectionHolder.setDatabase(normalizedDatabase)
      this._databaseNameResolved = true
    }
  }

  /**
   * Update value of the last bookmark.
   * @private
   * @param {Bookmark} newBookmark - The new bookmark.
   * @returns {void}
   */
  _updateBookmark(newBookmark?: Bookmark): void {
    if (newBookmark && !newBookmark.isEmpty()) {
      this._lastBookmark = newBookmark
    }
  }

  /**
   * Close this session.
   * @return {Promise}
   */
  async close(): Promise<void> {
    if (this._open) {
      this._open = false
      this._transactionExecutor.close()

      await this._readConnectionHolder.close()
      await this._writeConnectionHolder.close()
    }
  }

  _connectionHolderWithMode(mode: SessionMode): ConnectionHolder {
    if (mode === ACCESS_MODE_READ) {
      return this._readConnectionHolder
    } else if (mode === ACCESS_MODE_WRITE) {
      return this._writeConnectionHolder
    } else {
      throw newError('Unknown access mode: ' + mode)
    }
  }

  /**
   * @private
   * @param {Object} meta Connection metadatada
   * @returns {void}
   */
  _onCompleteCallback(meta: { bookmark: string | string[] }): void {
    this._updateBookmark(new Bookmark(meta.bookmark))
  }

  /**
   * @protected
   */
  static _validateSessionMode(rawMode?: SessionMode): SessionMode {
    const mode = rawMode || ACCESS_MODE_WRITE
    if (mode !== ACCESS_MODE_READ && mode !== ACCESS_MODE_WRITE) {
      throw newError('Illegal session mode ' + mode)
    }
    return mode
  }
}

/**
 * @private
 * @param {object} config
 * @returns {TransactionExecutor} The transaction executor
 */
function _createTransactionExecutor(config?: {
  maxTransactionRetryTime: number | null
}): TransactionExecutor {
  const maxRetryTimeMs =
    config && config.maxTransactionRetryTime
      ? config.maxTransactionRetryTime
      : null
  return new TransactionExecutor(maxRetryTimeMs)
}

export default Session
export type { TransactionConfig }

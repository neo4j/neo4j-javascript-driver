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
import {
  ResultStreamObserver,
  FailedObserver
} from './internal/stream-observers'
import Result from './result'
import Transaction from './transaction'
import { newError } from './error'
import { validateQueryAndParameters } from './internal/util'
import ConnectionHolder from './internal/connection-holder'
import Driver from './driver'
import { ACCESS_MODE_READ, ACCESS_MODE_WRITE } from './internal/constants'
import TransactionExecutor from './internal/transaction-executor'
import Bookmark from './internal/bookmark'
import TxConfig from './internal/tx-config'

/**
 * A Session instance is used for handling the connection and
 * sending queries through the connection.
 * In a single session, multiple queries will be executed serially.
 * In order to execute parallel queries, multiple sessions are required.
 * @access public
 */
class Session {
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
   */
  constructor ({
    mode,
    connectionProvider,
    bookmark,
    database,
    config,
    reactive,
    fetchSize
  }) {
    this._mode = mode
    this._database = database
    this._reactive = reactive
    this._fetchSize = fetchSize
    this._readConnectionHolder = new ConnectionHolder({
      mode: ACCESS_MODE_READ,
      database,
      bookmark,
      connectionProvider
    })
    this._writeConnectionHolder = new ConnectionHolder({
      mode: ACCESS_MODE_WRITE,
      database,
      bookmark,
      connectionProvider
    })
    this._open = true
    this._hasTx = false
    this._lastBookmark = bookmark
    this._transactionExecutor = _createTransactionExecutor(config)
    this._onComplete = this._onCompleteCallback.bind(this)
  }

  /**
   * Run Cypher query
   * Could be called with a query object i.e.: `{text: "MATCH ...", prameters: {param: 1}}`
   * or with the query and parameters as separate arguments.
   *
   * @public
   * @param {mixed} query - Cypher query to execute
   * @param {Object} parameters - Map with parameters to use in query
   * @param {TransactionConfig} [transactionConfig] - Configuration for the new auto-commit transaction.
   * @return {Result} New Result.
   */
  run (query, parameters, transactionConfig) {
    const { validatedQuery, params } = validateQueryAndParameters(
      query,
      parameters
    )
    const autoCommitTxConfig = transactionConfig
      ? new TxConfig(transactionConfig)
      : TxConfig.empty()

    return this._run(validatedQuery, params, connection => {
      this._assertSessionIsOpen()
      return connection.protocol().run(validatedQuery, params, {
        bookmark: this._lastBookmark,
        txConfig: autoCommitTxConfig,
        mode: this._mode,
        database: this._database,
        afterComplete: this._onComplete,
        reactive: this._reactive,
        fetchSize: this._fetchSize
      })
    })
  }

  _run (query, parameters, customRunner) {
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

  /**
   * Begin a new transaction in this session. A session can have at most one transaction running at a time, if you
   * want to run multiple concurrent transactions, you should use multiple concurrent sessions.
   *
   * While a transaction is open the session cannot be used to run queries outside the transaction.
   *
   * @param {TransactionConfig} [transactionConfig] - Configuration for the new auto-commit transaction.
   * @returns {Transaction} New Transaction.
   */
  beginTransaction (transactionConfig) {
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

  _beginTransaction (accessMode, txConfig) {
    if (!this._open) {
      throw newError('Cannot begin a transaction on a closed session.')
    }
    if (this._hasTx) {
      throw newError(
        'You cannot begin a transaction on a session with an open transaction; ' +
          'either run from within the transaction or use a different session.'
      )
    }

    const mode = Driver._validateSessionMode(accessMode)
    const connectionHolder = this._connectionHolderWithMode(mode)
    connectionHolder.initializeConnection()
    this._hasTx = true

    const tx = new Transaction({
      connectionHolder,
      onClose: this._transactionClosed.bind(this),
      onBookmark: this._updateBookmark.bind(this),
      onConnection: this._assertSessionIsOpen.bind(this),
      reactive: this._reactive,
      fetchSize: this._fetchSize
    })
    tx._begin(this._lastBookmark, txConfig)
    return tx
  }

  _assertSessionIsOpen () {
    if (!this._open) {
      throw newError('You cannot run more transactions on a closed session.')
    }
  }

  _transactionClosed () {
    this._hasTx = false
  }

  /**
   * Return the bookmark received following the last completed {@link Transaction}.
   *
   * @return {string[]} A reference to a previous transaction.
   */
  lastBookmark () {
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
  readTransaction (transactionWork, transactionConfig) {
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
  writeTransaction (transactionWork, transactionConfig) {
    const config = new TxConfig(transactionConfig)
    return this._runTransaction(ACCESS_MODE_WRITE, config, transactionWork)
  }

  _runTransaction (accessMode, transactionConfig, transactionWork) {
    return this._transactionExecutor.execute(
      () => this._beginTransaction(accessMode, transactionConfig),
      transactionWork
    )
  }

  /**
   * Update value of the last bookmark.
   * @param {Bookmark} newBookmark - The new bookmark.
   */
  _updateBookmark (newBookmark) {
    if (newBookmark && !newBookmark.isEmpty()) {
      this._lastBookmark = newBookmark
    }
  }

  /**
   * Close this session.
   * @return {Promise}
   */
  async close () {
    if (this._open) {
      this._open = false
      this._transactionExecutor.close()

      await this._readConnectionHolder.close()
      await this._writeConnectionHolder.close()
    }
  }

  _connectionHolderWithMode (mode) {
    if (mode === ACCESS_MODE_READ) {
      return this._readConnectionHolder
    } else if (mode === ACCESS_MODE_WRITE) {
      return this._writeConnectionHolder
    } else {
      throw newError('Unknown access mode: ' + mode)
    }
  }

  _onCompleteCallback (meta) {
    this._updateBookmark(new Bookmark(meta.bookmark))
  }
}

function _createTransactionExecutor (config) {
  const maxRetryTimeMs =
    config && config.maxTransactionRetryTime
      ? config.maxTransactionRetryTime
      : null
  return new TransactionExecutor(maxRetryTimeMs)
}

export default Session

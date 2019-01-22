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
import StreamObserver from './internal/stream-observer';
import Result from './result';
import Transaction from './transaction';
import {newError} from './error';
import {validateStatementAndParameters} from './internal/util';
import ConnectionHolder from './internal/connection-holder';
import Driver from './driver';
import {ACCESS_MODE_READ, ACCESS_MODE_WRITE} from './internal/constants';
import TransactionExecutor from './internal/transaction-executor';
import Bookmark from './internal/bookmark';
import TxConfig from './internal/tx-config';

// Typedef for JSDoc. Declares TransactionConfig type and makes it possible to use in in method-level docs.
/**
 * Configuration object containing settings for explicit and auto-commit transactions.
 * <p>
 * Configuration is supported for:
 * <ul>
 *   <li>queries executed in auto-commit transactions using {@link Session#run}</li>
 *   <li>transactions started by transaction functions using {@link Session#readTransaction} and {@link Session#writeTransaction}</li>
 *   <li>explicit transactions using {@link Session#beginTransaction}</li>
 * </ul>
 * @typedef {object} TransactionConfig
 * @property {number} timeout - the transaction timeout in **milliseconds**. Transactions that execute longer than the configured timeout will
 * be terminated by the database. This functionality allows to limit query/transaction execution time. Specified timeout overrides the default timeout
 * configured in the database using `dbms.transaction.timeout` setting. Value should not represent a duration of zero or negative duration.
 * @property {object} metadata - the transaction metadata. Specified metadata will be attached to the executing transaction and visible in the output of
 * `dbms.listQueries` and `dbms.listTransactions` procedures. It will also get logged to the `query.log`. This functionality makes it easier to tag
 * transactions and is equivalent to `dbms.setTXMetaData` procedure.
 */

/**
 * A Session instance is used for handling the connection and
 * sending statements through the connection.
 * In a single session, multiple queries will be executed serially.
 * In order to execute parallel queries, multiple sessions are required.
 * @access public
 */
class Session {

  /**
   * @constructor
   * @param {string} mode the default access mode for this session.
   * @param {ConnectionProvider} connectionProvider - the connection provider to acquire connections from.
   * @param {Bookmark} bookmark - the initial bookmark for this session.
   * @param {Object} [config={}] - this driver configuration.
   */
  constructor(mode, connectionProvider, bookmark, config) {
    this._mode = mode;
    this._readConnectionHolder = new ConnectionHolder(ACCESS_MODE_READ, connectionProvider);
    this._writeConnectionHolder = new ConnectionHolder(ACCESS_MODE_WRITE, connectionProvider);
    this._open = true;
    this._hasTx = false;
    this._lastBookmark = bookmark;
    this._transactionExecutor = _createTransactionExecutor(config);
  }

  /**
   * Run Cypher statement
   * Could be called with a statement object i.e.: `{text: "MATCH ...", parameters: {param: 1}}`
   * or with the statement and parameters as separate arguments.
   * @param {mixed} statement - Cypher statement to execute
   * @param {Object} parameters - Map with parameters to use in statement
   * @param {TransactionConfig} [transactionConfig] - configuration for the new auto-commit transaction.
   * @return {Result} - New Result
   */
  run(statement, parameters, transactionConfig) {
    const {query, params} = validateStatementAndParameters(statement, parameters);
    const autoCommitTxConfig = transactionConfig ? new TxConfig(transactionConfig) : TxConfig.empty();

    return this._run(query, params, (connection, streamObserver) =>
      connection.protocol().run(query, params, this._lastBookmark, autoCommitTxConfig, this._mode, streamObserver)
    );
  }

  _run(statement, parameters, statementRunner) {
    const streamObserver = new SessionStreamObserver(this);
    const connectionHolder = this._connectionHolderWithMode(this._mode);
    if (!this._hasTx) {
      connectionHolder.initializeConnection();
      connectionHolder.getConnection(streamObserver)
        .then(connection => statementRunner(connection, streamObserver))
        .catch(error => streamObserver.onError(error));
    } else {
      streamObserver.onError(newError('Statements cannot be run directly on a ' +
        'session with an open transaction; either run from within the ' +
        'transaction or use a different session.'));
    }
    return new Result(streamObserver, statement, parameters, () => streamObserver.serverMetadata(), connectionHolder);
  }

  /**
   * Begin a new transaction in this session. A session can have at most one transaction running at a time, if you
   * want to run multiple concurrent transactions, you should use multiple concurrent sessions.
   *
   * While a transaction is open the session cannot be used to run statements outside the transaction.
   *
   * @param {TransactionConfig} [transactionConfig] - configuration for the new auto-commit transaction.
   * @returns {Transaction} - New Transaction
   */
  beginTransaction(transactionConfig) {
    // this function needs to support bookmarks parameter for backwards compatibility
    // parameter was of type {string|string[]} and represented either a single or multiple bookmarks
    // that's why we need to check parameter type and decide how to interpret the value
    const arg = transactionConfig;

    let txConfig = TxConfig.empty();
    if (typeof arg === 'string' || arg instanceof String || Array.isArray(arg)) {
      // argument looks like a single or multiple bookmarks
      // bookmarks in this function are deprecated but need to be supported for backwards compatibility
      this._updateBookmark(new Bookmark(arg));
    } else if (arg) {
      // argument is probably a transaction configuration
      txConfig = new TxConfig(arg);
    }

    return this._beginTransaction(this._mode, txConfig);
  }

  _beginTransaction(accessMode, txConfig) {
    if (this._hasTx) {
      throw newError('You cannot begin a transaction on a session with an open transaction; ' +
        'either run from within the transaction or use a different session.');
    }

    const mode = Driver._validateSessionMode(accessMode);
    const connectionHolder = this._connectionHolderWithMode(mode);
    connectionHolder.initializeConnection();
    this._hasTx = true;

    const tx = new Transaction(connectionHolder, this._transactionClosed.bind(this), this._updateBookmark.bind(this));
    tx._begin(this._lastBookmark, txConfig);
    return tx;
  }

  _transactionClosed() {
    this._hasTx = false;
  }

  /**
   * Return the bookmark received following the last completed {@link Transaction}.
   *
   * @return {string|null} a reference to a previous transaction
   */
  lastBookmark() {
    return this._lastBookmark.maxBookmarkAsString();
  }

  /**
   * Execute given unit of work in a {@link READ} transaction.
   *
   * Transaction will automatically be committed unless the given function throws or returns a rejected promise.
   * Some failures of the given function or the commit itself will be retried with exponential backoff with initial
   * delay of 1 second and maximum retry time of 30 seconds. Maximum retry time is configurable via driver config's
   * `maxTransactionRetryTime` property in milliseconds.
   *
   * @param {function(tx: Transaction): Promise} transactionWork - callback that executes operations against
   * a given {@link Transaction}.
   * @param {TransactionConfig} [transactionConfig] - configuration for all transactions started to execute the unit of work.
   * @return {Promise} resolved promise as returned by the given function or rejected promise when given
   * function or commit fails.
   */
  readTransaction(transactionWork, transactionConfig) {
    const config = new TxConfig(transactionConfig);
    return this._runTransaction(ACCESS_MODE_READ, config, transactionWork);
  }

  /**
   * Execute given unit of work in a {@link WRITE} transaction.
   *
   * Transaction will automatically be committed unless the given function throws or returns a rejected promise.
   * Some failures of the given function or the commit itself will be retried with exponential backoff with initial
   * delay of 1 second and maximum retry time of 30 seconds. Maximum retry time is configurable via driver config's
   * `maxTransactionRetryTime` property in milliseconds.
   *
   * @param {function(tx: Transaction): Promise} transactionWork - callback that executes operations against
   * a given {@link Transaction}.
   * @param {TransactionConfig} [transactionConfig] - configuration for all transactions started to execute the unit of work.
   * @return {Promise} resolved promise as returned by the given function or rejected promise when given
   * function or commit fails.
   */
  writeTransaction(transactionWork, transactionConfig) {
    const config = new TxConfig(transactionConfig);
    return this._runTransaction(ACCESS_MODE_WRITE, config, transactionWork);
  }

  _runTransaction(accessMode, transactionConfig, transactionWork) {
    return this._transactionExecutor.execute(
      () => this._beginTransaction(accessMode, transactionConfig),
      transactionWork
    );
  }

  /**
   * Update value of the last bookmark.
   * @param {Bookmark} newBookmark the new bookmark.
   */
  _updateBookmark(newBookmark) {
    if (newBookmark && !newBookmark.isEmpty()) {
      this._lastBookmark = newBookmark;
    }
  }

  /**
   * Close this session.
   * @param {function()} callback - Function to be called after the session has been closed
   * @return
   */
  close(callback = (() => null)) {
    if (this._open) {
      this._open = false;
      this._transactionExecutor.close();
      this._readConnectionHolder.close().then(() => {
        this._writeConnectionHolder.close().then(() => {
          callback();
        });
      });
    } else {
      callback();
    }
  }

  _connectionHolderWithMode(mode) {
    if (mode === ACCESS_MODE_READ) {
      return this._readConnectionHolder;
    } else if (mode === ACCESS_MODE_WRITE) {
      return this._writeConnectionHolder;
    } else {
      throw newError('Unknown access mode: ' + mode);
    }
  }
}

/**
 * @private
 */
class SessionStreamObserver extends StreamObserver {

  constructor(session) {
    super();
    this._session = session;
  }

  onCompleted(meta) {
    super.onCompleted(meta);
    const bookmark = new Bookmark(meta.bookmark);
    this._session._updateBookmark(bookmark);
  }
}

function _createTransactionExecutor(config) {
  const maxRetryTimeMs = (config && config.maxTransactionRetryTime) ? config.maxTransactionRetryTime : null;
  return new TransactionExecutor(maxRetryTimeMs);
}

export default Session;

/**
 * Copyright (c) 2002-2018 "Neo4j,"
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
import Driver, {READ, WRITE} from './driver';
import TransactionExecutor from './internal/transaction-executor';
import Bookmark from './internal/bookmark';

/**
  * A Session instance is used for handling the connection and
  * sending statements through the connection.
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
    this._readConnectionHolder = new ConnectionHolder(READ, connectionProvider);
    this._writeConnectionHolder = new ConnectionHolder(WRITE, connectionProvider);
    this._open = true;
    this._hasTx = false;
    this._lastBookmark = bookmark;
    this._transactionExecutor = _createTransactionExecutor(config);
  }

  /**
   * Run Cypher statement
   * Could be called with a statement object i.e.: {text: "MATCH ...", parameters: {param: 1}}
   * or with the statement and parameters as separate arguments.
   * @param {mixed} statement - Cypher statement to execute
   * @param {Object} parameters - Map with parameters to use in statement
   * @return {Result} - New Result
   */
  run(statement, parameters = {}) {
    const {query, params} = validateStatementAndParameters(statement, parameters);

    return this._run(query, params, (connection, streamObserver) =>
      connection.run(query, params, streamObserver)
    );
  }

  _run(statement, parameters, statementRunner) {
    const streamObserver = new StreamObserver(this._onRunFailure());
    const connectionHolder = this._connectionHolderWithMode(this._mode);
    if (!this._hasTx) {
      connectionHolder.initializeConnection();
      connectionHolder.getConnection(streamObserver).then(connection => {
        statementRunner(connection, streamObserver);
        connection.pullAll(streamObserver);
        connection.sync();
      }).catch(error => streamObserver.onError(error));
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
   * @param {string|string[]} [bookmarkOrBookmarks=null] - reference or references to some previous transactions.
   * DEPRECATED: This parameter is deprecated in favour of {@link Driver#session} that accepts an initial bookmark.
   * Session will ensure that all nested transactions are chained with bookmarks to guarantee causal consistency.
   * @returns {Transaction} - New Transaction
   */
  beginTransaction(bookmarkOrBookmarks) {
    this._updateBookmark(new Bookmark(bookmarkOrBookmarks));
    return this._beginTransaction(this._mode);
  }

  _beginTransaction(accessMode) {
    if (this._hasTx) {
      throw newError('You cannot begin a transaction on a session with an open transaction; ' +
        'either run from within the transaction or use a different session.');
    }

    const mode = Driver._validateSessionMode(accessMode);
    const connectionHolder = this._connectionHolderWithMode(mode);
    connectionHolder.initializeConnection();
    this._hasTx = true;

    return new Transaction(connectionHolder, () => {
        this._hasTx = false;
      },
      this._onRunFailure(), this._lastBookmark, this._updateBookmark.bind(this));
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
   * <code>maxTransactionRetryTime</code> property in milliseconds.
   *
   * @param {function(tx: Transaction): Promise} transactionWork - callback that executes operations against
   * a given {@link Transaction}.
   * @return {Promise} resolved promise as returned by the given function or rejected promise when given
   * function or commit fails.
   */
  readTransaction(transactionWork) {
    return this._runTransaction(READ, transactionWork);
  }

  /**
   * Execute given unit of work in a {@link WRITE} transaction.
   *
   * Transaction will automatically be committed unless the given function throws or returns a rejected promise.
   * Some failures of the given function or the commit itself will be retried with exponential backoff with initial
   * delay of 1 second and maximum retry time of 30 seconds. Maximum retry time is configurable via driver config's
   * <code>maxTransactionRetryTime</code> property in milliseconds.
   *
   * @param {function(tx: Transaction): Promise} transactionWork - callback that executes operations against
   * a given {@link Transaction}.
   * @return {Promise} resolved promise as returned by the given function or rejected promise when given
   * function or commit fails.
   */
  writeTransaction(transactionWork) {
    return this._runTransaction(WRITE, transactionWork);
  }

  _runTransaction(accessMode, transactionWork) {
    return this._transactionExecutor.execute(
      () => this._beginTransaction(accessMode),
      transactionWork
    );
  }

  /**
   * Update value of the last bookmark.
   * @param {Bookmark} newBookmark the new bookmark.
   * @private
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

  //Can be overridden to add error callback on RUN
  _onRunFailure() {
    return (err) => {return err};
  }

  _connectionHolderWithMode(mode) {
    if (mode === READ) {
      return this._readConnectionHolder;
    } else if (mode === WRITE) {
      return this._writeConnectionHolder;
    } else {
      throw newError('Unknown access mode: ' + mode);
    }
  }
}

function _createTransactionExecutor(config) {
  const maxRetryTimeMs = (config && config.maxTransactionRetryTime) ? config.maxTransactionRetryTime : null;
  return new TransactionExecutor(maxRetryTimeMs);
}

export default Session;

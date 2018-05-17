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
import {validateStatementAndParameters} from './internal/util';
import {EMPTY_CONNECTION_HOLDER} from './internal/connection-holder';
import Bookmark from './internal/bookmark';

/**
 * Represents a transaction in the Neo4j database.
 *
 * @access public
 */
class Transaction {
  /**
   * @constructor
   * @param {ConnectionHolder} connectionHolder - the connection holder to get connection from.
   * @param {function()} onClose - Function to be called when transaction is committed or rolled back.
   * @param {function(error: Error): Error} errorTransformer callback use to transform error.
   * @param {Bookmark} bookmark bookmark for transaction begin.
   * @param {function(bookmark: Bookmark)} onBookmark callback invoked when new bookmark is produced.
   */
  constructor(connectionHolder, onClose, errorTransformer, bookmark, onBookmark) {
    this._connectionHolder = connectionHolder;
    const streamObserver = new _TransactionStreamObserver(this);

    this._connectionHolder.getConnection(streamObserver).then(conn => {
      conn.run('BEGIN', bookmark.asBeginTransactionParameters(), streamObserver);
      conn.pullAll(streamObserver);
    }).catch(error => streamObserver.onError(error));

    this._state = _states.ACTIVE;
    this._onClose = onClose;
    this._errorTransformer = errorTransformer;
    this._onBookmark = onBookmark;
  }

  /**
   * Run Cypher statement
   * Could be called with a statement object i.e.: <code>{text: "MATCH ...", parameters: {param: 1}}</code>
   * or with the statement and parameters as separate arguments.
   * @param {mixed} statement - Cypher statement to execute
   * @param {Object} parameters - Map with parameters to use in statement
   * @return {Result} New Result
   */
  run(statement, parameters) {
    const {query, params} = validateStatementAndParameters(statement, parameters);

    return this._state.run(this._connectionHolder, new _TransactionStreamObserver(this), query, params);
  }

  /**
   * Commits the transaction and returns the result.
   *
   * After committing the transaction can no longer be used.
   *
   * @returns {Result} New Result
   */
  commit() {
    let committed = this._state.commit(this._connectionHolder, new _TransactionStreamObserver(this));
    this._state = committed.state;
    //clean up
    this._onClose();
    return committed.result;
  }

  /**
   * Rollbacks the transaction.
   *
   * After rolling back, the transaction can no longer be used.
   *
   * @returns {Result} New Result
   */
  rollback() {
    let committed = this._state.rollback(this._connectionHolder, new _TransactionStreamObserver(this));
    this._state = committed.state;
    //clean up
    this._onClose();
    return committed.result;
  }

  /**
   * Check if this transaction is active, which means commit and rollback did not happen.
   * @return {boolean} <code>true</code> when not committed and not rolled back, <code>false</code> otherwise.
   */
  isOpen() {
    return this._state == _states.ACTIVE;
  }

  _onError() {
    if (this.isOpen()) {
      // attempt to rollback, useful when Transaction#run() failed
      return this.rollback().catch(ignoredError => {
        // ignore all errors because it is best effort and transaction might already be rolled back
      }).then(() => {
        // after rollback attempt change this transaction's state to FAILED
        this._state = _states.FAILED;
      });
    } else {
      // error happened in in-active transaction, just to the cleanup and change state to FAILED
      this._state = _states.FAILED;
      this._onClose();
      // no async actions needed - return resolved promise
      return Promise.resolve();
    }
  }
}

/** Internal stream observer used for transactional results*/
class _TransactionStreamObserver extends StreamObserver {
  constructor(tx) {
    super(tx._errorTransformer || ((err) => {return err}));
    this._tx = tx;
    //this is to to avoid multiple calls to onError caused by IGNORED
    this._hasFailed = false;
  }

  onError(error) {
    if (!this._hasFailed) {
      this._tx._onError().then(() => {
        super.onError(error);
        this._hasFailed = true;
      });
    }
  }

  onCompleted(meta) {
    super.onCompleted(meta);
    const bookmark = new Bookmark(meta.bookmark);
    this._tx._onBookmark(bookmark);
  }
}

/** internal state machine of the transaction*/
let _states = {
  //The transaction is running with no explicit success or failure marked
  ACTIVE: {
    commit: (connectionHolder, observer) => {
      return {result: _runPullAll("COMMIT", connectionHolder, observer),
        state: _states.SUCCEEDED}
    },
    rollback: (connectionHolder, observer) => {
      return {result: _runPullAll("ROLLBACK", connectionHolder, observer), state: _states.ROLLED_BACK};
    },
    run: (connectionHolder, observer, statement, parameters) => {
      connectionHolder.getConnection(observer).then(conn => {
        conn.run(statement, parameters || {}, observer);
        conn.pullAll(observer);
        conn.sync();
      }).catch(error => observer.onError(error));

      return _newRunResult(observer, statement, parameters, () => observer.serverMetadata());
    }
  },

  //An error has occurred, transaction can no longer be used and no more messages will
  // be sent for this transaction.
  FAILED: {
    commit: (connectionHolder, observer) => {
      observer.onError({
        error: "Cannot commit statements in this transaction, because previous statements in the " +
        "transaction has failed and the transaction has been rolled back. Please start a new" +
        " transaction to run another statement."
      });
      return {result: _newDummyResult(observer, "COMMIT", {}), state: _states.FAILED};
    },
    rollback: (connectionHolder, observer) => {
      observer.onError({error:
      "Cannot rollback transaction, because previous statements in the " +
      "transaction has failed and the transaction has already been rolled back."});
      return {result: _newDummyResult(observer, "ROLLBACK", {}), state: _states.FAILED};
    },
    run: (connectionHolder, observer, statement, parameters) => {
      observer.onError({error:
      "Cannot run statement, because previous statements in the " +
      "transaction has failed and the transaction has already been rolled back."});
      return _newDummyResult(observer, statement, parameters);
    }
  },

  //This transaction has successfully committed
  SUCCEEDED: {
    commit: (connectionHolder, observer) => {
      observer.onError({
        error: "Cannot commit statements in this transaction, because commit has already been successfully called on the transaction and transaction has been closed. Please start a new" +
        " transaction to run another statement."
      });
      return {result: _newDummyResult(observer, "COMMIT", {}), state: _states.SUCCEEDED};
    },
    rollback: (connectionHolder, observer) => {
      observer.onError({error:
        "Cannot rollback transaction, because transaction has already been successfully closed."});
      return {result: _newDummyResult(observer, "ROLLBACK", {}), state: _states.SUCCEEDED};
    },
    run: (connectionHolder, observer, statement, parameters) => {
      observer.onError({error:
      "Cannot run statement, because transaction has already been successfully closed."});
      return _newDummyResult(observer, statement, parameters);
    }
  },

  //This transaction has been rolled back
  ROLLED_BACK: {
    commit: (connectionHolder, observer) => {
      observer.onError({
        error: "Cannot commit this transaction, because it has already been rolled back."
      });
      return {result: _newDummyResult(observer, "COMMIT", {}), state: _states.ROLLED_BACK};
    },
    rollback: (connectionHolder, observer) => {
      observer.onError({error:
        "Cannot rollback transaction, because transaction has already been rolled back."});
      return {result: _newDummyResult(observer, "ROLLBACK", {}), state: _states.ROLLED_BACK};
    },
    run: (connectionHolder, observer, statement, parameters) => {
      observer.onError({error:
        "Cannot run statement, because transaction has already been rolled back."});
      return _newDummyResult(observer, statement, parameters);
    }
  }
};

function _runPullAll(msg, connectionHolder, observer) {
  connectionHolder.getConnection(observer).then(conn => {
    conn.run(msg, {}, observer);
    conn.pullAll(observer);
    conn.sync();
  }).catch(error => observer.onError(error));

  // for commit & rollback we need result that uses real connection holder and notifies it when
  // connection is not needed and can be safely released to the pool
  return new Result(observer, msg, {}, emptyMetadataSupplier, connectionHolder);
}

/**
 * Creates a {@link Result} with empty connection holder.
 * Should be used as a result for running cypher statements. They can result in metadata but should not
 * influence real connection holder to release connections because single transaction can have
 * {@link Transaction#run} called multiple times.
 * @param {StreamObserver} observer - an observer for the created result.
 * @param {string} statement - the cypher statement that produced the result.
 * @param {object} parameters - the parameters for cypher statement that produced the result.
 * @param {function} metadataSupplier - the function that returns a metadata object.
 * @return {Result} new result.
 * @private
 */
function _newRunResult(observer, statement, parameters, metadataSupplier) {
  return new Result(observer, statement, parameters, metadataSupplier, EMPTY_CONNECTION_HOLDER);
}

/**
 * Creates a {@link Result} without metadata supplier and with empty connection holder.
 * For cases when result represents an intermediate or failed action, does not require any metadata and does not
 * need to influence real connection holder to release connections.
 * @param {StreamObserver} observer - an observer for the created result.
 * @param {string} statement - the cypher statement that produced the result.
 * @param {object} parameters - the parameters for cypher statement that produced the result.
 * @return {Result} new result.
 * @private
 */
function _newDummyResult(observer, statement, parameters) {
  return new Result(observer, statement, parameters, emptyMetadataSupplier, EMPTY_CONNECTION_HOLDER);
}

function emptyMetadataSupplier() {
  return {};
}

export default Transaction;

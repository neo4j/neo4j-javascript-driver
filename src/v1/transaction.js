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
import {validateStatementAndParameters} from './internal/util';
import {EMPTY_CONNECTION_HOLDER} from './internal/connection-holder';
import Bookmark from './internal/bookmark';
import TxConfig from './internal/tx-config';

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
   * @param {function(bookmark: Bookmark)} onBookmark callback invoked when new bookmark is produced.
   */
  constructor(connectionHolder, onClose, onBookmark) {
    this._connectionHolder = connectionHolder;
    this._state = _states.ACTIVE;
    this._onClose = onClose;
    this._onBookmark = onBookmark;
  }

  _begin(bookmark, txConfig) {
    const streamObserver = new _TransactionStreamObserver(this);

    this._connectionHolder.getConnection(streamObserver)
      .then(conn => conn.protocol().beginTransaction(bookmark, txConfig, streamObserver))
      .catch(error => streamObserver.onError(error));
  }

  /**
   * Run Cypher statement
   * Could be called with a statement object i.e.: `{text: "MATCH ...", parameters: {param: 1}}`
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
   * @return {boolean} `true` when not committed and not rolled back, `false` otherwise.
   */
  isOpen() {
    return this._state == _states.ACTIVE;
  }

  _onError() {
    // error will be "acknowledged" by sending a RESET message
    // database will then forget about this transaction and cleanup all corresponding resources
    // it is thus safe to move this transaction to a FAILED state and disallow any further interactions with it
    this._state = _states.FAILED;
    this._onClose();

    // release connection back to the pool
    return this._connectionHolder.releaseConnection();
  }
}

/** Internal stream observer used for transactional results*/
class _TransactionStreamObserver extends StreamObserver {
  constructor(tx) {
    super();
    this._tx = tx;
  }

  onError(error) {
    if (!this._hasFailed) {
      this._tx._onError().then(() => {
        super.onError(error);
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
      return {
        result: finishTransaction(true, connectionHolder, observer),
        state: _states.SUCCEEDED
      };
    },
    rollback: (connectionHolder, observer) => {
      return {
        result: finishTransaction(false, connectionHolder, observer),
        state: _states.ROLLED_BACK
      };
    },
    run: (connectionHolder, observer, statement, parameters) => {
      // RUN in explicit transaction can't contain bookmarks and transaction configuration
      const bookmark = Bookmark.empty();
      const txConfig = TxConfig.empty();

      connectionHolder.getConnection(observer)
        .then(conn => conn.protocol().run(statement, parameters, bookmark, txConfig, observer))
        .catch(error => observer.onError(error));

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
      observer.markCompleted();
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

function finishTransaction(commit, connectionHolder, observer) {
  connectionHolder.getConnection(observer)
    .then(connection => {
      if (commit) {
        return connection.protocol().commitTransaction(observer);
      } else {
        return connection.protocol().rollbackTransaction(observer);
      }
    })
    .catch(error => observer.onError(error));

  // for commit & rollback we need result that uses real connection holder and notifies it when
  // connection is not needed and can be safely released to the pool
  return new Result(observer, commit ? 'COMMIT' : 'ROLLBACK', {}, emptyMetadataSupplier, connectionHolder);
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

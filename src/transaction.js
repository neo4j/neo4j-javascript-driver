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
import Result from './result'
import { validateQueryAndParameters } from './internal/util'
import ConnectionHolder, {
  EMPTY_CONNECTION_HOLDER
} from './internal/connection-holder'
import Bookmark from './internal/bookmark'
import TxConfig from './internal/tx-config'

import {
  ResultStreamObserver,
  FailedObserver,
  CompletedObserver
} from './internal/stream-observers'
import { newError } from './error'

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
   * * @param {function()} onConnection - Function to be called when a connection is obtained to ensure the conneciton
   * is not yet released.
   * @param {boolean} reactive whether this transaction generates reactive streams
   * @param {number} fetchSize - the record fetch size in each pulling batch.
   */
  constructor ({
    connectionHolder,
    onClose,
    onBookmark,
    onConnection,
    reactive,
    fetchSize
  }) {
    this._connectionHolder = connectionHolder
    this._reactive = reactive
    this._state = _states.ACTIVE
    this._onClose = onClose
    this._onBookmark = onBookmark
    this._onConnection = onConnection
    this._onError = this._onErrorCallback.bind(this)
    this._onComplete = this._onCompleteCallback.bind(this)
    this._fetchSize = fetchSize
    this._results = []
  }

  _begin (bookmark, txConfig) {
    this._connectionHolder
      .getConnection()
      .then(conn => {
        this._onConnection()
        return conn.protocol().beginTransaction({
          bookmark: bookmark,
          txConfig: txConfig,
          mode: this._connectionHolder.mode(),
          database: this._connectionHolder.database(),
          beforeError: this._onError,
          afterComplete: this._onComplete
        })
      })
      .catch(error => this._onError(error))
  }

  /**
   * Run Cypher query
   * Could be called with a query object i.e.: `{text: "MATCH ...", parameters: {param: 1}}`
   * or with the query and parameters as separate arguments.
   * @param {mixed} query - Cypher query to execute
   * @param {Object} parameters - Map with parameters to use in query
   * @return {Result} New Result
   */
  run (query, parameters) {
    const { validatedQuery, params } = validateQueryAndParameters(
      query,
      parameters
    )

    var result = this._state.run(validatedQuery, params, {
      connectionHolder: this._connectionHolder,
      onError: this._onError,
      onComplete: this._onComplete,
      onConnection: this._onConnection,
      reactive: this._reactive,
      fetchSize: this._fetchSize
    })
    this._results.push(result)
    return result
  }

  /**
   * Commits the transaction and returns the result.
   *
   * After committing the transaction can no longer be used.
   *
   * @returns {Promise<void>} An empty promise if committed successfully or error if any error happened during commit.
   */
  commit () {
    const committed = this._state.commit({
      connectionHolder: this._connectionHolder,
      onError: this._onError,
      onComplete: this._onComplete,
      onConnection: this._onConnection,
      pendingResults: this._results
    })
    this._state = committed.state
    // clean up
    this._onClose()
    return new Promise((resolve, reject) => {
      committed.result.subscribe({
        onCompleted: () => resolve(),
        onError: error => reject(error)
      })
    })
  }

  /**
   * Rollbacks the transaction.
   *
   * After rolling back, the transaction can no longer be used.
   *
   * @returns {Promise<void>} An empty promise if rolled back successfully or error if any error happened during
   * rollback.
   */
  rollback () {
    const rolledback = this._state.rollback({
      connectionHolder: this._connectionHolder,
      onError: this._onError,
      onComplete: this._onComplete,
      onConnection: this._onConnection,
      pendingResults: this._results
    })
    this._state = rolledback.state
    // clean up
    this._onClose()
    return new Promise((resolve, reject) => {
      rolledback.result.subscribe({
        onCompleted: () => resolve(),
        onError: error => reject(error)
      })
    })
  }

  /**
   * Check if this transaction is active, which means commit and rollback did not happen.
   * @return {boolean} `true` when not committed and not rolled back, `false` otherwise.
   */
  isOpen () {
    return this._state === _states.ACTIVE
  }

  _onErrorCallback (err) {
    // error will be "acknowledged" by sending a RESET message
    // database will then forget about this transaction and cleanup all corresponding resources
    // it is thus safe to move this transaction to a FAILED state and disallow any further interactions with it
    this._state = _states.FAILED
    this._onClose()

    // release connection back to the pool
    return this._connectionHolder.releaseConnection()
  }

  _onCompleteCallback (meta) {
    this._onBookmark(new Bookmark(meta.bookmark))
  }
}

const _states = {
  // The transaction is running with no explicit success or failure marked
  ACTIVE: {
    commit: ({
      connectionHolder,
      onError,
      onComplete,
      onConnection,
      pendingResults
    }) => {
      return {
        result: finishTransaction(
          true,
          connectionHolder,
          onError,
          onComplete,
          onConnection,
          pendingResults
        ),
        state: _states.SUCCEEDED
      }
    },
    rollback: ({
      connectionHolder,
      onError,
      onComplete,
      onConnection,
      pendingResults
    }) => {
      return {
        result: finishTransaction(
          false,
          connectionHolder,
          onError,
          onComplete,
          onConnection,
          pendingResults
        ),
        state: _states.ROLLED_BACK
      }
    },
    run: (
      query,
      parameters,
      {
        connectionHolder,
        onError,
        onComplete,
        onConnection,
        reactive,
        fetchSize
      }
    ) => {
      // RUN in explicit transaction can't contain bookmarks and transaction configuration
      // No need to include mode and database name as it shall be inclued in begin
      const observerPromise = connectionHolder
        .getConnection()
        .then(conn => {
          onConnection()
          return conn.protocol().run(query, parameters, {
            bookmark: Bookmark.empty(),
            txConfig: TxConfig.empty(),
            beforeError: onError,
            afterComplete: onComplete,
            reactive: reactive,
            fetchSize: fetchSize
          })
        })
        .catch(error => new FailedObserver({ error, onError }))

      return newCompletedResult(observerPromise, query, parameters)
    }
  },

  // An error has occurred, transaction can no longer be used and no more messages will
  // be sent for this transaction.
  FAILED: {
    commit: ({ connectionHolder, onError, onComplete }) => {
      return {
        result: newCompletedResult(
          new FailedObserver({
            error: newError(
              'Cannot commit this transaction, because it has been rolled back either because of an error or explicit termination.'
            ),
            onError
          }),
          'COMMIT',
          {}
        ),
        state: _states.FAILED
      }
    },
    rollback: ({ connectionHolder, onError, onComplete }) => {
      return {
        result: newCompletedResult(new CompletedObserver(), 'ROLLBACK', {}),
        state: _states.FAILED
      }
    },
    run: (query, parameters, { connectionHolder, onError, onComplete }) => {
      return newCompletedResult(
        new FailedObserver({
          error: newError(
            'Cannot run query in this transaction, because it has been rolled back either because of an error or explicit termination.'
          ),
          onError
        }),
        query,
        parameters
      )
    }
  },

  // This transaction has successfully committed
  SUCCEEDED: {
    commit: ({ connectionHolder, onError, onComplete }) => {
      return {
        result: newCompletedResult(
          new FailedObserver({
            error: newError(
              'Cannot commit this transaction, because it has already been committed.'
            ),
            onError
          }),
          'COMMIT',
          {}
        ),
        state: _states.SUCCEEDED
      }
    },
    rollback: ({ connectionHolder, onError, onComplete }) => {
      return {
        result: newCompletedResult(
          new FailedObserver({
            error: newError(
              'Cannot rollback this transaction, because it has already been committed.'
            ),
            onError
          }),
          'ROLLBACK',
          {}
        ),
        state: _states.SUCCEEDED
      }
    },
    run: (query, parameters, { connectionHolder, onError, onComplete }) => {
      return newCompletedResult(
        new FailedObserver({
          error: newError(
            'Cannot run query in this transaction, because it has already been committed.'
          ),
          onError
        }),
        query,
        parameters
      )
    }
  },

  // This transaction has been rolled back
  ROLLED_BACK: {
    commit: ({ connectionHolder, onError, onComplete }) => {
      return {
        result: newCompletedResult(
          new FailedObserver({
            error: newError(
              'Cannot commit this transaction, because it has already been rolled back.'
            ),
            onError
          }),
          'COMMIT',
          {}
        ),
        state: _states.ROLLED_BACK
      }
    },
    rollback: ({ connectionHolder, onError, onComplete }) => {
      return {
        result: newCompletedResult(
          new FailedObserver({
            error: newError(
              'Cannot rollback this transaction, because it has already been rolled back.'
            )
          }),
          'ROLLBACK',
          {}
        ),
        state: _states.ROLLED_BACK
      }
    },
    run: (query, parameters, { connectionHolder, onError, onComplete }) => {
      return newCompletedResult(
        new FailedObserver({
          error: newError(
            'Cannot run query in this transaction, because it has already been rolled back.'
          ),
          onError
        }),
        query,
        parameters
      )
    }
  }
}

/**
 *
 * @param {boolean} commit
 * @param {ConnectionHolder} connectionHolder
 * @param {function(err:Error): any} onError
 * @param {function(metadata:object): any} onComplete
 * @param {function() : any} onConnection
 * @param {list<Result>>}pendingResults all run results in this transaction
 */
function finishTransaction (
  commit,
  connectionHolder,
  onError,
  onComplete,
  onConnection,
  pendingResults
) {
  const observerPromise = connectionHolder
    .getConnection()
    .then(connection => {
      onConnection()
      pendingResults.forEach(r => r._cancel())
      return Promise.all(pendingResults).then(results => {
        if (commit) {
          return connection.protocol().commitTransaction({
            beforeError: onError,
            afterComplete: onComplete
          })
        } else {
          return connection.protocol().rollbackTransaction({
            beforeError: onError,
            afterComplete: onComplete
          })
        }
      })
    })
    .catch(error => new FailedObserver({ error, onError }))

  // for commit & rollback we need result that uses real connection holder and notifies it when
  // connection is not needed and can be safely released to the pool
  return new Result(
    observerPromise,
    commit ? 'COMMIT' : 'ROLLBACK',
    {},
    connectionHolder
  )
}

/**
 * Creates a {@link Result} with empty connection holder.
 * For cases when result represents an intermediate or failed action, does not require any metadata and does not
 * need to influence real connection holder to release connections.
 * @param {ResultStreamObserver} observer - an observer for the created result.
 * @param {string} query - the cypher query that produced the result.
 * @param {Object} parameters - the parameters for cypher query that produced the result.
 * @return {Result} new result.
 * @private
 */
function newCompletedResult (observerPromise, query, parameters) {
  return new Result(
    Promise.resolve(observerPromise),
    query,
    parameters,
    EMPTY_CONNECTION_HOLDER
  )
}

export default Transaction

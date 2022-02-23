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
import { validateQueryAndParameters } from './internal/util'
import Connection from './connection'
import {
  ConnectionHolder,
  ReadOnlyConnectionHolder,
  EMPTY_CONNECTION_HOLDER
} from './internal/connection-holder'
import { Bookmark } from './internal/bookmark'
import { TxConfig } from './internal/tx-config'

import {
  ResultStreamObserver,
  FailedObserver,
  CompletedObserver
} from './internal/observers'

import { newError } from './error'
import Result from './result'
import { Query } from './types'

/**
 * Represents a transaction in the Neo4j database.
 *
 * @access public
 */
class Transaction {
  private _connectionHolder: ConnectionHolder
  private _reactive: boolean
  private _state: any
  private _onClose: () => void
  private _onBookmark: (bookmark: Bookmark) => void
  private _onConnection: () => void
  private _onError: (error: Error) => Promise<Connection | void>
  private _onComplete: (metadata: any) => void
  private _fetchSize: number
  private _results: any[]
  private _impersonatedUser?: string

  /**
   * @constructor
   * @param {ConnectionHolder} connectionHolder - the connection holder to get connection from.
   * @param {function()} onClose - Function to be called when transaction is committed or rolled back.
   * @param {function(bookmark: Bookmark)} onBookmark callback invoked when new bookmark is produced.
   * * @param {function()} onConnection - Function to be called when a connection is obtained to ensure the conneciton
   * is not yet released.
   * @param {boolean} reactive whether this transaction generates reactive streams
   * @param {number} fetchSize - the record fetch size in each pulling batch.
   * @param {string} impersonatedUser - The name of the user which should be impersonated for the duration of the session.
   */
  constructor({
    connectionHolder,
    onClose,
    onBookmark,
    onConnection,
    reactive,
    fetchSize,
    impersonatedUser
  }: {
    connectionHolder: ConnectionHolder
    onClose: () => void
    onBookmark: (bookmark: Bookmark) => void
    onConnection: () => void
    reactive: boolean
    fetchSize: number
    impersonatedUser?: string
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
    this._impersonatedUser = impersonatedUser
  }

  /**
   * @private
   * @param {Bookmark | string |  string []} bookmark
   * @param {TxConfig} txConfig
   * @returns {void}
   */
  _begin(bookmark: Bookmark | string | string[], txConfig: TxConfig): void {
    this._connectionHolder
      .getConnection()
      .then(connection => {
        this._onConnection()
        if (connection) {
          return connection.protocol().beginTransaction({
            bookmark: bookmark,
            txConfig: txConfig,
            mode: this._connectionHolder.mode(),
            database: this._connectionHolder.database(),
            impersonatedUser: this._impersonatedUser,
            beforeError: this._onError,
            afterComplete: this._onComplete
          })
        } else {
          throw newError('No connection available')
        }
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
  run(query: Query, parameters?: any): Result {
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
  commit(): Promise<void> {
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
        onError: (error: any) => reject(error)
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
  rollback(): Promise<void> {
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
        onError: (error: any) => reject(error)
      })
    })
  }

  /**
   * Check if this transaction is active, which means commit and rollback did not happen.
   * @return {boolean} `true` when not committed and not rolled back, `false` otherwise.
   */
  isOpen(): boolean {
    return this._state === _states.ACTIVE
  }

  /**
   * Closes the transaction
   *
   * This method will roll back the transaction if it is not already committed or rolled back.
   *
   * @returns {Promise<void>} An empty promise if closed successfully or error if any error happened during
   */
  async close(): Promise<void> {
    if (this.isOpen()) {
      await this.rollback()
    }
  }

  _onErrorCallback(err: any): Promise<Connection | void> {
    // error will be "acknowledged" by sending a RESET message
    // database will then forget about this transaction and cleanup all corresponding resources
    // it is thus safe to move this transaction to a FAILED state and disallow any further interactions with it
    this._state = _states.FAILED
    this._onClose()

    // release connection back to the pool
    return this._connectionHolder.releaseConnection()
  }

  /**
   * @private
   * @param {object} meta The meta with bookmark
   * @returns {void}
   */
  _onCompleteCallback(meta: { bookmark?: string | string[] }): void {
    this._onBookmark(new Bookmark(meta.bookmark))
  }
}

/**
 * Defines the structure of state transition function
 * @private
 */
interface StateTransitionParams {
  connectionHolder: ConnectionHolder
  onError: (error: Error) => void
  onComplete: (metadata: any) => void
  onConnection: () => void
  pendingResults: any[]
  reactive: boolean
  fetchSize: number
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
    }: StateTransitionParams): any => {
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
    }: StateTransitionParams): any => {
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
      query: Query,
      parameters: any,
      {
        connectionHolder,
        onError,
        onComplete,
        onConnection,
        reactive,
        fetchSize,
      }: StateTransitionParams
    ): any => {
      // RUN in explicit transaction can't contain bookmarks and transaction configuration
      // No need to include mode and database name as it shall be inclued in begin
      const observerPromise = connectionHolder
        .getConnection()
        .then(conn => {
          onConnection()
          if (conn) {
            return conn.protocol().run(query, parameters, {
              bookmark: Bookmark.empty(),
              txConfig: TxConfig.empty(),
              beforeError: onError,
              afterComplete: onComplete,
              reactive: reactive,
              fetchSize: fetchSize,
            })
          } else {
            throw newError('No connection available')
          }
        })
        .catch(error => new FailedObserver({ error, onError }))

      return newCompletedResult(
        observerPromise,
        query,
        parameters,
        connectionHolder
      )
    }
  },

  // An error has occurred, transaction can no longer be used and no more messages will
  // be sent for this transaction.
  FAILED: {
    commit: ({
      connectionHolder,
      onError,
      onComplete
    }: StateTransitionParams): any => {
      return {
        result: newCompletedResult(
          new FailedObserver({
            error: newError(
              'Cannot commit this transaction, because it has been rolled back either because of an error or explicit termination.'
            ),
            onError
          }),
          'COMMIT',
          {},
          connectionHolder
        ),
        state: _states.FAILED
      }
    },
    rollback: ({
      connectionHolder,
      onError,
      onComplete
    }: StateTransitionParams): any => {
      return {
        result: newCompletedResult(
          new CompletedObserver(),
          'ROLLBACK',
          {},
          connectionHolder
        ),
        state: _states.FAILED
      }
    },
    run: (
      query: Query,
      parameters: any,
      { connectionHolder, onError, onComplete }: StateTransitionParams
    ): any => {
      return newCompletedResult(
        new FailedObserver({
          error: newError(
            'Cannot run query in this transaction, because it has been rolled back either because of an error or explicit termination.'
          ),
          onError
        }),
        query,
        parameters,
        connectionHolder
      )
    }
  },

  // This transaction has successfully committed
  SUCCEEDED: {
    commit: ({
      connectionHolder,
      onError,
      onComplete
    }: StateTransitionParams): any => {
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
        state: _states.SUCCEEDED,
        connectionHolder
      }
    },
    rollback: ({
      connectionHolder,
      onError,
      onComplete
    }: StateTransitionParams): any => {
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
        state: _states.SUCCEEDED,
        connectionHolder
      }
    },
    run: (
      query: Query,
      parameters: any,
      { connectionHolder, onError, onComplete }: StateTransitionParams
    ): any => {
      return newCompletedResult(
        new FailedObserver({
          error: newError(
            'Cannot run query in this transaction, because it has already been committed.'
          ),
          onError
        }),
        query,
        parameters,
        connectionHolder
      )
    }
  },

  // This transaction has been rolled back
  ROLLED_BACK: {
    commit: ({
      connectionHolder,
      onError,
      onComplete
    }: StateTransitionParams): any => {
      return {
        result: newCompletedResult(
          new FailedObserver({
            error: newError(
              'Cannot commit this transaction, because it has already been rolled back.'
            ),
            onError
          }),
          'COMMIT',
          {},
          connectionHolder
        ),
        state: _states.ROLLED_BACK
      }
    },
    rollback: ({
      connectionHolder,
      onError,
      onComplete
    }: StateTransitionParams): any => {
      return {
        result: newCompletedResult(
          new FailedObserver({
            error: newError(
              'Cannot rollback this transaction, because it has already been rolled back.'
            )
          }),
          'ROLLBACK',
          {},
          connectionHolder
        ),
        state: _states.ROLLED_BACK
      }
    },
    run: (
      query: Query,
      parameters: any,
      { connectionHolder, onError, onComplete }: StateTransitionParams
    ): any => {
      return newCompletedResult(
        new FailedObserver({
          error: newError(
            'Cannot run query in this transaction, because it has already been rolled back.'
          ),
          onError
        }),
        query,
        parameters,
        connectionHolder
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
function finishTransaction(
  commit: boolean,
  connectionHolder: ConnectionHolder,
  onError: (err: Error) => any,
  onComplete: (metadata: any) => any,
  onConnection: () => any,
  pendingResults: Result[]
): Result {
  const observerPromise = connectionHolder
    .getConnection()
    .then(connection => {
      onConnection()
      pendingResults.forEach(r => r._cancel())
      return Promise.all(pendingResults).then(results => {
        if (connection) {
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
        } else {
          throw newError('No connection available')
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
 * @param {ConnectionHolder} connectionHolder - the connection holder used to get the result
 * @return {Result} new result.
 * @private
 */
function newCompletedResult(
  observerPromise: ResultStreamObserver | Promise<ResultStreamObserver>,
  query: Query,
  parameters: any,
  connectionHolder: ConnectionHolder = EMPTY_CONNECTION_HOLDER
): Result {
  return new Result(
    Promise.resolve(observerPromise),
    query,
    parameters,
    new ReadOnlyConnectionHolder(connectionHolder || EMPTY_CONNECTION_HOLDER)
  )
}

export default Transaction

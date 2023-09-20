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

/* eslint-disable @typescript-eslint/promise-function-async */
import { validateQueryAndParameters } from './internal/util.ts'
import Connection, { ApiTelemetryConfig } from './connection.ts'
import {
  ConnectionHolder,
  ReadOnlyConnectionHolder,
  EMPTY_CONNECTION_HOLDER
} from './internal/connection-holder.ts'
import { Bookmarks } from './internal/bookmarks.ts'
import { TxConfig } from './internal/tx-config.ts'

import {
  ResultStreamObserver,
  FailedObserver,
  CompletedObserver
} from './internal/observers.ts'

import { newError } from './error.ts'
import Result from './result.ts'
import { Query } from './types.ts'
import { RecordShape } from './record.ts'
import NotificationFilter from './notification-filter.ts'
import { TelemetryApis, TELEMETRY_APIS } from './internal/constants.ts'

type NonAutoCommitTelemetryApis = Exclude<TelemetryApis, typeof TELEMETRY_APIS.AUTO_COMMIT_TRANSACTION>
type NonAutoCommitApiTelemetryConfig = Omit<ApiTelemetryConfig, 'api'> & { api?: NonAutoCommitTelemetryApis }

/**
 * Represents a transaction in the Neo4j database.
 *
 * @access public
 */
class Transaction {
  private readonly _connectionHolder: ConnectionHolder
  private readonly _reactive: boolean
  private _state: any
  private readonly _onClose: () => void
  private readonly _onBookmarks: (newBookmarks: Bookmarks, previousBookmarks: Bookmarks, database?: string) => void
  private readonly _onConnection: () => void
  private readonly _onError: (error: Error) => Promise<Connection | null>
  private readonly _onComplete: (metadata: any, previousBookmarks?: Bookmarks) => void
  private readonly _fetchSize: number
  private readonly _results: any[]
  private readonly _impersonatedUser?: string
  private readonly _lowRecordWatermak: number
  private readonly _highRecordWatermark: number
  private _bookmarks: Bookmarks
  private readonly _activePromise: Promise<void>
  private _acceptActive: () => void
  private readonly _notificationFilter?: NotificationFilter
  private readonly _apiTelemetryConfig?: NonAutoCommitApiTelemetryConfig

  /**
   * @constructor
   * @param {object} args
   * @param {ConnectionHolder} args.connectionHolder - the connection holder to get connection from.
   * @param {function()} args.onClose - Function to be called when transaction is committed or rolled back.
   * @param {function(bookmarks: Bookmarks)} args.onBookmarks callback invoked when new bookmark is produced.
   * @param {function()} args.onConnection - Function to be called when a connection is obtained to ensure the conneciton
   * is not yet released.
   * @param {boolean} args.reactive whether this transaction generates reactive streams
   * @param {number} args.fetchSize - the record fetch size in each pulling batch.
   * @param {string} args.impersonatedUser - The name of the user which should be impersonated for the duration of the session.
   * @param {number} args.highRecordWatermark - The high watermark for the record buffer.
   * @param {number} args.lowRecordWatermark - The low watermark for the record buffer.
   * @param {NotificationFilter} args.notificationFilter - The notification filter used for this transaction.
   */
  constructor ({
    connectionHolder,
    onClose,
    onBookmarks,
    onConnection,
    reactive,
    fetchSize,
    impersonatedUser,
    highRecordWatermark,
    lowRecordWatermark,
    notificationFilter,
    apiTelemetryConfig
  }: {
    connectionHolder: ConnectionHolder
    onClose: () => void
    onBookmarks: (newBookmarks: Bookmarks, previousBookmarks: Bookmarks, database?: string) => void
    onConnection: () => void
    reactive: boolean
    fetchSize: number
    impersonatedUser?: string
    highRecordWatermark: number
    lowRecordWatermark: number
    notificationFilter?: NotificationFilter,
    apiTelemetryConfig?: NonAutoCommitApiTelemetryConfig
  }) {
    this._connectionHolder = connectionHolder
    this._reactive = reactive
    this._state = _states.ACTIVE
    this._onClose = onClose
    this._onBookmarks = onBookmarks
    this._onConnection = onConnection
    this._onError = this._onErrorCallback.bind(this)
    this._fetchSize = fetchSize
    this._onComplete = this._onCompleteCallback.bind(this)
    this._results = []
    this._impersonatedUser = impersonatedUser
    this._lowRecordWatermak = lowRecordWatermark
    this._highRecordWatermark = highRecordWatermark
    this._bookmarks = Bookmarks.empty()
    this._notificationFilter = notificationFilter
    this._apiTelemetryConfig = apiTelemetryConfig
    this._acceptActive = () => { } // satisfy DenoJS
    this._activePromise = new Promise((resolve, reject) => {
      this._acceptActive = resolve
    })
  }

  /**
   * @private
   * @param {Bookmarks | string |  string []} bookmarks
   * @param {TxConfig} txConfig
   * @param {Object} events List of observers to events
   * @returns {void}
   */
  _begin (getBookmarks: () => Promise<Bookmarks>, txConfig: TxConfig, events?: {
    onError: (error: Error) => void,
    onComplete: (metadata: any) => void
  }): void {
    this._connectionHolder
      .getConnection()
      .then(async connection => {
        this._onConnection()
        if (connection != null) {
          this._bookmarks = await getBookmarks()
          return connection.beginTransaction({
            bookmarks: this._bookmarks,
            txConfig,
            mode: this._connectionHolder.mode(),
            database: this._connectionHolder.database(),
            impersonatedUser: this._impersonatedUser,
            notificationFilter: this._notificationFilter,
            apiTelemetryConfig: this._apiTelemetryConfig,
            beforeError: (error: Error) =>  {
              if (events != null) {
                events.onError(error)
              }
              this._onError(error).catch(() => {})
            },
            afterComplete: (metadata: any) => {
              if (events != null) {
                events.onComplete(metadata)
              }
              this._onComplete(metadata)
            }
          })
        } else {
          throw newError('No connection available')
        }
      })
      .catch(error => {
        if (events != null) {
          events.onError(error)
        }
        this._onError(error).catch(() => {})
      })
      // It should make the transaction active anyway
      // further errors will be treated by the existing
      // observers
      .finally(() => this._acceptActive())
  }

  /**
   * Run Cypher query
   * Could be called with a query object i.e.: `{text: "MATCH ...", parameters: {param: 1}}`
   * or with the query and parameters as separate arguments.
   * @param {mixed} query - Cypher query to execute
   * @param {Object} parameters - Map with parameters to use in query
   * @return {Result} New Result
   */
  run<R extends RecordShape = RecordShape> (query: Query, parameters?: any): Result<R> {
    const { validatedQuery, params } = validateQueryAndParameters(
      query,
      parameters
    )

    const result = this._state.run(validatedQuery, params, {
      connectionHolder: this._connectionHolder,
      onError: this._onError,
      onComplete: this._onComplete,
      onConnection: this._onConnection,
      reactive: this._reactive,
      fetchSize: this._fetchSize,
      highRecordWatermark: this._highRecordWatermark,
      lowRecordWatermark: this._lowRecordWatermak,
      preparationJob: this._activePromise
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
  commit (): Promise<void> {
    const committed = this._state.commit({
      connectionHolder: this._connectionHolder,
      onError: this._onError,
      onComplete: (meta: any) => this._onCompleteCallback(meta, this._bookmarks),
      onConnection: this._onConnection,
      pendingResults: this._results,
      preparationJob: this._activePromise
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
  rollback (): Promise<void> {
    const rolledback = this._state.rollback({
      connectionHolder: this._connectionHolder,
      onError: this._onError,
      onComplete: this._onComplete,
      onConnection: this._onConnection,
      pendingResults: this._results,
      preparationJob: this._activePromise
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
  isOpen (): boolean {
    return this._state === _states.ACTIVE
  }

  /**
   * Closes the transaction
   *
   * This method will roll back the transaction if it is not already committed or rolled back.
   *
   * @returns {Promise<void>} An empty promise if closed successfully or error if any error happened during
   */
  async close (): Promise<void> {
    if (this.isOpen()) {
      await this.rollback()
    }
  }

  _onErrorCallback (): Promise<Connection | null> {
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
   * @param {object} meta The meta with bookmarks
   * @returns {void}
   */
  _onCompleteCallback (meta: { bookmark?: string | string[], db?: string }, previousBookmarks?: Bookmarks): void {
    this._onBookmarks(new Bookmarks(meta?.bookmark), previousBookmarks ?? Bookmarks.empty(), meta?.db)
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
  highRecordWatermark: number
  lowRecordWatermark: number
  preparationJob?: Promise<any>
}

const _states = {
  // The transaction is running with no explicit success or failure marked
  ACTIVE: {
    commit: ({
      connectionHolder,
      onError,
      onComplete,
      onConnection,
      pendingResults,
      preparationJob
    }: StateTransitionParams): any => {
      return {
        result: finishTransaction(
          true,
          connectionHolder,
          onError,
          onComplete,
          onConnection,
          pendingResults,
          preparationJob
        ),
        state: _states.SUCCEEDED
      }
    },
    rollback: ({
      connectionHolder,
      onError,
      onComplete,
      onConnection,
      pendingResults,
      preparationJob
    }: StateTransitionParams): any => {
      return {
        result: finishTransaction(
          false,
          connectionHolder,
          onError,
          onComplete,
          onConnection,
          pendingResults,
          preparationJob
        ),
        state: _states.ROLLED_BACK
      }
    },
    run: (
      query: string,
      parameters: any,
      {
        connectionHolder,
        onError,
        onComplete,
        onConnection,
        reactive,
        fetchSize,
        highRecordWatermark,
        lowRecordWatermark,
        preparationJob
      }: StateTransitionParams
    ): any => {
      // RUN in explicit transaction can't contain bookmarks and transaction configuration
      // No need to include mode and database name as it shall be included in begin
      const requirements = preparationJob ?? Promise.resolve()

      const observerPromise =
        connectionHolder.getConnection()
          .then(conn => requirements.then(() => conn))
          .then(conn => {
            onConnection()
            if (conn != null) {
              return conn.run(query, parameters, {
                bookmarks: Bookmarks.empty(),
                txConfig: TxConfig.empty(),
                beforeError: onError,
                afterComplete: onComplete,
                reactive,
                fetchSize,
                highRecordWatermark,
                lowRecordWatermark
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
        connectionHolder,
        highRecordWatermark,
        lowRecordWatermark
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
          connectionHolder,
          0, // high watermark
          0 // low watermark
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
          connectionHolder,
          0, // high watermark
          0 // low watermark
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
        connectionHolder,
        0, // high watermark
        0 // low watermark
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
          {},
          EMPTY_CONNECTION_HOLDER,
          0, // high watermark
          0 // low watermark
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
          {},
          EMPTY_CONNECTION_HOLDER,
          0, // high watermark
          0 // low watermark
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
        connectionHolder,
        0, // high watermark
        0 // low watermark
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
          connectionHolder,
          0, // high watermark
          0 // low watermark
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
          connectionHolder,
          0, // high watermark
          0 // low watermark
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
        connectionHolder,
        0, // high watermark
        0 // low watermark
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
  commit: boolean,
  connectionHolder: ConnectionHolder,
  onError: (err: Error) => any,
  onComplete: (metadata: any) => any,
  onConnection: () => any,
  pendingResults: Result[],
  preparationJob?: Promise<void>
): Result {
  const requirements = preparationJob ?? Promise.resolve()

  const observerPromise =
    connectionHolder.getConnection()
      .then(conn => requirements.then(() => conn))
      .then(connection => {
        onConnection()
        pendingResults.forEach(r => r._cancel())
        return Promise.all(pendingResults.map(result => result.summary())).then(results => {
          if (connection != null) {
            if (commit) {
              return connection.commitTransaction({
                beforeError: onError,
                afterComplete: onComplete
              })
            } else {
              return connection.rollbackTransaction({
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
    connectionHolder,
    {
      high: Number.MAX_VALUE,
      low: Number.MAX_VALUE
    }
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
function newCompletedResult (
  observerPromise: ResultStreamObserver | Promise<ResultStreamObserver>,
  query: Query,
  parameters: any,
  connectionHolder: ConnectionHolder = EMPTY_CONNECTION_HOLDER,
  highRecordWatermark: number,
  lowRecordWatermark: number
): Result {
  return new Result(
    Promise.resolve(observerPromise),
    query,
    parameters,
    new ReadOnlyConnectionHolder(connectionHolder ?? EMPTY_CONNECTION_HOLDER),
    {
      low: lowRecordWatermark,
      high: highRecordWatermark
    }
  )
}

export default Transaction
export type {
  NonAutoCommitTelemetryApis,
  NonAutoCommitApiTelemetryConfig
} 

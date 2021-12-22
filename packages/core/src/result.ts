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

import ResultSummary from './result-summary'
import Record from './record'
import { Query } from './types'
import { observer, util, connectionHolder } from './internal'

const { EMPTY_CONNECTION_HOLDER } = connectionHolder

/**
 * @private
 * @param {Error} error The error
 * @returns {void}
 */
const DEFAULT_ON_ERROR = (error: Error) => {
  console.log('Uncaught error when processing result: ' + error)
}

/**
 * @private
 * @param {ResultSummary} summary
 * @returns {void}
 */
const DEFAULT_ON_COMPLETED = (summary: ResultSummary) => {}

/**
 * The query result is the combination of the {@link ResultSummary} and
 * the array {@link Record[]} produced by the query
 */
interface QueryResult {
  records: Record[]
  summary: ResultSummary
}

/**
 * Interface to observe updates on the Result which is being produced.
 *
 */
interface ResultObserver {
  /**
   * Receive the keys present on the record whenever this information is available
   *
   * @param {string[]} keys The keys present on the {@link Record}
   */
  onKeys?: (keys: string[]) => void

  /**
   * Receive the each record present on the {@link @Result}
   * @param {Record} record The {@link Record} produced
   */
  onNext?: (record: Record) => void

  /**
   * Called when the result is fully received
   * @param {ResultSummary} summary The result summary
   */
  onCompleted?: (summary: ResultSummary) => void

  /**
   * Called when some error occurs during the result proccess or query execution
   * @param {Error} error The error ocurred
   */
  onError?: (error: Error) => void
}

/**
 * A stream of {@link Record} representing the result of a query.
 * Can be consumed eagerly as {@link Promise} resolved with array of records and {@link ResultSummary}
 * summary, or rejected with error that contains {@link string} code and {@link string} message.
 * Alternatively can be consumed lazily using {@link Result#subscribe} function.
 * @access public
 */
class Result implements Promise<QueryResult> {
  private _stack: string | null
  private _streamObserverPromise: Promise<observer.ResultStreamObserver>
  private _p: Promise<QueryResult> | null
  private _query: Query
  private _parameters: any
  private _connectionHolder: connectionHolder.ConnectionHolder

  /**
   * Inject the observer to be used.
   * @constructor
   * @access private
   * @param {Promise<observer.ResultStreamObserver>} streamObserverPromise
   * @param {mixed} query - Cypher query to execute
   * @param {Object} parameters - Map with parameters to use in query
   * @param {ConnectionHolder} connectionHolder - to be notified when result is either fully consumed or error happened.
   */
  constructor(
    streamObserverPromise: Promise<observer.ResultStreamObserver>,
    query: Query,
    parameters?: any,
    connectionHolder?: connectionHolder.ConnectionHolder
  ) {
    this._stack = captureStacktrace()
    this._streamObserverPromise = streamObserverPromise
    this._p = null
    this._query = query
    this._parameters = parameters || {}
    this._connectionHolder = connectionHolder || EMPTY_CONNECTION_HOLDER
  }

  /**
   * Returns a promise for the field keys.
   *
   * *Should not be combined with {@link Result#subscribe} function.*
   *
   * @public
   * @returns {Promise<string[]>} - Field keys, in the order they will appear in records.
   }
   */
  keys(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this._streamObserverPromise
        .then(observer =>
          observer.subscribe({
            onKeys: keys => resolve(keys),
            onError: err => reject(err)
          })
        )
        .catch(reject)
    })
  }

  /**
   * Returns a promise for the result summary.
   *
   * *Should not be combined with {@link Result#subscribe} function.*
   *
   * @public
   * @returns {Promise<ResultSummary>} - Result summary.
   *
   */
  summary(): Promise<ResultSummary> {
    return new Promise((resolve, reject) => {
      this._streamObserverPromise
        .then(o => {
          o.cancel()
          o.subscribe({
            onCompleted: metadata =>
              this._createSummary(metadata).then(resolve, reject),
            onError: err => reject(err)
          })
        })
        .catch(reject)
    })
  }

  /**
   * Create and return new Promise
   *
   * @private
   * @return {Promise} new Promise.
   */
  private _getOrCreatePromise(): Promise<QueryResult> {
    if (!this._p) {
      this._p = new Promise((resolve, reject) => {
        const records: Record[] = []
        const observer = {
          onNext: (record: Record) => {
            records.push(record)
          },
          onCompleted: (summary: ResultSummary) => {
            resolve({ records: records, summary: summary })
          },
          onError: (error: Error) => {
            reject(error)
          }
        }
        this.subscribe(observer)
      })
    }

    return this._p
  }

  /**
   * Waits for all results and calls the passed in function with the results.
   *
   * *Should not be combined with {@link Result#subscribe} function.*
   *
   * @param {function(result: {records:Array<Record>, summary: ResultSummary})} onFulfilled - function to be called
   * when finished.
   * @param {function(error: {message:string, code:string})} onRejected - function to be called upon errors.
   * @return {Promise} promise.
   */
  then<TResult1 = QueryResult, TResult2 = never>(
    onFulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onRejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this._getOrCreatePromise().then(onFulfilled, onRejected)
  }

  /**
   * Catch errors when using promises.
   *
   * *Should not be combined with {@link Result#subscribe} function.*
   *
   * @param {function(error: Neo4jError)} onRejected - Function to be called upon errors.
   * @return {Promise} promise.
   */
  catch<TResult = never>(
    onRejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
  ): Promise<QueryResult | TResult> {
    return this._getOrCreatePromise().catch(onRejected)
  }

  /**
   * Called when finally the result is done
   *
   * *Should not be combined with {@link Result#subscribe} function.*
   * @param {function()|null} onfinally - function when the promise finished
   * @return {Promise} promise.
   */
  [Symbol.toStringTag]: string
  finally(onfinally?: (() => void) | null): Promise<QueryResult> {
    return this._getOrCreatePromise().finally(onfinally)
  }

  /**
   * Stream records to observer as they come in, this is a more efficient method
   * of handling the results, and allows you to handle arbitrarily large results.
   *
   * @param {Object} observer - Observer object
   * @param {function(keys: string[])} observer.onKeys - handle stream head, the field keys.
   * @param {function(record: Record)} observer.onNext - handle records, one by one.
   * @param {function(summary: ResultSummary)} observer.onCompleted - handle stream tail, the result summary.
   * @param {function(error: {message:string, code:string})} observer.onError - handle errors.
   * @return {void}
   */
  subscribe(observer: ResultObserver): void {
    const onCompletedOriginal = observer.onCompleted || DEFAULT_ON_COMPLETED
    const onCompletedWrapper = (metadata: any) => {
      this._createSummary(metadata).then(summary =>
        onCompletedOriginal.call(observer, summary)
      )
    }

    observer.onCompleted = onCompletedWrapper

    const onErrorOriginal = observer.onError || DEFAULT_ON_ERROR
    const onErrorWrapper = (error: Error) => {
      // notify connection holder that the used connection is not needed any more because error happened
      // and result can't bee consumed any further; call the original onError callback after that
      this._connectionHolder.releaseConnection().then(() => {
        replaceStacktrace(error, this._stack)
        onErrorOriginal.call(observer, error)
      })
    }
    observer.onError = onErrorWrapper

    this._streamObserverPromise
      .then(o => {
        return o.subscribe(observer)
      })
      .catch(error => observer.onError!(error))
  }

  /**
   * Signals the stream observer that the future records should be discarded on the server.
   *
   * @protected
   * @since 4.0.0
   * @returns {void}
   */
  _cancel(): void {
    this._streamObserverPromise.then(o => o.cancel())
  }

  private _createSummary(metadata: any): Promise<ResultSummary> {
    const {
      validatedQuery: query,
      params: parameters
    } = util.validateQueryAndParameters(this._query, this._parameters, {
      skipAsserts: true
    })
    const connectionHolder = this._connectionHolder

    return connectionHolder
      .getConnection()
      .then(
        // onFulfilled:
        connection =>
          connectionHolder
            .releaseConnection()
            .then(() =>
              connection ? connection.protocol().version : undefined
            ),
        // onRejected:
        _ => undefined
      )
      .then(
        protocolVersion =>
          new ResultSummary(query, parameters, metadata, protocolVersion)
      )
  }
}

function captureStacktrace(): string | null {
  const error = new Error('')
  if (error.stack) {
    return error.stack.replace(/^Error(\n\r)*/, '') // we don't need the 'Error\n' part, if only it exists
  }
  return null
}

/**
 * @private
 * @param {Error} error The error
 * @param {string| null} newStack The newStack
 * @returns {void}
 */
function replaceStacktrace(error: Error, newStack?: string | null) {
  if (newStack) {
    // Error.prototype.toString() concatenates error.name and error.message nicely
    // then we add the rest of the stack trace
    error.stack = error.toString() + '\n' + newStack
  }
}

export default Result
export type { QueryResult, ResultObserver }

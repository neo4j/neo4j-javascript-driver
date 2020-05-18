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

import ResultSummary from './result-summary'
import { EMPTY_CONNECTION_HOLDER } from './internal/connection-holder'
import { ResultStreamObserver } from './internal/stream-observers'

const DEFAULT_ON_ERROR = error => {
  console.log('Uncaught error when processing result: ' + error)
}
const DEFAULT_ON_COMPLETED = summary => {}
const DEFAULT_METADATA_SUPPLIER = metadata => {}

/**
 * A stream of {@link Record} representing the result of a query.
 * Can be consumed eagerly as {@link Promise} resolved with array of records and {@link ResultSummary}
 * summary, or rejected with error that contains {@link string} code and {@link string} message.
 * Alternatively can be consumed lazily using {@link Result#subscribe} function.
 * @access public
 */
class Result {
  /**
   * Inject the observer to be used.
   * @constructor
   * @access private
   * @param {Promise<ResultStreamObserver>} streamObserverPromise
   * @param {mixed} query - Cypher query to execute
   * @param {Object} parameters - Map with parameters to use in query
   * @param {ConnectionHolder} connectionHolder - to be notified when result is either fully consumed or error happened.
   */
  constructor (streamObserverPromise, query, parameters, connectionHolder) {
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
  keys () {
    return new Promise((resolve, reject) => {
      this._streamObserverPromise.then(observer =>
        observer.subscribe({
          onKeys: keys => resolve(keys),
          onError: err => reject(err)
        })
      )
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
  summary () {
    return new Promise((resolve, reject) => {
      this._streamObserverPromise.then(o => {
        o.cancel()
        o.subscribe({
          onCompleted: metadata => resolve(metadata),
          onError: err => reject(err)
        })
      })
    })
  }

  /**
   * Create and return new Promise
   *
   * @private
   * @return {Promise} new Promise.
   */
  _getOrCreatePromise () {
    if (!this._p) {
      this._p = new Promise((resolve, reject) => {
        const records = []
        const observer = {
          onNext: record => {
            records.push(record)
          },
          onCompleted: summary => {
            resolve({ records: records, summary: summary })
          },
          onError: error => {
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
  then (onFulfilled, onRejected) {
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
  catch (onRejected) {
    return this._getOrCreatePromise().catch(onRejected)
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
   * @return
   */
  subscribe (observer) {
    const onCompletedOriginal = observer.onCompleted || DEFAULT_ON_COMPLETED
    const onCompletedWrapper = metadata => {
      const connectionHolder = this._connectionHolder
      const query = this._query
      const parameters = this._parameters

      function release (protocolVersion) {
        // notify connection holder that the used connection is not needed any more because result has
        // been fully consumed; call the original onCompleted callback after that
        connectionHolder.releaseConnection().then(() => {
          onCompletedOriginal.call(
            observer,
            new ResultSummary(query, parameters, metadata, protocolVersion)
          )
        })
      }

      connectionHolder.getConnection().then(
        // onFulfilled:
        connection => {
          release(connection ? connection.protocol().version : undefined)
        },

        // onRejected:
        _ => {
          release()
        }
      )
    }

    observer.onCompleted = onCompletedWrapper

    const onErrorOriginal = observer.onError || DEFAULT_ON_ERROR
    const onErrorWrapper = error => {
      // notify connection holder that the used connection is not needed any more because error happened
      // and result can't bee consumed any further; call the original onError callback after that
      this._connectionHolder.releaseConnection().then(() => {
        replaceStacktrace(error, this._stack)
        onErrorOriginal.call(observer, error)
      })
    }
    observer.onError = onErrorWrapper

    this._streamObserverPromise.then(o => o.subscribe(observer))
  }

  /**
   * Signals the stream observer that the future records should be discarded on the server.
   *
   * @protected
   * @since 4.0.0
   */
  _cancel () {
    this._streamObserverPromise.then(o => o.cancel())
  }
}

function captureStacktrace () {
  const error = new Error('')
  if (error.stack) {
    return error.stack.replace(/^Error(\n\r)*/, '') // we don't need the 'Error\n' part, if only it exists
  }
  return null
}

function replaceStacktrace (error, newStack) {
  if (newStack) {
    // Error.prototype.toString() concatenates error.name and error.message nicely
    // then we add the rest of the stack trace
    error.stack = error.toString() + '\n' + newStack
  }
}

export default Result

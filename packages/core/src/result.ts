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
import { Query, PeekableAsyncIterator } from './types'
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
 * @private
 * @param {string[]} keys List of keys of the record in the result
 * @return {void} 
 */
const DEFAULT_ON_KEYS = (_keys: string[]) => {}

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
 * Defines a ResultObserver interface which can be used to enqueue records and dequeue 
 * them until the result is fully received.
 * @access private
 */
 interface QueuedResultObserver extends ResultObserver {
  dequeue (): Promise<IteratorResult<Record, ResultSummary>>
  head (): Promise<IteratorResult<Record, ResultSummary>>
  get size (): number
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
  private _keys: string[] | null
  private _summary: ResultSummary | null
  private _error: Error | null
  private _watermarks: { high: number; low: number }

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
    connectionHolder?: connectionHolder.ConnectionHolder,
    watermarks: { high: number; low: number } = { high: Number.MAX_VALUE, low: Number.MAX_VALUE }
  ) {
    this._stack = captureStacktrace()
    this._streamObserverPromise = streamObserverPromise
    this._p = null
    this._query = query
    this._parameters = parameters || {}
    this._connectionHolder = connectionHolder || EMPTY_CONNECTION_HOLDER
    this._keys = null
    this._summary = null
    this._error = null
    this._watermarks = watermarks
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
    if (this._keys !== null) {
      return Promise.resolve(this._keys)
    } else if (this._error !== null) {
      return Promise.reject(this._error)
    }
    return new Promise((resolve, reject) => {
      this._streamObserverPromise
        .then(observer =>
          observer.subscribe(this._decorateObserver({
            onKeys: keys => resolve(keys),
            onError: err => reject(err)
          }))
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
    if (this._summary != null) {
      return Promise.resolve(this._summary)
    } else if (this._error !== null) {
      return Promise.reject(this._error)
    }
    return new Promise((resolve, reject) => {
      this._streamObserverPromise
        .then(o => {
          o.cancel()
          o.subscribe(this._decorateObserver({
            onCompleted: summary => resolve(summary),
            onError: err => reject(err)
          }))
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
   * Provides a async iterator over the records in the result.
   *
   * *Should not be combined with {@link Result#subscribe} or ${@link Result#then} functions.*
   *
   * @public
   * @returns {PeekableAsyncIterator<Record, ResultSummary>} The async iterator for the Results
   */
  [Symbol.asyncIterator](): PeekableAsyncIterator<Record, ResultSummary> {
    const state: {
      paused: boolean,
      firstRun: boolean,
      finished: boolean,
      queuedObserver?: QueuedResultObserver,
      streaming?: observer.ResultStreamObserver,
      summary?: ResultSummary,
    } = { paused: true, firstRun: true, finished: false }


    const controlFlow = async  () => {
      if (state.queuedObserver === undefined) {
        state.queuedObserver = this._createQueuedResultObserver()
        state.streaming = await this._subscribe(state.queuedObserver, true).catch(() => undefined)
      }
      if (state.queuedObserver.size >= this._watermarks.high && !state.paused) {
        state.paused = true
        state.streaming?.pause()
      } else if (state.queuedObserver.size <= this._watermarks.low && state.paused || state.firstRun) {
        state.firstRun = false
        state.paused = false
        state.streaming?.resume()
      }
    }

    return {
      next: async () => {
        if (state.finished) {
          return { done: true, value: state.summary! }
        }
        await controlFlow()
        const next = await state.queuedObserver!.dequeue()
        if (next.done) {
          state.finished = next.done
          state.summary = next.value
        }
        return next
      },
      return: async (value: ResultSummary) => {
        state.finished = true
        state.summary = value
        state.streaming?.cancel()
        return { done: true, value: value }
      },
      peek: async () => {
        if (state.finished) {
          return { done: true, value: state.summary! }
        }
        await controlFlow()
        return await state.queuedObserver!.head()
      }
    }
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
    if (this._error !== null) {
      return Promise.reject(this._error).then(onFulfilled, onRejected)
    }
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
    if (this._error !== null) {
      return Promise.reject(this._error).catch(onRejected)
    }
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
    if (this._error !== null) {
      return Promise.reject(this._error).finally(onfinally)
    }
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
    this._subscribe(observer)
      .catch(() => {})
  }

  /**
   * Stream records to observer as they come in, this is a more efficient method
   * of handling the results, and allows you to handle arbitrarily large results.
   *
   * @access private
   * @param {ResultObserver} observer The observer to send records to.
   * @param {boolean} paused The flag to indicate if the stream should be started paused
   * @returns {Promise<observer.ResultStreamObserver>} The result stream observer.
   */
  _subscribe(observer: ResultObserver, paused: boolean = false): Promise<observer.ResultStreamObserver> {
    const _observer = this._decorateObserver(observer)

    return this._streamObserverPromise
      .then(o => {
        if (paused) {
          o.pause()
        }
        o.subscribe(_observer)
        return o
      })
      .catch(error => { 
        _observer.onError!(error)
        return Promise.reject(error)
      })
  }

  /**
   * Decorates the ResultObserver with the necessary methods.
   *
   * @access private
   * @param {ResultObserver} observer The ResultObserver to decorate.
   * @returns The decorated result observer
   */
  _decorateObserver(observer: ResultObserver): ResultObserver {
    const onCompletedOriginal = observer.onCompleted || DEFAULT_ON_COMPLETED
    const onCompletedWrapper = (metadata: any) => {

      this._createSummary(metadata).then(summary => {
        this._summary = summary
        return onCompletedOriginal.call(observer, summary)
      })
    }

    const onErrorOriginal = observer.onError || DEFAULT_ON_ERROR
    const onErrorWrapper = (error: Error) => {
      this._error = error
      // notify connection holder that the used connection is not needed any more because error happened
      // and result can't bee consumed any further; call the original onError callback after that
      this._connectionHolder.releaseConnection().then(() => {
        replaceStacktrace(error, this._stack)
        onErrorOriginal.call(observer, error)
      })
    }

    const onKeysOriginal = observer.onKeys || DEFAULT_ON_KEYS
    const onKeysWrapper = (keys: string[]) => {
      this._keys = keys
      return onKeysOriginal.call(observer, keys)
    }

    return {
      onNext: observer.onNext? observer.onNext.bind(observer) : undefined,
      onKeys: onKeysWrapper,
      onCompleted: onCompletedWrapper,
      onError: onErrorWrapper
    }
  }

  /**
   * Closes the result and discard not consumed records. 
   */
  close(): Promise<void> {
    if (this._summary !== null || this._error !== null) { 
      return Promise.resolve()
    }
    return this._streamObserverPromise.catch(_ => {
      // does not matter
      return { close: () => {} }
    }).then(o => o.close())
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

  /**
   * @access private
   * @param metadata
   * @returns
   */
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

  /**
   * @access private
   */
   private _createQueuedResultObserver (): QueuedResultObserver {
    interface ResolvablePromise<T> {
      promise: Promise<T>
      resolve: (arg: T) => any | undefined
      reject: (arg: Error) => any | undefined
    }

    function createResolvablePromise (): ResolvablePromise<IteratorResult<Record, ResultSummary>> {
      const resolvablePromise: any = {}
      resolvablePromise.promise = new Promise((resolve, reject) => {
        resolvablePromise.resolve = resolve
        resolvablePromise.reject = reject
      });
      return resolvablePromise;
    }

    type QueuedResultElementOrError = IteratorResult<Record, ResultSummary> | Error

    function isError(elementOrError: QueuedResultElementOrError): elementOrError is Error {
      return elementOrError instanceof Error
    }

    const buffer: QueuedResultElementOrError[] = []
    const promiseHolder: {
      resolvable: ResolvablePromise<IteratorResult<Record, ResultSummary>> | null
    } = { resolvable: null }

    const observer = {
      onNext: (record: Record) => {
        observer._push({ done: false, value: record })
      },
      onCompleted: (summary: ResultSummary) => {
        observer._push({ done: true, value: summary })
      },
      onError: (error: Error) => {
        observer._push(error)
      },
      _push(element: QueuedResultElementOrError) {
        if (promiseHolder.resolvable !== null) {
          const resolvable = promiseHolder.resolvable
          promiseHolder.resolvable = null
          if (isError(element)) {
            resolvable.reject(element)
          } else {
            resolvable.resolve(element)
          }
        } else {
          buffer.push(element)
        }
      },
      dequeue: async () => {
        if (buffer.length > 0) {
          const element = buffer.shift()!
          if (isError(element)) {
              throw element
          }
          return element
        }
        promiseHolder.resolvable = createResolvablePromise()
        return await promiseHolder.resolvable.promise
      },
      head: async () => {
        if (buffer.length > 0) {
          const element = buffer[0]
          if (isError(element)) {
              throw element
          }
          return element
        }
        promiseHolder.resolvable = createResolvablePromise()
        try {
          const element =  await promiseHolder.resolvable.promise
          buffer.unshift(element)
          return element
        } catch (error) {
          buffer.unshift(error)
          throw error
        }
      },
      get size (): number {
        return buffer.length
      }
    }

    return observer
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

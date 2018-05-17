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

import ResultSummary from './result-summary';
import {EMPTY_CONNECTION_HOLDER} from './internal/connection-holder';

const DEFAULT_ON_ERROR = error => {
  console.log('Uncaught error when processing result: ' + error);
};
const DEFAULT_ON_COMPLETED = summary => {
};

/**
 * A stream of {@link Record} representing the result of a statement.
 * Can be consumed eagerly as {@link Promise} resolved with array of records and {@link ResultSummary}
 * summary, or rejected with error that contains {@link string} code and {@link string} message.
 * Alternatively can be consumed lazily using <code>Result.subscribe()</code> function.
 * @access public
 */
class Result {
  /**
   * Inject the observer to be used.
   * @constructor
   * @access private
   * @param {StreamObserver} streamObserver
   * @param {mixed} statement - Cypher statement to execute
   * @param {Object} parameters - Map with parameters to use in statement
   * @param metaSupplier function, when called provides metadata
   * @param {ConnectionHolder} connectionHolder - to be notified when result is either fully consumed or error happened.
   */
  constructor(streamObserver, statement, parameters, metaSupplier, connectionHolder) {
    this._stack = captureStacktrace();
    this._streamObserver = streamObserver;
    this._p = null;
    this._statement = statement;
    this._parameters = parameters || {};
    this._metaSupplier = metaSupplier || function(){return {};};
    this._connectionHolder = connectionHolder || EMPTY_CONNECTION_HOLDER;
  }

  /**
   * Create and return new Promise
   * @return {Promise} new Promise.
   * @access private
   */
  _createPromise() {
    if(this._p) {
      return;
    }
    let self = this;
    this._p = new Promise((resolve, reject) => {
      let records = [];
      let observer = {
        onNext: (record) => { records.push(record); },
        onCompleted: (summary) => {
          resolve({records: records, summary: summary});
        },
        onError: (error) => { reject(error); }
      };
      self.subscribe(observer);
    });
  }

  /**
   * Waits for all results and calls the passed in function with the results.
   * Cannot be combined with the <code>Result.subscribe()</code> function.
   *
   * @param {function(result: {records:Array<Record>, summary: ResultSummary})} onFulfilled - function to be called
   * when finished.
   * @param {function(error: {message:string, code:string})} onRejected - function to be called upon errors.
   * @return {Promise} promise.
   */
  then(onFulfilled, onRejected) {
    this._createPromise();
    return this._p.then(onFulfilled, onRejected);
  }

  /**
   * Catch errors when using promises.
   * Cannot be used with the subscribe function.
   * @param {function(error: Neo4jError)} onRejected - Function to be called upon errors.
   * @return {Promise} promise.
   */
  catch(onRejected) {
    this._createPromise();
    return this._p.catch(onRejected);
  }

  /**
   * Stream records to observer as they come in, this is a more efficient method
   * of handling the results, and allows you to handle arbitrarily large results.
   *
   * @param {Object} observer - Observer object
   * @param {function(record: Record)} observer.onNext - handle records, one by one.
   * @param {function(summary: ResultSummary)} observer.onCompleted - handle stream tail, the result summary.
   * @param {function(error: {message:string, code:string})} observer.onError - handle errors.
   * @return
   */
  subscribe(observer) {
    const self = this;

    const onCompletedOriginal = observer.onCompleted || DEFAULT_ON_COMPLETED;
    const onCompletedWrapper = (metadata) => {
      const additionalMeta = self._metaSupplier();
      for (let key in additionalMeta) {
        if (additionalMeta.hasOwnProperty(key)) {
          metadata[key] = additionalMeta[key];
        }
      }
      const sum = new ResultSummary(this._statement, this._parameters, metadata);

      // notify connection holder that the used connection is not needed any more because result has
      // been fully consumed; call the original onCompleted callback after that
      self._connectionHolder.releaseConnection().then(() => {
        onCompletedOriginal.call(observer, sum);
      });
    };
    observer.onCompleted = onCompletedWrapper;

    const onErrorOriginal = observer.onError || DEFAULT_ON_ERROR;
    const onErrorWrapper = error => {
      // notify connection holder that the used connection is not needed any more because error happened
      // and result can't bee consumed any further; call the original onError callback after that
      self._connectionHolder.releaseConnection().then(() => {
        replaceStacktrace(error, this._stack);
        onErrorOriginal.call(observer, error);
      });
    };
    observer.onError = onErrorWrapper;

    this._streamObserver.subscribe(observer);
  }
}

function captureStacktrace() {
  const error = new Error('');
  if (error.stack) {
    return error.stack.replace(/^Error(\n\r)*/, ''); // we don't need the 'Error\n' part, if only it exists
  }
  return null;
}

function replaceStacktrace(error, newStack) {
  if (newStack) {
    // Error.prototype.toString() concatenates error.name and error.message nicely
    // then we add the rest of the stack trace
    error.stack = error.toString() + '\n' + newStack;
  }
}

export default Result;

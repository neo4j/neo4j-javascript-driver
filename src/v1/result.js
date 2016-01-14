/**
 * Copyright (c) 2002-2016 "Neo Technology,"
 * Network Engine for Objects in Lund AB [http://neotechnology.com]
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

import {ResultSummary} from './result-summary';

// Ensure Promise is available
import {polyfill as polyfillPromise} from '../external/es6-promise';
polyfillPromise();

/**
  * A Result instance is used for retrieving request response.
  * @access public
  */
class Result {
  /**
   * Inject the observer to be used.
   * @constructor
   * @param {StreamObserver} streamObserver
   */
  constructor(streamObserver, statement, parameters) {
    this._streamObserver = streamObserver;
    this._p = null;
    this._statement = statement;
    this._parameters = parameters;
  }

  /**
   * Create and return new Promise
   * @return {Promise} new Promise.
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
          records.summary = summary;
          resolve(records);
        },
        onError: (error) => { reject(error); }
      };
      self.subscribe(observer);
    });
  }

  /**
   * Waits for all results and calls the passed in function
   * with the results.
   * Cannot be used with the subscribe function.
   * @param {function(results: Object)} cb - Function to be called when all results are collected.
   * @return {Promise} promise.
   */
  then(onFulfilled, onRejected) {
    this._createPromise();
    this._p.then(onFulfilled, onRejected);
    return this._p;
  }

  /**
   * Catch errors when using promises.
   * Cannot be used with the subscribe function.
   * @param {function(error: Object)} cb - Function to be called upon errors.
   * @return {Promise} promise.
   */
  catch(onRejected) {
    this._createPromise();
    this._p.catch(onRejected);
    return this._p;
  }

  /**
   * Stream results to observer as they come in.
   * @param {Object} observer - Observer object
   * @param {function(record: Object)} observer.onNext - Handle records, one by one.
   * @param {function(metadata: Object)} observer.onComplete - Handle stream tail, the metadata.
   * @param {function(error: Object)} observer.onError - Handle errors.
   * @return
   */
  subscribe(observer) {
    let onCompletedOriginal = observer.onCompleted;
    let onCompletedWrapper = (metadata) => {
      let sum = new ResultSummary(this._statement, this._parameters, metadata);
      onCompletedOriginal.call(observer, sum);
    };
    observer.onCompleted = onCompletedWrapper;
    this._streamObserver.subscribe(observer);
  }
}

export default Result

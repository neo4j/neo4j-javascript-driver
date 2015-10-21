/**
 * Copyright (c) 2002-2015 "Neo Technology,"
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

import neo4j from './neo4j';

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
    this.summary = {}
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
        onCompleted: () => { resolve(records); },
        onError: (error) => { reject(error); }
      }
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
  then(cb) {
    this._createPromise();
    this._p.then(cb);
    return this._p;
  }

  /**
   * Catch errors when using promises.
   * Cannot be used with the subscribe function.
   * @param {function(error: Object)} cb - Function to be called upon errors.
   * @return {Promise} promise.
   */
  catch(cb) {
    this._createPromise();
    this._p.catch(cb);
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
      this.summary = new ResultSummary(this._statement, this._parameters, metadata.type, metadata.stats);
      onCompletedOriginal(metadata);
    }
    observer.onCompleted = onCompletedWrapper;
    this._streamObserver.subscribe(observer);
  }

  /**
   * Get a metadata summary for the statement.
   * @return {ResultSummary} - A ResultSummary class.
   */
  summarize() {
    return this.summary;
  }
}

/**
  * A ResultSummary instance contains structured metadata for a {Result}.
  * @access public
  */
class ResultSummary {
  /**
   * @constructor
   * @param {string} statement - The statement this summary is for
   * @param {Object} parameters - Parameters for the statement
   * @param {string} statementType - How did the statement effect the database
   * @param {Object} statistics - Result statistics
   */
  constructor(statement, parameters, statementType, statistics) {
    this.statement = {text: statement, parameters};
    this.statementType = statementType;
    this.statistics = new StatementStatistics(statistics || {});
  }
}    

/**
  * Get statistical information for a {Result}.
  * @access public
  */
class StatementStatistics {
  /**
   * Structurize the statistics
   * @constructor
   * @param {Object} statistics - Result statistics
   */
  constructor(statistics) {
    this._stats = {
      nodesCreated: 0,
      nodesDelete: 0,
      relationshipsCreated: 0,
      relationshipsDeleted: 0,
      propertiesSet: 0,
      labelsAdded: 0,
      labelsRemoved: 0,
      indexesAdded: 0,
      indexesRemoved: 0,
      constraintsAdded: 0,
      constraintsRemoved: 0
    }
    Object.keys(statistics).forEach((index) => {
      let val = neo4j.isInt(statistics[index]) ? statistics[index].toInt() : statistics[index];
      //To camelCase
      this._stats[index.replace(/(\-\w)/g, (m) => m[1].toUpperCase())] = val;
    });
  }

  /**
   * Did the database get updated?
   * @return {boolean}
   */
  containsUpdates() {
    return Object.keys(this._stats).reduce((last, current) => {
      return last + this._stats[current];
    }, 0) > 0;
  }

  /**
   * @return {Number} - Number of nodes created.
   */
  nodesCreated() {
    return this._stats.nodesCreated;
  }

  /**
   * @return {Number} - Number of nodes deleted.
   */
  nodesDeleted() {
    return this._stats.nodesDeleted;
  }

  /**
   * @return {Number} - Number of relationships created.
   */
  relationshipsCreated() {
    return this._stats.relationshipsCreated;
  }

  /**
   * @return {Number} - Number of nodes deleted.
   */
  relationshipsDeleted() {
    return this._stats.relationshipsDeleted;
  }

  /**
   * @return {Number} - Number of properties set.
   */
  propertiesSet() {
    return this._stats.propertiesSet;
  }

  /**
   * @return {Number} - Number of labels added.
   */
  labelsAdded() {
    return this._stats.labelsAdded;
  }

  /**
   * @return {Number} - Number of labels removed.
   */
  labelsRemoved() {
    return this._stats.labelsRemoved;
  }

  /**
   * @return {Number} - Number of indexes added.
   */
  indexesAdded() {
    return this._stats.indexesAdded;
  }

  /**
   * @return {Number} - Number of indexes removed.
   */
  indexesRemoved() {
    return this._stats.indexesRemoved;
  }

  /**
   * @return {Number} - Number of contraints added.
   */
  constraintsAdded() {
    return this._stats.constraintsAdded;
  }

  /**
   * @return {Number} - Number of contraints removed.
   */
  constraintsRemoved() {
    return this._stats.constraintsRemoved;
  }
}

export default Result;

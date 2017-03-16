'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _resultSummary = require('./result-summary');

var _resultSummary2 = _interopRequireDefault(_resultSummary);

var _connectionHolder = require('./internal/connection-holder');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
  * A stream of {@link Record} representing the result of a statement.
  * @access public
  */
/**
 * Copyright (c) 2002-2017 "Neo Technology,","
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

var Result = function () {
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
  function Result(streamObserver, statement, parameters, metaSupplier, connectionHolder) {
    (0, _classCallCheck3.default)(this, Result);

    this._streamObserver = streamObserver;
    this._p = null;
    this._statement = statement;
    this._parameters = parameters || {};
    this._metaSupplier = metaSupplier || function () {
      return {};
    };
    this._connectionHolder = connectionHolder || _connectionHolder.EMPTY_CONNECTION_HOLDER;
  }

  /**
   * Create and return new Promise
   * @return {Promise} new Promise.
   * @access private
   */


  (0, _createClass3.default)(Result, [{
    key: '_createPromise',
    value: function _createPromise() {
      if (this._p) {
        return;
      }
      var self = this;
      this._p = new _promise2.default(function (resolve, reject) {
        var records = [];
        var observer = {
          onNext: function onNext(record) {
            records.push(record);
          },
          onCompleted: function onCompleted(summary) {
            resolve({ records: records, summary: summary });
          },
          onError: function onError(error) {
            reject(error);
          }
        };
        self.subscribe(observer);
      });
    }

    /**
     * Waits for all results and calls the passed in function with the results.
     * Cannot be combined with the {@link #subscribe} function.
     *
     * @param {function(result: {records:Array<Record>})} onFulfilled - Function to be called when finished.
     * @param {function(error: {message:string, code:string})} onRejected - Function to be called upon errors.
     * @return {Promise} promise.
     */

  }, {
    key: 'then',
    value: function then(onFulfilled, onRejected) {
      this._createPromise();
      return this._p.then(onFulfilled, onRejected);
    }

    /**
     * Catch errors when using promises.
     * Cannot be used with the subscribe function.
     * @param {function(error: {message:string, code:string})} onRejected - Function to be called upon errors.
     * @return {Promise} promise.
     */

  }, {
    key: 'catch',
    value: function _catch(onRejected) {
      this._createPromise();
      return this._p.catch(onRejected);
    }

    /**
     * Stream records to observer as they come in, this is a more efficient method
     * of handling the results, and allows you to handle arbitrarily large results.
     *
     * @param {Object} observer - Observer object
     * @param {function(record: Record)} observer.onNext - Handle records, one by one.
     * @param {function(metadata: Object)} observer.onCompleted - Handle stream tail, the metadata.
     * @param {function(error: {message:string, code:string})} observer.onError - Handle errors.
     * @return
     */

  }, {
    key: 'subscribe',
    value: function subscribe(observer) {
      var _this = this;

      var onCompletedOriginal = observer.onCompleted;
      var self = this;
      var onCompletedWrapper = function onCompletedWrapper(metadata) {

        var additionalMeta = self._metaSupplier();
        for (var key in additionalMeta) {
          if (additionalMeta.hasOwnProperty(key)) {
            metadata[key] = additionalMeta[key];
          }
        }
        var sum = new _resultSummary2.default(_this._statement, _this._parameters, metadata);

        // notify connection holder that the used connection is not needed any more because result has
        // been fully consumed; call the original onCompleted callback after that
        self._connectionHolder.releaseConnection().then(function () {
          onCompletedOriginal.call(observer, sum);
        });
      };
      observer.onCompleted = onCompletedWrapper;

      var onErrorOriginal = observer.onError || function (error) {
        console.log("Uncaught error when processing result: " + error);
      };

      var onErrorWrapper = function onErrorWrapper(error) {
        // notify connection holder that the used connection is not needed any more because error happened
        // and result can't bee consumed any further; call the original onError callback after that
        self._connectionHolder.releaseConnection().then(function () {
          onErrorOriginal.call(observer, error);
        });
      };
      observer.onError = onErrorWrapper;

      this._streamObserver.subscribe(observer);
    }
  }]);
  return Result;
}();

exports.default = Result;
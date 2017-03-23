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

var _error = require('../error');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var DEFAULT_MAX_RETRY_TIME_MS = 30 * 1000; // 30 seconds
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

var DEFAULT_INITIAL_RETRY_DELAY_MS = 1000; // 1 seconds
var DEFAULT_RETRY_DELAY_MULTIPLIER = 2.0;
var DEFAULT_RETRY_DELAY_JITTER_FACTOR = 0.2;

var TransactionExecutor = function () {
  function TransactionExecutor(maxRetryTimeMs, initialRetryDelayMs, multiplier, jitterFactor) {
    (0, _classCallCheck3.default)(this, TransactionExecutor);

    this._maxRetryTimeMs = _valueOrDefault(maxRetryTimeMs, DEFAULT_MAX_RETRY_TIME_MS);
    this._initialRetryDelayMs = _valueOrDefault(initialRetryDelayMs, DEFAULT_INITIAL_RETRY_DELAY_MS);
    this._multiplier = _valueOrDefault(multiplier, DEFAULT_RETRY_DELAY_MULTIPLIER);
    this._jitterFactor = _valueOrDefault(jitterFactor, DEFAULT_RETRY_DELAY_JITTER_FACTOR);

    this._inFlightTimeoutIds = [];

    this._verifyAfterConstruction();
  }

  (0, _createClass3.default)(TransactionExecutor, [{
    key: 'execute',
    value: function execute(transactionCreator, transactionWork) {
      var _this = this;

      return new _promise2.default(function (resolve, reject) {
        _this._executeTransactionInsidePromise(transactionCreator, transactionWork, resolve, reject);
      }).catch(function (error) {
        var retryStartTimeMs = Date.now();
        var retryDelayMs = _this._initialRetryDelayMs;
        return _this._retryTransactionPromise(transactionCreator, transactionWork, error, retryStartTimeMs, retryDelayMs);
      });
    }
  }, {
    key: 'close',
    value: function close() {
      // cancel all existing timeouts to prevent further retries
      this._inFlightTimeoutIds.forEach(function (timeoutId) {
        return clearTimeout(timeoutId);
      });
      this._inFlightTimeoutIds = [];
    }
  }, {
    key: '_retryTransactionPromise',
    value: function _retryTransactionPromise(transactionCreator, transactionWork, error, retryStartTime, retryDelayMs) {
      var _this2 = this;

      var elapsedTimeMs = Date.now() - retryStartTime;

      if (elapsedTimeMs > this._maxRetryTimeMs || !TransactionExecutor._canRetryOn(error)) {
        return _promise2.default.reject(error);
      }

      return new _promise2.default(function (resolve, reject) {
        var nextRetryTime = _this2._computeDelayWithJitter(retryDelayMs);
        var timeoutId = setTimeout(function () {
          // filter out this timeoutId when time has come and function is being executed
          _this2._inFlightTimeoutIds = _this2._inFlightTimeoutIds.filter(function (id) {
            return id !== timeoutId;
          });
          _this2._executeTransactionInsidePromise(transactionCreator, transactionWork, resolve, reject);
        }, nextRetryTime);
        // add newly created timeoutId to the list of all in-flight timeouts
        _this2._inFlightTimeoutIds.push(timeoutId);
      }).catch(function (error) {
        var nextRetryDelayMs = retryDelayMs * _this2._multiplier;
        return _this2._retryTransactionPromise(transactionCreator, transactionWork, error, retryStartTime, nextRetryDelayMs);
      });
    }
  }, {
    key: '_executeTransactionInsidePromise',
    value: function _executeTransactionInsidePromise(transactionCreator, transactionWork, resolve, reject) {
      try {
        var tx = transactionCreator();
        var transactionWorkResult = transactionWork(tx);

        // user defined callback is supposed to return a promise, but it might not; so to protect against an
        // incorrect API usage we wrap the returned value with a resolved promise; this is effectively a
        // validation step without type checks
        var resultPromise = _promise2.default.resolve(transactionWorkResult);

        resultPromise.then(function (result) {
          if (tx.isOpen()) {
            // transaction work returned resolved promise and transaction has not been committed/rolled back
            // try to commit the transaction
            tx.commit().then(function () {
              // transaction was committed, return result to the user
              resolve(result);
            }).catch(function (error) {
              // transaction failed to commit, propagate the failure
              reject(error);
            });
          } else {
            // transaction work returned resolved promise and transaction is already committed/rolled back
            // return the result returned by given transaction work
            resolve(result);
          }
        }).catch(function (error) {
          // transaction work returned rejected promise, propagate the failure
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    }
  }, {
    key: '_computeDelayWithJitter',
    value: function _computeDelayWithJitter(delayMs) {
      var jitter = delayMs * this._jitterFactor;
      var min = delayMs - jitter;
      var max = delayMs + jitter;
      return Math.random() * (max - min) + min;
    }
  }, {
    key: '_verifyAfterConstruction',
    value: function _verifyAfterConstruction() {
      if (this._maxRetryTimeMs < 0) {
        throw (0, _error.newError)('Max retry time should be >= 0: ' + this._maxRetryTimeMs);
      }
      if (this._initialRetryDelayMs < 0) {
        throw (0, _error.newError)('Initial retry delay should >= 0: ' + this._initialRetryDelayMs);
      }
      if (this._multiplier < 1.0) {
        throw (0, _error.newError)('Multiplier should be >= 1.0: ' + this._multiplier);
      }
      if (this._jitterFactor < 0 || this._jitterFactor > 1) {
        throw (0, _error.newError)('Jitter factor should be in [0.0, 1.0]: ' + this._jitterFactor);
      }
    }
  }], [{
    key: '_canRetryOn',
    value: function _canRetryOn(error) {
      return error && error.code && (error.code === _error.SERVICE_UNAVAILABLE || error.code === _error.SESSION_EXPIRED || this._isTransientError(error));
    }
  }, {
    key: '_isTransientError',
    value: function _isTransientError(error) {
      // Retries should not happen when transaction was explicitly terminated by the user.
      // Termination of transaction might result in two different error codes depending on where it was
      // terminated. These are really client errors but classification on the server is not entirely correct and
      // they are classified as transient.

      var code = error.code;
      if (code.indexOf('TransientError') >= 0) {
        if (code === 'Neo.TransientError.Transaction.Terminated' || code === 'Neo.TransientError.Transaction.LockClientStopped') {
          return false;
        }
        return true;
      }
      return false;
    }
  }]);
  return TransactionExecutor;
}();

exports.default = TransactionExecutor;
;

function _valueOrDefault(value, defaultValue) {
  if (value || value === 0) {
    return value;
  }
  return defaultValue;
}
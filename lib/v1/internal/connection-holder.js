'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.EMPTY_CONNECTION_HOLDER = undefined;

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _error = require('../error');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Utility to lazily initialize connections and return them back to the pool when unused.
 */
var ConnectionHolder = function () {

  /**
   * @constructor
   * @param {string} mode - the access mode for new connection holder.
   * @param {ConnectionProvider} connectionProvider - the connection provider to acquire connections from.
   */
  function ConnectionHolder(mode, connectionProvider) {
    (0, _classCallCheck3.default)(this, ConnectionHolder);

    this._mode = mode;
    this._connectionProvider = connectionProvider;
    this._referenceCount = 0;
    this._connectionPromise = _promise2.default.resolve(null);
  }

  /**
   * Make this holder initialize new connection if none exists already.
   * @return {undefined}
   */


  (0, _createClass3.default)(ConnectionHolder, [{
    key: 'initializeConnection',
    value: function initializeConnection() {
      if (this._referenceCount === 0) {
        this._connectionPromise = this._connectionProvider.acquireConnection(this._mode);
      }
      this._referenceCount++;
    }

    /**
     * Get the current connection promise.
     * @return {Promise<Connection>} promise resolved with the current connection.
     */

  }, {
    key: 'getConnection',
    value: function getConnection() {
      return this._connectionPromise;
    }

    /**
     * Notify this holder that single party does not require current connection any more.
     * @return {Promise<Connection>} promise resolved with the current connection.
     */

  }, {
    key: 'releaseConnection',
    value: function releaseConnection() {
      if (this._referenceCount === 0) {
        return this._connectionPromise;
      }

      this._referenceCount--;
      if (this._referenceCount === 0) {
        // release a connection without muting ACK_FAILURE, this is the last action on this connection
        return this._releaseConnection(true);
      }
      return this._connectionPromise;
    }

    /**
     * Closes this holder and releases current connection (if any) despite any existing users.
     * @return {Promise<Connection>} promise resolved when current connection is released to the pool.
     */

  }, {
    key: 'close',
    value: function close() {
      if (this._referenceCount === 0) {
        return this._connectionPromise;
      }
      this._referenceCount = 0;
      // release a connection and mute ACK_FAILURE, this might be called concurrently with other
      // operations and thus should ignore failure handling
      return this._releaseConnection(false);
    }

    /**
     * Return the current pooled connection instance to the connection pool.
     * We don't pool Session instances, to avoid users using the Session after they've called close.
     * The `Session` object is just a thin wrapper around Connection anyway, so it makes little difference.
     * @return {Promise} - promise resolved then connection is returned to the pool.
     * @private
     */

  }, {
    key: '_releaseConnection',
    value: function _releaseConnection(sync) {
      this._connectionPromise = this._connectionPromise.then(function (connection) {
        if (connection) {
          if (sync) {
            connection.reset();
          } else {
            connection.resetAsync();
          }
          connection.sync();
          connection._release();
        }
      }).catch(function (ignoredError) {});

      return this._connectionPromise;
    }
  }]);
  return ConnectionHolder;
}(); /**
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

exports.default = ConnectionHolder;

var EmptyConnectionHolder = function (_ConnectionHolder) {
  (0, _inherits3.default)(EmptyConnectionHolder, _ConnectionHolder);

  function EmptyConnectionHolder() {
    (0, _classCallCheck3.default)(this, EmptyConnectionHolder);
    return (0, _possibleConstructorReturn3.default)(this, (EmptyConnectionHolder.__proto__ || (0, _getPrototypeOf2.default)(EmptyConnectionHolder)).apply(this, arguments));
  }

  (0, _createClass3.default)(EmptyConnectionHolder, [{
    key: 'initializeConnection',
    value: function initializeConnection() {
      // nothing to initialize
    }
  }, {
    key: 'getConnection',
    value: function getConnection() {
      return _promise2.default.reject((0, _error.newError)('This connection holder does not serve connections'));
    }
  }, {
    key: 'releaseConnection',
    value: function releaseConnection() {
      return _promise2.default.resolve();
    }
  }, {
    key: 'close',
    value: function close() {
      return _promise2.default.resolve();
    }
  }]);
  return EmptyConnectionHolder;
}(ConnectionHolder);

/**
 * Connection holder that does not manage any connections.
 * @type {ConnectionHolder}
 */


var EMPTY_CONNECTION_HOLDER = exports.EMPTY_CONNECTION_HOLDER = new EmptyConnectionHolder();
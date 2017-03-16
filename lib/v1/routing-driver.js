'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _session = require('./session');

var _session2 = _interopRequireDefault(_session);

var _driver = require('./driver');

var _error = require('./error');

var _connectionProviders = require('./internal/connection-providers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * A driver that supports routing in a core-edge cluster.
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

var RoutingDriver = function (_Driver) {
  (0, _inherits3.default)(RoutingDriver, _Driver);

  function RoutingDriver(url, userAgent) {
    var token = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    var config = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
    (0, _classCallCheck3.default)(this, RoutingDriver);
    return (0, _possibleConstructorReturn3.default)(this, (RoutingDriver.__proto__ || (0, _getPrototypeOf2.default)(RoutingDriver)).call(this, url, userAgent, token, RoutingDriver._validateConfig(config)));
  }

  (0, _createClass3.default)(RoutingDriver, [{
    key: '_createConnectionProvider',
    value: function _createConnectionProvider(address, connectionPool, driverOnErrorCallback) {
      return new _connectionProviders.LoadBalancer(address, connectionPool, driverOnErrorCallback);
    }
  }, {
    key: '_createSession',
    value: function _createSession(mode, connectionProvider, bookmark, config) {
      var _this2 = this;

      return new RoutingSession(mode, connectionProvider, bookmark, config, function (error, conn) {
        if (error.code === _error.SERVICE_UNAVAILABLE || error.code === _error.SESSION_EXPIRED) {
          // connection is undefined if error happened before connection was acquired
          if (conn) {
            _this2._connectionProvider.forget(conn.url);
          }
          return error;
        } else if (error.code === 'Neo.ClientError.Cluster.NotALeader') {
          var url = 'UNKNOWN';
          // connection is undefined if error happened before connection was acquired
          if (conn) {
            url = conn.url;
            _this2._connectionProvider.forgetWriter(conn.url);
          }
          return (0, _error.newError)('No longer possible to write to server at ' + url, _error.SESSION_EXPIRED);
        } else {
          return error;
        }
      });
    }
  }], [{
    key: '_validateConfig',
    value: function _validateConfig(config) {
      if (config.trust === 'TRUST_ON_FIRST_USE') {
        throw (0, _error.newError)('The chosen trust mode is not compatible with a routing driver');
      }
      return config;
    }
  }]);
  return RoutingDriver;
}(_driver.Driver);

var RoutingSession = function (_Session) {
  (0, _inherits3.default)(RoutingSession, _Session);

  function RoutingSession(mode, connectionProvider, bookmark, config, onFailedConnection) {
    (0, _classCallCheck3.default)(this, RoutingSession);

    var _this3 = (0, _possibleConstructorReturn3.default)(this, (RoutingSession.__proto__ || (0, _getPrototypeOf2.default)(RoutingSession)).call(this, mode, connectionProvider, bookmark, config));

    _this3._onFailedConnection = onFailedConnection;
    return _this3;
  }

  (0, _createClass3.default)(RoutingSession, [{
    key: '_onRunFailure',
    value: function _onRunFailure() {
      return this._onFailedConnection;
    }
  }]);
  return RoutingSession;
}(_session2.default);

exports.default = RoutingDriver;
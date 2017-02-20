"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _promise = require("babel-runtime/core-js/promise");

var _promise2 = _interopRequireDefault(_promise);

var _getPrototypeOf = require("babel-runtime/core-js/object/get-prototype-of");

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require("babel-runtime/helpers/createClass");

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require("babel-runtime/helpers/possibleConstructorReturn");

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require("babel-runtime/helpers/inherits");

var _inherits3 = _interopRequireDefault(_inherits2);

var _session = require("./session");

var _session2 = _interopRequireDefault(_session);

var _driver = require("./driver");

var _error = require("./error");

var _roundRobinArray = require("./internal/round-robin-array");

var _roundRobinArray2 = _interopRequireDefault(_roundRobinArray);

var _routingTable = require("./internal/routing-table");

var _routingTable2 = _interopRequireDefault(_routingTable);

var _rediscovery = require("./internal/rediscovery");

var _rediscovery2 = _interopRequireDefault(_rediscovery);

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

    var _this = (0, _possibleConstructorReturn3.default)(this, (RoutingDriver.__proto__ || (0, _getPrototypeOf2.default)(RoutingDriver)).call(this, url, userAgent, token, RoutingDriver._validateConfig(config)));

    _this._routingTable = new _routingTable2.default(new _roundRobinArray2.default([url]));
    _this._rediscovery = new _rediscovery2.default();
    return _this;
  }

  (0, _createClass3.default)(RoutingDriver, [{
    key: "_createSession",
    value: function _createSession(connectionPromise, cb) {
      var _this2 = this;

      return new RoutingSession(connectionPromise, cb, function (error, conn) {
        if (error.code === _error.SERVICE_UNAVAILABLE || error.code === _error.SESSION_EXPIRED) {
          if (conn) {
            _this2._forget(conn.url);
          } else {
            connectionPromise.then(function (conn) {
              _this2._forget(conn.url);
            }).catch(function () {/*ignore*/});
          }
          return error;
        } else if (error.code === 'Neo.ClientError.Cluster.NotALeader') {
          var url = 'UNKNOWN';
          if (conn) {
            url = conn.url;
            _this2._routingTable.forgetWriter(conn.url);
          } else {
            connectionPromise.then(function (conn) {
              _this2._routingTable.forgetWriter(conn.url);
            }).catch(function () {/*ignore*/});
          }
          return (0, _error.newError)('No longer possible to write to server at ' + url, _error.SESSION_EXPIRED);
        } else {
          return error;
        }
      });
    }
  }, {
    key: "_acquireConnection",
    value: function _acquireConnection(mode) {
      var _this3 = this;

      return this._freshRoutingTable().then(function (routingTable) {
        if (mode === _driver.READ) {
          return _this3._acquireConnectionToServer(routingTable.readers, "read");
        } else if (mode === _driver.WRITE) {
          return _this3._acquireConnectionToServer(routingTable.writers, "write");
        } else {
          throw (0, _error.newError)('Illegal session mode ' + mode);
        }
      });
    }
  }, {
    key: "_acquireConnectionToServer",
    value: function _acquireConnectionToServer(serversRoundRobinArray, serverName) {
      var address = serversRoundRobinArray.next();
      if (!address) {
        return _promise2.default.reject((0, _error.newError)('No ' + serverName + ' servers available', _error.SESSION_EXPIRED));
      }
      return this._pool.acquire(address);
    }
  }, {
    key: "_freshRoutingTable",
    value: function _freshRoutingTable() {
      var currentRoutingTable = this._routingTable;

      if (!currentRoutingTable.isStale()) {
        return _promise2.default.resolve(currentRoutingTable);
      }
      return this._refreshRoutingTable(currentRoutingTable);
    }
  }, {
    key: "_refreshRoutingTable",
    value: function _refreshRoutingTable(currentRoutingTable) {
      var _this4 = this;

      var knownRouters = currentRoutingTable.routers.toArray();

      var refreshedTablePromise = knownRouters.reduce(function (refreshedTablePromise, currentRouter, currentIndex) {
        return refreshedTablePromise.then(function (newRoutingTable) {
          if (newRoutingTable) {
            if (!newRoutingTable.writers.isEmpty()) {
              // valid routing table was fetched - just return it, try next router otherwise
              return newRoutingTable;
            }
          } else {
            // returned routing table was undefined, this means a connection error happened and we need to forget the
            // previous router and try the next one
            var previousRouter = knownRouters[currentIndex - 1];
            if (previousRouter) {
              currentRoutingTable.forgetRouter(previousRouter);
            }
          }

          // try next router
          var session = _this4._createSessionForRediscovery(currentRouter);
          return _this4._rediscovery.lookupRoutingTableOnRouter(session, currentRouter);
        });
      }, _promise2.default.resolve(null));

      return refreshedTablePromise.then(function (newRoutingTable) {
        if (newRoutingTable && !newRoutingTable.writers.isEmpty()) {
          _this4._updateRoutingTable(newRoutingTable);
          return newRoutingTable;
        }
        throw (0, _error.newError)('Could not perform discovery. No routing servers available.', _error.SERVICE_UNAVAILABLE);
      });
    }
  }, {
    key: "_createSessionForRediscovery",
    value: function _createSessionForRediscovery(routerAddress) {
      var connection = this._pool.acquire(routerAddress);
      var connectionPromise = _promise2.default.resolve(connection);
      // error transformer here is a no-op unlike the one in a regular session, this is so because errors are
      // handled in the rediscovery promise chain and we do not need to do this in the error transformer
      var errorTransformer = function errorTransformer(error) {
        return error;
      };
      return new RoutingSession(connectionPromise, this._releaseConnection(connectionPromise), errorTransformer);
    }
  }, {
    key: "_forget",
    value: function _forget(url) {
      this._routingTable.forget(url);
      this._pool.purge(url);
    }
  }, {
    key: "_updateRoutingTable",
    value: function _updateRoutingTable(newRoutingTable) {
      var _this5 = this;

      var currentRoutingTable = this._routingTable;

      // close old connections to servers not present in the new routing table
      var staleServers = currentRoutingTable.serversDiff(newRoutingTable);
      staleServers.forEach(function (server) {
        return _this5._pool.purge;
      });

      // make this driver instance aware of the new table
      this._routingTable = newRoutingTable;
    }
  }], [{
    key: "_validateConfig",
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

  function RoutingSession(connectionPromise, onClose, onFailedConnection) {
    (0, _classCallCheck3.default)(this, RoutingSession);

    var _this6 = (0, _possibleConstructorReturn3.default)(this, (RoutingSession.__proto__ || (0, _getPrototypeOf2.default)(RoutingSession)).call(this, connectionPromise, onClose));

    _this6._onFailedConnection = onFailedConnection;
    return _this6;
  }

  (0, _createClass3.default)(RoutingSession, [{
    key: "_onRunFailure",
    value: function _onRunFailure() {
      return this._onFailedConnection;
    }
  }]);
  return RoutingSession;
}(_session2.default);

exports.default = RoutingDriver;
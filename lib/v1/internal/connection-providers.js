'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SingleConnectionProvider = exports.LoadBalancer = exports.DirectConnectionProvider = undefined;

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _error = require('../error');

var _driver = require('../driver');

var _session = require('../session');

var _session2 = _interopRequireDefault(_session);

var _roundRobinArray = require('./round-robin-array');

var _roundRobinArray2 = _interopRequireDefault(_roundRobinArray);

var _routingTable = require('./routing-table');

var _routingTable2 = _interopRequireDefault(_routingTable);

var _rediscovery = require('./rediscovery');

var _rediscovery2 = _interopRequireDefault(_rediscovery);

var _features = require('./features');

var _features2 = _interopRequireDefault(_features);

var _hostNameResolvers = require('./host-name-resolvers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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

var ConnectionProvider = function () {
  function ConnectionProvider() {
    (0, _classCallCheck3.default)(this, ConnectionProvider);
  }

  (0, _createClass3.default)(ConnectionProvider, [{
    key: 'acquireConnection',
    value: function acquireConnection(mode) {
      throw new Error('Abstract function');
    }
  }, {
    key: '_withAdditionalOnErrorCallback',
    value: function _withAdditionalOnErrorCallback(connectionPromise, driverOnErrorCallback) {
      // install error handler from the driver on the connection promise; this callback is installed separately
      // so that it does not handle errors, instead it is just an additional error reporting facility.
      connectionPromise.catch(function (error) {
        driverOnErrorCallback(error);
      });
      // return the original connection promise
      return connectionPromise;
    }
  }]);
  return ConnectionProvider;
}();

var DirectConnectionProvider = exports.DirectConnectionProvider = function (_ConnectionProvider) {
  (0, _inherits3.default)(DirectConnectionProvider, _ConnectionProvider);

  function DirectConnectionProvider(address, connectionPool, driverOnErrorCallback) {
    (0, _classCallCheck3.default)(this, DirectConnectionProvider);

    var _this = (0, _possibleConstructorReturn3.default)(this, (DirectConnectionProvider.__proto__ || (0, _getPrototypeOf2.default)(DirectConnectionProvider)).call(this));

    _this._address = address;
    _this._connectionPool = connectionPool;
    _this._driverOnErrorCallback = driverOnErrorCallback;
    return _this;
  }

  (0, _createClass3.default)(DirectConnectionProvider, [{
    key: 'acquireConnection',
    value: function acquireConnection(mode) {
      var connection = this._connectionPool.acquire(this._address);
      var connectionPromise = _promise2.default.resolve(connection);
      return this._withAdditionalOnErrorCallback(connectionPromise, this._driverOnErrorCallback);
    }
  }]);
  return DirectConnectionProvider;
}(ConnectionProvider);

var LoadBalancer = exports.LoadBalancer = function (_ConnectionProvider2) {
  (0, _inherits3.default)(LoadBalancer, _ConnectionProvider2);

  function LoadBalancer(address, connectionPool, driverOnErrorCallback) {
    (0, _classCallCheck3.default)(this, LoadBalancer);

    var _this2 = (0, _possibleConstructorReturn3.default)(this, (LoadBalancer.__proto__ || (0, _getPrototypeOf2.default)(LoadBalancer)).call(this));

    _this2._seedRouter = address;
    _this2._routingTable = new _routingTable2.default(new _roundRobinArray2.default([_this2._seedRouter]));
    _this2._rediscovery = new _rediscovery2.default();
    _this2._connectionPool = connectionPool;
    _this2._driverOnErrorCallback = driverOnErrorCallback;
    _this2._hostNameResolver = LoadBalancer._createHostNameResolver();
    return _this2;
  }

  (0, _createClass3.default)(LoadBalancer, [{
    key: 'acquireConnection',
    value: function acquireConnection(mode) {
      var _this3 = this;

      var connectionPromise = this._freshRoutingTable().then(function (routingTable) {
        if (mode === _driver.READ) {
          return _this3._acquireConnectionToServer(routingTable.readers, 'read');
        } else if (mode === _driver.WRITE) {
          return _this3._acquireConnectionToServer(routingTable.writers, 'write');
        } else {
          throw (0, _error.newError)('Illegal mode ' + mode);
        }
      });
      return this._withAdditionalOnErrorCallback(connectionPromise, this._driverOnErrorCallback);
    }
  }, {
    key: 'forget',
    value: function forget(address) {
      this._routingTable.forget(address);
      this._connectionPool.purge(address);
    }
  }, {
    key: 'forgetWriter',
    value: function forgetWriter(address) {
      this._routingTable.forgetWriter(address);
    }
  }, {
    key: '_acquireConnectionToServer',
    value: function _acquireConnectionToServer(serversRoundRobinArray, serverName) {
      var address = serversRoundRobinArray.next();
      if (!address) {
        return _promise2.default.reject((0, _error.newError)('No ' + serverName + ' servers available', _error.SESSION_EXPIRED));
      }
      return this._connectionPool.acquire(address);
    }
  }, {
    key: '_freshRoutingTable',
    value: function _freshRoutingTable() {
      var currentRoutingTable = this._routingTable;

      if (!currentRoutingTable.isStale()) {
        return _promise2.default.resolve(currentRoutingTable);
      }
      return this._refreshRoutingTable(currentRoutingTable);
    }
  }, {
    key: '_refreshRoutingTable',
    value: function _refreshRoutingTable(currentRoutingTable) {
      var _this4 = this;

      var knownRouters = currentRoutingTable.routers.toArray();

      return this._fetchNewRoutingTable(knownRouters, currentRoutingTable).then(function (newRoutingTable) {
        if (LoadBalancer._isValidRoutingTable(newRoutingTable)) {
          // one of the known routers returned a valid routing table - use it
          return newRoutingTable;
        }

        if (!newRoutingTable) {
          // returned routing table was undefined, this means a connection error happened and the last known
          // router did not return a valid routing table, so we need to forget it
          var lastRouterIndex = knownRouters.length - 1;
          LoadBalancer._forgetRouter(currentRoutingTable, knownRouters, lastRouterIndex);
        }

        // none of the known routers returned a valid routing table - try to use seed router address for rediscovery
        return _this4._fetchNewRoutingTableUsingSeedRouterAddress(knownRouters, _this4._seedRouter);
      }).then(function (newRoutingTable) {
        if (LoadBalancer._isValidRoutingTable(newRoutingTable)) {
          _this4._updateRoutingTable(newRoutingTable);
          return newRoutingTable;
        }

        // none of the existing routers returned valid routing table, throw exception
        throw (0, _error.newError)('Could not perform discovery. No routing servers available.', _error.SERVICE_UNAVAILABLE);
      });
    }
  }, {
    key: '_fetchNewRoutingTableUsingSeedRouterAddress',
    value: function _fetchNewRoutingTableUsingSeedRouterAddress(knownRouters, seedRouter) {
      var _this5 = this;

      return this._hostNameResolver.resolve(seedRouter).then(function (resolvedRouterAddresses) {
        // filter out all addresses that we've already tried
        var newAddresses = resolvedRouterAddresses.filter(function (address) {
          return knownRouters.indexOf(address) < 0;
        });
        return _this5._fetchNewRoutingTable(newAddresses, null);
      });
    }
  }, {
    key: '_fetchNewRoutingTable',
    value: function _fetchNewRoutingTable(routerAddresses, routingTable) {
      var _this6 = this;

      return routerAddresses.reduce(function (refreshedTablePromise, currentRouter, currentIndex) {
        return refreshedTablePromise.then(function (newRoutingTable) {
          if (newRoutingTable) {
            if (!newRoutingTable.writers.isEmpty()) {
              // valid routing table was fetched - just return it, try next router otherwise
              return newRoutingTable;
            }
          } else {
            // returned routing table was undefined, this means a connection error happened and we need to forget the
            // previous router and try the next one
            var previousRouterIndex = currentIndex - 1;
            LoadBalancer._forgetRouter(routingTable, routerAddresses, previousRouterIndex);
          }

          // try next router
          var session = _this6._createSessionForRediscovery(currentRouter);
          return _this6._rediscovery.lookupRoutingTableOnRouter(session, currentRouter);
        });
      }, _promise2.default.resolve(null));
    }
  }, {
    key: '_createSessionForRediscovery',
    value: function _createSessionForRediscovery(routerAddress) {
      var connection = this._connectionPool.acquire(routerAddress);
      var connectionPromise = _promise2.default.resolve(connection);
      var connectionProvider = new SingleConnectionProvider(connectionPromise);
      return new _session2.default(_driver.READ, connectionProvider);
    }
  }, {
    key: '_updateRoutingTable',
    value: function _updateRoutingTable(newRoutingTable) {
      var _this7 = this;

      var currentRoutingTable = this._routingTable;

      // close old connections to servers not present in the new routing table
      var staleServers = currentRoutingTable.serversDiff(newRoutingTable);
      staleServers.forEach(function (server) {
        return _this7._connectionPool.purge(server);
      });

      // make this driver instance aware of the new table
      this._routingTable = newRoutingTable;
    }
  }], [{
    key: '_isValidRoutingTable',
    value: function _isValidRoutingTable(routingTable) {
      return routingTable && !routingTable.writers.isEmpty();
    }
  }, {
    key: '_forgetRouter',
    value: function _forgetRouter(routingTable, routersArray, routerIndex) {
      var address = routersArray[routerIndex];
      if (routingTable && address) {
        routingTable.forgetRouter(address);
      }
    }
  }, {
    key: '_createHostNameResolver',
    value: function _createHostNameResolver() {
      if ((0, _features2.default)('dns_lookup')) {
        return new _hostNameResolvers.DnsHostNameResolver();
      }
      return new _hostNameResolvers.DummyHostNameResolver();
    }
  }]);
  return LoadBalancer;
}(ConnectionProvider);

var SingleConnectionProvider = exports.SingleConnectionProvider = function (_ConnectionProvider3) {
  (0, _inherits3.default)(SingleConnectionProvider, _ConnectionProvider3);

  function SingleConnectionProvider(connectionPromise) {
    (0, _classCallCheck3.default)(this, SingleConnectionProvider);

    var _this8 = (0, _possibleConstructorReturn3.default)(this, (SingleConnectionProvider.__proto__ || (0, _getPrototypeOf2.default)(SingleConnectionProvider)).call(this));

    _this8._connectionPromise = connectionPromise;
    return _this8;
  }

  (0, _createClass3.default)(SingleConnectionProvider, [{
    key: 'acquireConnection',
    value: function acquireConnection(mode) {
      var connectionPromise = this._connectionPromise;
      this._connectionPromise = null;
      return connectionPromise;
    }
  }]);
  return SingleConnectionProvider;
}(ConnectionProvider);
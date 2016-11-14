'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _session = require('./session');

var _session2 = _interopRequireDefault(_session);

var _driver = require('./driver');

var _error = require('./error');

var _roundRobinArray = require('./internal/round-robin-array');

var _roundRobinArray2 = _interopRequireDefault(_roundRobinArray);

var _integer = require('./integer');

var _integer2 = _interopRequireDefault(_integer);

require('babel-polyfill');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /**
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

/**
 * A driver that supports routing in a core-edge cluster.
 */
var RoutingDriver = function (_Driver) {
  _inherits(RoutingDriver, _Driver);

  function RoutingDriver(url) {
    var userAgent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'neo4j-javascript/0.0';
    var token = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    var config = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

    _classCallCheck(this, RoutingDriver);

    var _this = _possibleConstructorReturn(this, (RoutingDriver.__proto__ || Object.getPrototypeOf(RoutingDriver)).call(this, url, userAgent, token, config));

    _this._clusterView = new ClusterView(new _roundRobinArray2.default([url]));
    return _this;
  }

  _createClass(RoutingDriver, [{
    key: '_createSession',
    value: function _createSession(connectionPromise, cb) {
      var _this2 = this;

      return new RoutingSession(connectionPromise, cb, function (err, conn) {
        var code = err.code;
        var msg = err.message;
        if (!code) {
          try {
            code = err.fields[0].code;
          } catch (e) {
            code = 'UNKNOWN';
          }
        }
        if (!msg) {
          try {
            msg = err.fields[0].message;
          } catch (e) {
            msg = 'Unknown failure occurred';
          }
        }
        //just to simplify later error handling
        err.code = code;
        err.message = msg;

        if (code === _error.SERVICE_UNAVAILABLE || code === _error.SESSION_EXPIRED) {
          if (conn) {
            _this2._forget(conn.url);
          } else {
            connectionPromise.then(function (conn) {
              _this2._forget(conn.url);
            }).catch(function () {/*ignore*/});
          }
          return err;
        } else if (code === 'Neo.ClientError.Cluster.NotALeader') {
          var url = 'UNKNOWN';
          if (conn) {
            url = conn.url;
            _this2._clusterView.writers.remove(conn.url);
          } else {
            connectionPromise.then(function (conn) {
              _this2._clusterView.writers.remove(conn.url);
            }).catch(function () {/*ignore*/});
          }
          return (0, _error.newError)("No longer possible to write to server at " + url, _error.SESSION_EXPIRED);
        } else {
          return err;
        }
      });
    }
  }, {
    key: '_updatedClusterView',
    value: function _updatedClusterView() {
      var _this3 = this;

      if (!this._clusterView.needsUpdate()) {
        return Promise.resolve(this._clusterView);
      } else {
        var _ret = function () {
          var call = function call() {
            var conn = _this3._pool.acquire(routers.next());
            var session = _this3._createSession(Promise.resolve(conn));
            return newClusterView(session).catch(function (err) {
              _this3._forget(conn);
              return Promise.reject(err);
            });
          };
          var routers = _this3._clusterView.routers;
          //Build a promise chain that ends on the first successful call
          //i.e. call().catch(call).catch(call).catch(call)...
          //each call will try a different router
          var acc = Promise.reject();
          for (var i = 0; i < routers.size(); i++) {
            acc = acc.catch(call);
          }
          return {
            v: acc
          };
        }();

        if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
      }
    }
  }, {
    key: '_diff',
    value: function _diff(oldView, updatedView) {
      var oldSet = oldView.all();
      var newSet = updatedView.all();
      newSet.forEach(function (item) {
        oldSet.delete(item);
      });
      return oldSet;
    }
  }, {
    key: '_acquireConnection',
    value: function _acquireConnection(mode) {
      var _this4 = this;

      var m = mode || _driver.WRITE;
      //make sure we have enough servers
      return this._updatedClusterView().then(function (view) {
        var toRemove = _this4._diff(_this4._clusterView, view);
        var self = _this4;
        toRemove.forEach(function (url) {
          self._pool.purge(url);
        });
        //update our cached view
        _this4._clusterView = view;
        if (m === _driver.READ) {
          var key = view.readers.next();
          if (!key) {
            return Promise.reject((0, _error.newError)('No read servers available', _error.SESSION_EXPIRED));
          }
          return _this4._pool.acquire(key);
        } else if (m === _driver.WRITE) {
          var _key = view.writers.next();
          if (!_key) {
            return Promise.reject((0, _error.newError)('No write servers available', _error.SESSION_EXPIRED));
          }
          return _this4._pool.acquire(_key);
        } else {
          return Promise.reject(m + " is not a valid option");
        }
      }).catch(function (err) {
        return Promise.reject(err);
      });
    }
  }, {
    key: '_forget',
    value: function _forget(url) {
      this._pool.purge(url);
      this._clusterView.remove(url);
    }
  }]);

  return RoutingDriver;
}(_driver.Driver);

var ClusterView = function () {
  function ClusterView(routers, readers, writers, expires) {
    _classCallCheck(this, ClusterView);

    this.routers = routers || new _roundRobinArray2.default();
    this.readers = readers || new _roundRobinArray2.default();
    this.writers = writers || new _roundRobinArray2.default();
    this._expires = expires || (0, _integer.int)(-1);
  }

  _createClass(ClusterView, [{
    key: 'needsUpdate',
    value: function needsUpdate() {
      return this._expires.lessThan(Date.now()) || this.routers.size() <= 1 || this.readers.empty() || this.writers.empty();
    }
  }, {
    key: 'all',
    value: function all() {
      var seen = new Set(this.routers.toArray());
      var writers = this.writers.toArray();
      var readers = this.readers.toArray();
      for (var i = 0; i < writers.length; i++) {
        seen.add(writers[i]);
      }
      for (var _i = 0; _i < readers.length; _i++) {
        seen.add(readers[_i]);
      }
      return seen;
    }
  }, {
    key: 'remove',
    value: function remove(item) {
      this.routers.remove(item);
      this.readers.remove(item);
      this.writers.remove(item);
    }
  }]);

  return ClusterView;
}();

var RoutingSession = function (_Session) {
  _inherits(RoutingSession, _Session);

  function RoutingSession(connectionPromise, onClose, onFailedConnection) {
    _classCallCheck(this, RoutingSession);

    var _this5 = _possibleConstructorReturn(this, (RoutingSession.__proto__ || Object.getPrototypeOf(RoutingSession)).call(this, connectionPromise, onClose));

    _this5._onFailedConnection = onFailedConnection;
    return _this5;
  }

  _createClass(RoutingSession, [{
    key: '_onRunFailure',
    value: function _onRunFailure() {
      return this._onFailedConnection;
    }
  }]);

  return RoutingSession;
}(_session2.default);

var GET_SERVERS = "CALL dbms.cluster.routing.getServers";

/**
 * Calls `getServers` and retrieves a new promise of a ClusterView.
 * @param session
 * @returns {Promise.<ClusterView>}
 */
function newClusterView(session) {
  return session.run(GET_SERVERS).then(function (res) {
    session.close();
    if (res.records.length != 1) {
      return Promise.reject((0, _error.newError)("Invalid routing response from server", _error.SERVICE_UNAVAILABLE));
    }
    var record = res.records[0];
    var now = (0, _integer.int)(Date.now());
    var expires = record.get('ttl').multiply(1000).add(now);
    //if the server uses a really big expire time like Long.MAX_VALUE
    //this may have overflowed
    if (expires.lessThan(now)) {
      expires = _integer2.default.MAX_VALUE;
    }
    var servers = record.get('servers');
    var routers = new _roundRobinArray2.default();
    var readers = new _roundRobinArray2.default();
    var writers = new _roundRobinArray2.default();
    for (var i = 0; i < servers.length; i++) {
      var server = servers[i];

      var role = server['role'];
      var addresses = server['addresses'];
      if (role === 'ROUTE') {
        routers.pushAll(addresses);
      } else if (role === 'WRITE') {
        writers.pushAll(addresses);
      } else if (role === 'READ') {
        readers.pushAll(addresses);
      }
    }
    if (routers.empty() || writers.empty()) {
      return Promise.reject((0, _error.newError)("Invalid routing response from server", _error.SERVICE_UNAVAILABLE));
    }
    return new ClusterView(routers, readers, writers, expires);
  }).catch(function (e) {
    if (e.code === 'Neo.ClientError.Procedure.ProcedureNotFound') {
      return Promise.reject((0, _error.newError)("Server could not perform routing, make sure you are connecting to a causal cluster", _error.SERVICE_UNAVAILABLE));
    } else {
      return Promise.reject((0, _error.newError)("No servers could be found at this instant.", _error.SERVICE_UNAVAILABLE));
    }
  });
}

exports.default = RoutingDriver;
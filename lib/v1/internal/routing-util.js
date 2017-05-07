'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _defineProperty2 = require('babel-runtime/helpers/defineProperty');

var _defineProperty3 = _interopRequireDefault(_defineProperty2);

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _roundRobinArray = require('./round-robin-array');

var _roundRobinArray2 = _interopRequireDefault(_roundRobinArray);

var _error = require('../error');

var _integer = require('../integer');

var _integer2 = _interopRequireDefault(_integer);

var _serverVersion = require('./server-version');

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

var CALL_GET_SERVERS = 'CALL dbms.cluster.routing.getServers';
var GET_ROUTING_TABLE_PARAM = 'context';
var CALL_GET_ROUTING_TABLE = 'CALL dbms.cluster.routing.getRoutingTable({' + GET_ROUTING_TABLE_PARAM + '})';
var PROCEDURE_NOT_FOUND_CODE = 'Neo.ClientError.Procedure.ProcedureNotFound';
var UNAUTHORIZED_CODE = 'Neo.ClientError.Security.Unauthorized';

var RoutingUtil = function () {
  function RoutingUtil(routingContext) {
    (0, _classCallCheck3.default)(this, RoutingUtil);

    this._routingContext = routingContext;
  }

  /**
   * Invoke routing procedure using the given session.
   * @param {Session} session the session to use.
   * @param {string} routerAddress the URL of the router.
   * @return {Promise<Record[]>} promise resolved with records returned by the procedure call or null if
   * connection error happened.
   */


  (0, _createClass3.default)(RoutingUtil, [{
    key: 'callRoutingProcedure',
    value: function callRoutingProcedure(session, routerAddress) {
      return this._callAvailableRoutingProcedure(session).then(function (result) {
        session.close();
        return result.records;
      }).catch(function (error) {
        if (error.code === PROCEDURE_NOT_FOUND_CODE) {
          // throw when getServers procedure not found because this is clearly a configuration issue
          throw (0, _error.newError)('Server ' + routerAddress + ' could not perform routing. ' + 'Make sure you are connecting to a causal cluster', _error.SERVICE_UNAVAILABLE);
        } else if (error.code === UNAUTHORIZED_CODE) {
          // auth error is a sign of a configuration issue, rediscovery should not proceed
          throw error;
        } else {
          // return nothing when failed to connect because code higher in the callstack is still able to retry with a
          // different session towards a different router
          return null;
        }
      });
    }
  }, {
    key: 'parseTtl',
    value: function parseTtl(record, routerAddress) {
      try {
        var now = (0, _integer.int)(Date.now());
        var expires = record.get('ttl').multiply(1000).add(now);
        // if the server uses a really big expire time like Long.MAX_VALUE this may have overflowed
        if (expires.lessThan(now)) {
          return _integer2.default.MAX_VALUE;
        }
        return expires;
      } catch (error) {
        throw (0, _error.newError)('Unable to parse TTL entry from router ' + routerAddress + ' from record:\n' + (0, _stringify2.default)(record), _error.PROTOCOL_ERROR);
      }
    }
  }, {
    key: 'parseServers',
    value: function parseServers(record, routerAddress) {
      try {
        var servers = record.get('servers');

        var routers = new _roundRobinArray2.default();
        var readers = new _roundRobinArray2.default();
        var writers = new _roundRobinArray2.default();

        servers.forEach(function (server) {
          var role = server['role'];
          var addresses = server['addresses'];

          if (role === 'ROUTE') {
            routers.pushAll(addresses);
          } else if (role === 'WRITE') {
            writers.pushAll(addresses);
          } else if (role === 'READ') {
            readers.pushAll(addresses);
          } else {
            throw (0, _error.newError)('Unknown server role "' + role + '"', _error.PROTOCOL_ERROR);
          }
        });

        return {
          routers: routers,
          readers: readers,
          writers: writers
        };
      } catch (ignore) {
        throw (0, _error.newError)('Unable to parse servers entry from router ' + routerAddress + ' from record:\n' + (0, _stringify2.default)(record), _error.PROTOCOL_ERROR);
      }
    }
  }, {
    key: '_callAvailableRoutingProcedure',
    value: function _callAvailableRoutingProcedure(session) {
      var _this = this;

      return session._run(null, null, function (connection, streamObserver) {
        var serverVersionString = connection.server.version;
        var serverVersion = _serverVersion.ServerVersion.fromString(serverVersionString);

        if (serverVersion.compareTo(_serverVersion.VERSION_3_2_0) >= 0) {
          var params = (0, _defineProperty3.default)({}, GET_ROUTING_TABLE_PARAM, _this._routingContext);
          connection.run(CALL_GET_ROUTING_TABLE, params, streamObserver);
        } else {
          connection.run(CALL_GET_SERVERS, {}, streamObserver);
        }
      });
    }
  }]);
  return RoutingUtil;
}();

exports.default = RoutingUtil;
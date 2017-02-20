"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _stringify = require("babel-runtime/core-js/json/stringify");

var _stringify2 = _interopRequireDefault(_stringify);

var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require("babel-runtime/helpers/createClass");

var _createClass3 = _interopRequireDefault(_createClass2);

var _getServersUtil = require("./get-servers-util");

var _getServersUtil2 = _interopRequireDefault(_getServersUtil);

var _routingTable = require("./routing-table");

var _routingTable2 = _interopRequireDefault(_routingTable);

var _error = require("../error");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Rediscovery = function () {
  function Rediscovery(getServersUtil) {
    (0, _classCallCheck3.default)(this, Rediscovery);

    this._getServersUtil = getServersUtil || new _getServersUtil2.default();
  }

  (0, _createClass3.default)(Rediscovery, [{
    key: "lookupRoutingTableOnRouter",
    value: function lookupRoutingTableOnRouter(session, routerAddress) {
      var _this = this;

      return this._getServersUtil.callGetServers(session, routerAddress).then(function (records) {
        if (records === null) {
          // connection error happened, unable to retrieve routing table from this router, next one should be queried
          return null;
        }

        if (records.length !== 1) {
          throw (0, _error.newError)('Illegal response from router "' + routerAddress + '". ' + 'Received ' + records.length + ' records but expected only one.\n' + (0, _stringify2.default)(records), _error.PROTOCOL_ERROR);
        }

        var record = records[0];

        var expirationTime = _this._getServersUtil.parseTtl(record, routerAddress);

        var _getServersUtil$parse = _this._getServersUtil.parseServers(record, routerAddress),
            routers = _getServersUtil$parse.routers,
            readers = _getServersUtil$parse.readers,
            writers = _getServersUtil$parse.writers;

        Rediscovery._assertNonEmpty(routers, 'routers', routerAddress);
        Rediscovery._assertNonEmpty(readers, 'readers', routerAddress);
        // case with no writers is processed higher in the promise chain because only RoutingDriver knows
        // how to deal with such table and how to treat router that returned such table

        return new _routingTable2.default(routers, readers, writers, expirationTime);
      });
    }
  }], [{
    key: "_assertNonEmpty",
    value: function _assertNonEmpty(serversRoundRobinArray, serversName, routerAddress) {
      if (serversRoundRobinArray.isEmpty()) {
        throw (0, _error.newError)('Received no ' + serversName + ' from router ' + routerAddress, _error.PROTOCOL_ERROR);
      }
    }
  }]);
  return Rediscovery;
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

exports.default = Rediscovery;
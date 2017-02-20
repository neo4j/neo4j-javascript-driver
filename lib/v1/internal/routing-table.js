"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _toConsumableArray2 = require("babel-runtime/helpers/toConsumableArray");

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _from = require("babel-runtime/core-js/array/from");

var _from2 = _interopRequireDefault(_from);

var _set = require("babel-runtime/core-js/set");

var _set2 = _interopRequireDefault(_set);

var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require("babel-runtime/helpers/createClass");

var _createClass3 = _interopRequireDefault(_createClass2);

var _integer = require("../integer");

var _roundRobinArray = require("./round-robin-array");

var _roundRobinArray2 = _interopRequireDefault(_roundRobinArray);

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
var MIN_ROUTERS = 1;

var RoutingTable = function () {
  function RoutingTable(routers, readers, writers, expirationTime) {
    (0, _classCallCheck3.default)(this, RoutingTable);

    this.routers = routers || new _roundRobinArray2.default();
    this.readers = readers || new _roundRobinArray2.default();
    this.writers = writers || new _roundRobinArray2.default();
    this.expirationTime = expirationTime || (0, _integer.int)(0);
  }

  (0, _createClass3.default)(RoutingTable, [{
    key: "forget",
    value: function forget(address) {
      // Don't remove it from the set of routers, since that might mean we lose our ability to re-discover,
      // just remove it from the set of readers and writers, so that we don't use it for actual work without
      // performing discovery first.
      this.readers.remove(address);
      this.writers.remove(address);
    }
  }, {
    key: "forgetRouter",
    value: function forgetRouter(address) {
      this.routers.remove(address);
    }
  }, {
    key: "forgetWriter",
    value: function forgetWriter(address) {
      this.writers.remove(address);
    }
  }, {
    key: "serversDiff",
    value: function serversDiff(otherRoutingTable) {
      var oldServers = new _set2.default(this._allServers());
      var newServers = otherRoutingTable._allServers();
      newServers.forEach(function (newServer) {
        return oldServers.delete(newServer);
      });
      return (0, _from2.default)(oldServers);
    }
  }, {
    key: "isStale",
    value: function isStale() {
      return this.expirationTime.lessThan(Date.now()) || this.routers.size() <= MIN_ROUTERS || this.readers.isEmpty() || this.writers.isEmpty();
    }
  }, {
    key: "_allServers",
    value: function _allServers() {
      return [].concat((0, _toConsumableArray3.default)(this.routers.toArray()), (0, _toConsumableArray3.default)(this.readers.toArray()), (0, _toConsumableArray3.default)(this.writers.toArray()));
    }
  }]);
  return RoutingTable;
}();

exports.default = RoutingTable;
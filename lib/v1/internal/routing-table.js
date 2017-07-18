'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _from = require('babel-runtime/core-js/array/from');

var _from2 = _interopRequireDefault(_from);

var _set = require('babel-runtime/core-js/set');

var _set2 = _interopRequireDefault(_set);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _integer = require('../integer');

var _driver = require('../driver');

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

    this.routers = routers || [];
    this.readers = readers || [];
    this.writers = writers || [];
    this.expirationTime = expirationTime || (0, _integer.int)(0);
  }

  (0, _createClass3.default)(RoutingTable, [{
    key: 'forget',
    value: function forget(address) {
      // Don't remove it from the set of routers, since that might mean we lose our ability to re-discover,
      // just remove it from the set of readers and writers, so that we don't use it for actual work without
      // performing discovery first.

      this.readers = removeFromArray(this.readers, address);
      this.writers = removeFromArray(this.writers, address);
    }
  }, {
    key: 'forgetRouter',
    value: function forgetRouter(address) {
      this.routers = removeFromArray(this.routers, address);
    }
  }, {
    key: 'forgetWriter',
    value: function forgetWriter(address) {
      this.writers = removeFromArray(this.writers, address);
    }
  }, {
    key: 'serversDiff',
    value: function serversDiff(otherRoutingTable) {
      var oldServers = new _set2.default(this._allServers());
      var newServers = otherRoutingTable._allServers();
      newServers.forEach(function (newServer) {
        return oldServers.delete(newServer);
      });
      return (0, _from2.default)(oldServers);
    }

    /**
     * Check if this routing table is fresh to perform the required operation.
     * @param {string} accessMode the type of operation. Allowed values are {@link READ} and {@link WRITE}.
     * @return {boolean} <code>true</code> when this table contains servers to serve the required operation,
     * <code>false</code> otherwise.
     */

  }, {
    key: 'isStaleFor',
    value: function isStaleFor(accessMode) {
      return this.expirationTime.lessThan(Date.now()) || this.routers.length < MIN_ROUTERS || accessMode === _driver.READ && this.readers.length === 0 || accessMode === _driver.WRITE && this.writers.length === 0;
    }
  }, {
    key: '_allServers',
    value: function _allServers() {
      return [].concat((0, _toConsumableArray3.default)(this.routers), (0, _toConsumableArray3.default)(this.readers), (0, _toConsumableArray3.default)(this.writers));
    }
  }, {
    key: 'toString',
    value: function toString() {
      return 'RoutingTable[' + ('expirationTime=' + this.expirationTime + ', ') + ('routers=[' + this.routers + '], ') + ('readers=[' + this.readers + '], ') + ('writers=[' + this.writers + ']]');
    }
  }]);
  return RoutingTable;
}();

/**
 * Remove all occurrences of the element in the array.
 * @param {Array} array the array to filter.
 * @param {object} element the element to remove.
 * @return {Array} new filtered array.
 */


exports.default = RoutingTable;
function removeFromArray(array, element) {
  return array.filter(function (item) {
    return item !== element;
  });
}
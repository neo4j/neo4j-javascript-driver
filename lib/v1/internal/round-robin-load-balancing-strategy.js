'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ROUND_ROBIN_STRATEGY_NAME = undefined;

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

var _roundRobinArrayIndex = require('./round-robin-array-index');

var _roundRobinArrayIndex2 = _interopRequireDefault(_roundRobinArrayIndex);

var _loadBalancingStrategy = require('./load-balancing-strategy');

var _loadBalancingStrategy2 = _interopRequireDefault(_loadBalancingStrategy);

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

var ROUND_ROBIN_STRATEGY_NAME = exports.ROUND_ROBIN_STRATEGY_NAME = 'round_robin';

var RoundRobinLoadBalancingStrategy = function (_LoadBalancingStrateg) {
  (0, _inherits3.default)(RoundRobinLoadBalancingStrategy, _LoadBalancingStrateg);

  function RoundRobinLoadBalancingStrategy() {
    (0, _classCallCheck3.default)(this, RoundRobinLoadBalancingStrategy);

    var _this = (0, _possibleConstructorReturn3.default)(this, (RoundRobinLoadBalancingStrategy.__proto__ || (0, _getPrototypeOf2.default)(RoundRobinLoadBalancingStrategy)).call(this));

    _this._readersIndex = new _roundRobinArrayIndex2.default();
    _this._writersIndex = new _roundRobinArrayIndex2.default();
    return _this;
  }

  /**
   * @inheritDoc
   */


  (0, _createClass3.default)(RoundRobinLoadBalancingStrategy, [{
    key: 'selectReader',
    value: function selectReader(knownReaders) {
      return this._select(knownReaders, this._readersIndex);
    }

    /**
     * @inheritDoc
     */

  }, {
    key: 'selectWriter',
    value: function selectWriter(knownWriters) {
      return this._select(knownWriters, this._writersIndex);
    }
  }, {
    key: '_select',
    value: function _select(addresses, roundRobinIndex) {
      var length = addresses.length;
      if (length === 0) {
        return null;
      }
      var index = roundRobinIndex.next(length);
      return addresses[index];
    }
  }]);
  return RoundRobinLoadBalancingStrategy;
}(_loadBalancingStrategy2.default);

exports.default = RoundRobinLoadBalancingStrategy;
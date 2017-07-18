'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

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

/**
 * A facility to select most appropriate reader or writer among the given addresses for request processing.
 */
var LoadBalancingStrategy = function () {
  function LoadBalancingStrategy() {
    (0, _classCallCheck3.default)(this, LoadBalancingStrategy);
  }

  (0, _createClass3.default)(LoadBalancingStrategy, [{
    key: 'selectReader',


    /**
     * Select next most appropriate reader from the list of given readers.
     * @param {string[]} knownReaders an array of currently known readers to select from.
     * @return {string} most appropriate reader or <code>null</code> if given array is empty.
     */
    value: function selectReader(knownReaders) {
      throw new Error('Abstract function');
    }

    /**
     * Select next most appropriate writer from the list of given writers.
     * @param {string[]} knownWriters an array of currently known writers to select from.
     * @return {string} most appropriate writer or <code>null</code> if given array is empty.
     */

  }, {
    key: 'selectWriter',
    value: function selectWriter(knownWriters) {
      throw new Error('Abstract function');
    }
  }]);
  return LoadBalancingStrategy;
}();

exports.default = LoadBalancingStrategy;
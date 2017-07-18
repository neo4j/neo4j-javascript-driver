"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _maxSafeInteger = require("babel-runtime/core-js/number/max-safe-integer");

var _maxSafeInteger2 = _interopRequireDefault(_maxSafeInteger);

var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require("babel-runtime/helpers/createClass");

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

var RoundRobinArrayIndex = function () {

  /**
   * @constructor
   * @param {number} [initialOffset=0] the initial offset for round robin.
   */
  function RoundRobinArrayIndex(initialOffset) {
    (0, _classCallCheck3.default)(this, RoundRobinArrayIndex);

    this._offset = initialOffset || 0;
  }

  /**
   * Get next index for an array with given length.
   * @param {number} arrayLength the array length.
   * @return {number} index in the array.
   */


  (0, _createClass3.default)(RoundRobinArrayIndex, [{
    key: "next",
    value: function next(arrayLength) {
      if (arrayLength === 0) {
        return -1;
      }

      var nextOffset = this._offset;
      this._offset += 1;
      if (this._offset === _maxSafeInteger2.default) {
        this._offset = 0;
      }

      return nextOffset % arrayLength;
    }
  }]);
  return RoundRobinArrayIndex;
}();

exports.default = RoundRobinArrayIndex;
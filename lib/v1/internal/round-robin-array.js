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
 * An array that lets you hop through the elements endlessly.
 */
var RoundRobinArray = function () {
  function RoundRobinArray(items) {
    (0, _classCallCheck3.default)(this, RoundRobinArray);

    this._items = items || [];
    this._offset = 0;
  }

  (0, _createClass3.default)(RoundRobinArray, [{
    key: 'next',
    value: function next() {
      if (this.isEmpty()) {
        return null;
      }
      var index = this._offset % this.size();
      this._offset++;
      return this._items[index];
    }
  }, {
    key: 'pushAll',
    value: function pushAll(elems) {
      if (!Array.isArray(elems)) {
        throw new TypeError('Array expected but got: ' + elems);
      }

      Array.prototype.push.apply(this._items, elems);
    }
  }, {
    key: 'isEmpty',
    value: function isEmpty() {
      return this._items.length === 0;
    }
  }, {
    key: 'size',
    value: function size() {
      return this._items.length;
    }
  }, {
    key: 'toArray',
    value: function toArray() {
      return this._items;
    }
  }, {
    key: 'remove',
    value: function remove(item) {
      this._items = this._items.filter(function (element) {
        return element !== item;
      });
    }
  }]);
  return RoundRobinArray;
}();

exports.default = RoundRobinArray;
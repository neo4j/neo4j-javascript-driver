'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _defineProperty2 = require('babel-runtime/helpers/defineProperty');

var _defineProperty3 = _interopRequireDefault(_defineProperty2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _util = require('./util');

var util = _interopRequireWildcard(_util);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var BOOKMARK_KEY = 'bookmark'; /**
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

var BOOKMARKS_KEY = 'bookmarks';
var BOOKMARK_PREFIX = 'neo4j:bookmark:v1:tx';

var UNKNOWN_BOOKMARK_VALUE = -1;

var Bookmark = function () {

  /**
   * @constructor
   * @param {string|string[]} values single bookmark as string or multiple bookmarks as a string array.
   */
  function Bookmark(values) {
    (0, _classCallCheck3.default)(this, Bookmark);

    this._values = asStringArray(values);
    this._maxValue = maxBookmark(this._values);
  }

  /**
   * Check if the given bookmark is meaningful and can be send to the database.
   * @return {boolean} returns <code>true</code> bookmark has a value, <code>false</code> otherwise.
   */


  (0, _createClass3.default)(Bookmark, [{
    key: 'isEmpty',
    value: function isEmpty() {
      return this._maxValue === null;
    }

    /**
     * Get maximum value of this bookmark as string.
     * @return {string|null} the maximum value or <code>null</code> if it is not defined.
     */

  }, {
    key: 'maxBookmarkAsString',
    value: function maxBookmarkAsString() {
      return this._maxValue;
    }

    /**
     * Get this bookmark as an object for begin transaction call.
     * @return {object} the value of this bookmark as object.
     */

  }, {
    key: 'asBeginTransactionParameters',
    value: function asBeginTransactionParameters() {
      var _ref;

      if (this.isEmpty()) {
        return {};
      }

      // Driver sends {bookmark: "max", bookmarks: ["one", "two", "max"]} instead of simple
      // {bookmarks: ["one", "two", "max"]} for backwards compatibility reasons. Old servers can only accept single
      // bookmark that is why driver has to parse and compare given list of bookmarks. This functionality will
      // eventually be removed.
      return _ref = {}, (0, _defineProperty3.default)(_ref, BOOKMARK_KEY, this._maxValue), (0, _defineProperty3.default)(_ref, BOOKMARKS_KEY, this._values), _ref;
    }
  }]);
  return Bookmark;
}();

/**
 * Converts given value to an array.
 * @param {string|string[]} [value=undefined] argument to convert.
 * @return {string[]} value converted to an array.
 */


exports.default = Bookmark;
function asStringArray(value) {
  if (!value) {
    return [];
  }

  if (util.isString(value)) {
    return [value];
  }

  if (Array.isArray(value)) {
    var result = [];
    for (var i = 0; i < value.length; i++) {
      var element = value[i];
      if (!util.isString(element)) {
        throw new TypeError('Bookmark should be a string, given: \'' + element + '\'');
      }
      result.push(element);
    }
    return result;
  }

  throw new TypeError('Bookmark should either be a string or a string array, given: \'' + value + '\'');
}

/**
 * Find latest bookmark in the given array of bookmarks.
 * @param {string[]} bookmarks array of bookmarks.
 * @return {string|null} latest bookmark value.
 */
function maxBookmark(bookmarks) {
  if (!bookmarks || bookmarks.length === 0) {
    return null;
  }

  var maxBookmark = bookmarks[0];
  var maxValue = bookmarkValue(maxBookmark);

  for (var i = 1; i < bookmarks.length; i++) {
    var bookmark = bookmarks[i];
    var value = bookmarkValue(bookmark);

    if (value > maxValue) {
      maxBookmark = bookmark;
      maxValue = value;
    }
  }

  return maxBookmark;
}

/**
 * Calculate numeric value for the given bookmark.
 * @param {string} bookmark argument to get numeric value for.
 * @return {number} value of the bookmark.
 */
function bookmarkValue(bookmark) {
  if (bookmark && bookmark.indexOf(BOOKMARK_PREFIX) === 0) {
    var result = parseInt(bookmark.substring(BOOKMARK_PREFIX.length));
    return result ? result : UNKNOWN_BOOKMARK_VALUE;
  }
  return UNKNOWN_BOOKMARK_VALUE;
}
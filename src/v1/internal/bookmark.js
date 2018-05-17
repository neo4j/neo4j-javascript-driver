/**
 * Copyright (c) 2002-2018 "Neo4j,"
 * Neo4j Sweden AB [http://neo4j.com]
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

import * as util from './util';

const BOOKMARK_KEY = 'bookmark';
const BOOKMARKS_KEY = 'bookmarks';
const BOOKMARK_PREFIX = 'neo4j:bookmark:v1:tx';

const UNKNOWN_BOOKMARK_VALUE = -1;

export default class Bookmark {

  /**
   * @constructor
   * @param {string|string[]} values single bookmark as string or multiple bookmarks as a string array.
   */
  constructor(values) {
    this._values = asStringArray(values);
    this._maxValue = maxBookmark(this._values);
  }

  /**
   * Check if the given bookmark is meaningful and can be send to the database.
   * @return {boolean} returns <code>true</code> bookmark has a value, <code>false</code> otherwise.
   */
  isEmpty() {
    return this._maxValue === null;
  }

  /**
   * Get maximum value of this bookmark as string.
   * @return {string|null} the maximum value or <code>null</code> if it is not defined.
   */
  maxBookmarkAsString() {
    return this._maxValue;
  }

  /**
   * Get this bookmark as an object for begin transaction call.
   * @return {object} the value of this bookmark as object.
   */
  asBeginTransactionParameters() {
    if (this.isEmpty()) {
      return {};
    }

    // Driver sends {bookmark: "max", bookmarks: ["one", "two", "max"]} instead of simple
    // {bookmarks: ["one", "two", "max"]} for backwards compatibility reasons. Old servers can only accept single
    // bookmark that is why driver has to parse and compare given list of bookmarks. This functionality will
    // eventually be removed.
    return {
      [BOOKMARK_KEY]: this._maxValue,
      [BOOKMARKS_KEY]: this._values
    };
  }
}

/**
 * Converts given value to an array.
 * @param {string|string[]} [value=undefined] argument to convert.
 * @return {string[]} value converted to an array.
 */
function asStringArray(value) {
  if (!value) {
    return [];
  }

  if (util.isString(value)) {
    return [value];
  }

  if (Array.isArray(value)) {
    const result = [];
    for (let i = 0; i < value.length; i++) {
      const element = value[i];
      // if it is undefined or null, ignore it
      if (element !== undefined && element !== null) {
        if (!util.isString(element)) {
          throw new TypeError(`Bookmark should be a string, given: '${element}'`);
        }
        result.push(element);
      }
    }
    return result;
  }

  throw new TypeError(`Bookmark should either be a string or a string array, given: '${value}'`);
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

  let maxBookmark = bookmarks[0];
  let maxValue = bookmarkValue(maxBookmark);

  for (let i = 1; i < bookmarks.length; i++) {
    const bookmark = bookmarks[i];
    const value = bookmarkValue(bookmark);

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
    const result = parseInt(bookmark.substring(BOOKMARK_PREFIX.length));
    return result ? result : UNKNOWN_BOOKMARK_VALUE;
  }
  return UNKNOWN_BOOKMARK_VALUE;
}

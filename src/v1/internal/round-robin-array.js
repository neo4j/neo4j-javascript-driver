/**
 * Copyright (c) 2002-2016 "Neo Technology,"
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
class RoundRobinArray {
  constructor(items) {
    this._items = items || [];
    this._index = 0;
  }

  next() {
    let elem = this._items[this._index];
    if (this._items.length === 0) {
      this._index = 0;
    } else {
      this._index = (this._index + 1) % (this._items.length);
    }
    return elem;
  }

  push(elem) {
    this._items.push(elem);
  }

  pushAll(elems) {
    Array.prototype.push.apply(this._items, elems);
  }

  empty() {
    return this._items.length === 0;
  }

  clear() {
    this._items = [];
    this._index = 0;
  }

  size() {
    return this._items.length;
  }

  toArray() {
    return this._items;
  }

  remove(item) {
    let index = this._items.indexOf(item);
    while (index != -1) {
      this._items.splice(index, 1);
      if (index < this._index) {
        this._index -= 1;
      }
      //make sure we are in range
      if (this._items.length === 0) {
        this._index = 0;
      } else {
        this._index %= this._items.length;
      }
      index = this._items.indexOf(item, index);
    }
  }
}

export default RoundRobinArray
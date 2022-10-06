/**
 * Copyright (c) "Neo4j"
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

export default class RoundRobinArrayIndex {
  /**
   * @constructor
   * @param {number} [initialOffset=0] the initial offset for round robin.
   */
  constructor (initialOffset) {
    this._offset = initialOffset || 0
  }

  /**
   * Get next index for an array with given length.
   * @param {number} arrayLength the array length.
   * @return {number} index in the array.
   */
  next (arrayLength) {
    if (arrayLength === 0) {
      return -1
    }

    const nextOffset = this._offset
    this._offset += 1
    if (this._offset === Number.MAX_SAFE_INTEGER) {
      this._offset = 0
    }

    return nextOffset % arrayLength
  }
}

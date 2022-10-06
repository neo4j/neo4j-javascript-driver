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

import { BaseBuffer } from '../buf/index.js'
import { alloc } from './channel-buf.js'

/**
 * Buffer that combines multiple buffers, exposing them as one single buffer.
 */
export default class CombinedBuffer extends BaseBuffer {
  constructor (buffers) {
    let length = 0
    for (let i = 0; i < buffers.length; i++) {
      length += buffers[i].length
    }
    super(length)
    this._buffers = buffers
  }

  getUInt8 (position) {
    // Surely there's a faster way to do this.. some sort of lookup table thing?
    for (let i = 0; i < this._buffers.length; i++) {
      const buffer = this._buffers[i]
      // If the position is not in the current buffer, skip the current buffer
      if (position >= buffer.length) {
        position -= buffer.length
      } else {
        return buffer.getUInt8(position)
      }
    }
  }

  getInt8 (position) {
    // Surely there's a faster way to do this.. some sort of lookup table thing?
    for (let i = 0; i < this._buffers.length; i++) {
      const buffer = this._buffers[i]
      // If the position is not in the current buffer, skip the current buffer
      if (position >= buffer.length) {
        position -= buffer.length
      } else {
        return buffer.getInt8(position)
      }
    }
  }

  getFloat64 (position) {
    // At some point, a more efficient impl. For now, we copy the 8 bytes
    // we want to read and depend on the platform impl of IEEE 754.
    const b = alloc(8)
    for (let i = 0; i < 8; i++) {
      b.putUInt8(i, this.getUInt8(position + i))
    }
    return b.getFloat64(0)
  }
}

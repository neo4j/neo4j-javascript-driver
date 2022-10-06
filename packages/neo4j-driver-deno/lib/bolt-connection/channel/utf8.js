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

import ChannelBuffer from './channel-buf.js'
import { newError } from '../../core/index.ts'
import buffer from 'https://deno.land/std@0.119.0/node/buffer.ts'
import { StringDecoder } from 'https://deno.land/std@0.119.0/node/string_decoder.ts'

const decoder = new StringDecoder('utf8')

function encode (str) {
  return new ChannelBuffer(newBuffer(str))
}

function decode (buffer, length) {
  if (Object.prototype.hasOwnProperty.call(buffer, '_buffer')) {
    return decodeChannelBuffer(buffer, length)
  } else if (Object.prototype.hasOwnProperty.call(buffer, '_buffers')) {
    return decodeCombinedBuffer(buffer, length)
  } else {
    throw newError(`Don't know how to decode strings from '${buffer}'`)
  }
}

function decodeChannelBuffer (buffer, length) {
  const start = buffer.position
  const end = start + length
  buffer.position = Math.min(end, buffer.length)
  return buffer._buffer.toString('utf8', start, end)
}

function decodeCombinedBuffer (buffer, length) {
  return streamDecodeCombinedBuffer(
    buffer,
    length,
    partBuffer => decoder.write(partBuffer._buffer),
    () => decoder.end()
  )
}

function streamDecodeCombinedBuffer (combinedBuffers, length, decodeFn, endFn) {
  let remainingBytesToRead = length
  let position = combinedBuffers.position
  combinedBuffers._updatePos(
    Math.min(length, combinedBuffers.length - position)
  )
  // Reduce CombinedBuffers to a decoded string
  const out = combinedBuffers._buffers.reduce(function (last, partBuffer) {
    if (remainingBytesToRead <= 0) {
      return last
    } else if (position >= partBuffer.length) {
      position -= partBuffer.length
      return ''
    } else {
      partBuffer._updatePos(position - partBuffer.position)
      const bytesToRead = Math.min(
        partBuffer.length - position,
        remainingBytesToRead
      )
      const lastSlice = partBuffer.readSlice(bytesToRead)
      partBuffer._updatePos(bytesToRead)
      remainingBytesToRead = Math.max(
        remainingBytesToRead - lastSlice.length,
        0
      )
      position = 0
      return last + decodeFn(lastSlice)
    }
  }, '')
  return out + endFn()
}

function newBuffer (str) {
  // use static factory function present in newer NodeJS versions to create a buffer containing the given string
  // or fallback to the old, potentially deprecated constructor

  if (typeof buffer.Buffer.from === 'function') {
    return buffer.Buffer.from(str, 'utf8')
  } else {
    // eslint-disable-next-line node/no-deprecated-api
    return new buffer.Buffer(str, 'utf8')
  }
}

export default {
  encode,
  decode
}

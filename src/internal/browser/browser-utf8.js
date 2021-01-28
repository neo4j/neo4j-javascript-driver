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

import HeapBuffer from '../browser/browser-buf'
import { TextEncoder, TextDecoder } from 'text-encoding-utf-8'

const encoder = new TextEncoder('utf-8')
const decoder = new TextDecoder('utf-8')

function encode (str) {
  return new HeapBuffer(encoder.encode(str).buffer)
}

function decode (buffer, length) {
  if (buffer instanceof HeapBuffer) {
    return decoder.decode(
      buffer.readView(Math.min(length, buffer.length - buffer.position))
    )
  } else {
    // Copy the given buffer into a regular buffer and decode that
    const tmpBuf = new HeapBuffer(length)
    for (let i = 0; i < length; i++) {
      tmpBuf.writeUInt8(buffer.readUInt8())
    }
    tmpBuf.reset()
    return decoder.decode(tmpBuf.readView(length))
  }
}

export default {
  encode,
  decode
}

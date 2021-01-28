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

import { Chunker, Dechunker } from '../../src/internal/chunking'
import { alloc } from '../../src/internal/node'
import DummyChannel from './dummy-channel'

describe('#unit Chunker', () => {
  it('should chunk simple data', () => {
    // Given
    const ch = new DummyChannel()
    const chunker = new Chunker(ch)

    // When
    chunker.writeInt32(1)
    chunker.writeInt32(2)
    chunker.flush()

    // Then
    expect(ch.toHex()).toBe('00 08 00 00 00 01 00 00 00 02')
  })

  it('should chunk blobs larger than the output buffer', () => {
    // Given
    const ch = new DummyChannel()
    const chunker = new Chunker(ch, 4)

    // When
    chunker.writeBytes(bytes(1, 2, 3, 4, 5, 6))
    chunker.flush()

    // Then
    expect(ch.toHex()).toBe('00 02 01 02 00 02 03 04 00 02 05 06')
  })

  it('should include message boundaries', () => {
    // Given
    const ch = new DummyChannel()
    const chunker = new Chunker(ch)

    // When
    chunker.writeInt32(1)
    chunker.messageBoundary()
    chunker.writeInt32(2)
    chunker.flush()

    // Then
    expect(ch.toHex()).toBe('00 04 00 00 00 01 00 00 00 04 00 00 00 02')
  })
})

describe('#unit Dechunker', () => {
  it('should unchunk a simple message', () => {
    // Given
    const messages = []
    const dechunker = new Dechunker()
    const chunker = new Chunker(dechunker)
    dechunker.onmessage = buffer => {
      messages.push(buffer)
    }

    // When
    chunker.writeInt16(1)
    chunker.writeInt16(2)
    chunker.flush()
    chunker.writeInt16(3)
    chunker.messageBoundary()
    chunker.flush()

    // Then
    expect(messages.length).toBe(1)
    expect(messages[0].toHex()).toBe('00 01 00 02 00 03')
  })

  it('should handle message split at any point', () => {
    // Given
    const ch = new DummyChannel()
    const chunker = new Chunker(ch)

    // And given the following message
    chunker.writeInt8(1)
    chunker.writeInt16(2)
    chunker.writeInt32(3)
    chunker.writeUInt8(4)
    chunker.writeUInt32(5)
    chunker.messageBoundary()
    chunker.flush()

    const chunked = ch.toBuffer()

    // When I try splitting this chunked data at every possible position
    // into two separate buffers, and send those to the dechunker
    for (let i = 1; i < chunked.length; i++) {
      const slice1 = chunked.getSlice(0, i)
      const slice2 = chunked.getSlice(i, chunked.length - i)

      // Dechunk the slices
      const messages = []
      const dechunker = new Dechunker()
      dechunker.onmessage = buffer => {
        messages.push(buffer)
      }
      dechunker.write(slice1)
      dechunker.write(slice2)

      // Then, the output should be correct
      expect(messages.length).toBe(1)
      expect(messages[0].toHex()).toBe('01 00 02 00 00 00 03 04 00 00 00 05')
    }
  })

  it('should ignore empty chunks sent as keep alive', () => {
    const messages = []
    const dechunker = new Dechunker()
    dechunker.onmessage = buffer => {
      messages.push(buffer)
    }

    dechunker.write(bytes(0, 0)) // Empty
    dechunker.write(bytes(0, 1, 10, 0, 0)) // Small message
    dechunker.write(bytes(0, 0)) // Empty
    dechunker.write(bytes(0, 1, 11, 0, 0)) // Small message
    dechunker.write(bytes(0, 0)) // Empty

    expect(messages.length).toBe(2)
    expect(messages[0].length).toBe(1)
    expect(messages[0].readInt8()).toBe(10)
    expect(messages[1].length).toBe(1)
    expect(messages[1].readInt8()).toBe(11)
  })
})

function bytes () {
  const b = alloc(arguments.length)
  for (let i = 0; i < arguments.length; i++) {
    b.writeUInt8(arguments[i])
  }
  b.position = 0
  return b
}

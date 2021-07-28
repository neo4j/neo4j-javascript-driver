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

import CombinedBuffer from '../../../bolt-connection/lib/channel/combined-buf'
import { alloc, utf8 } from '../../../bolt-connection/lib/channel'

describe('#unit UTF8Encoding', () => {
  it('should have a nice clean buffer position after serializing', () => {
    // When
    const buffer = utf8.encode('hello, world!')

    // Then
    expect(buffer.position).toBe(0)
  })

  it('should respect position of single buffer', () => {
    // When
    const buffer = utf8.encode('hello, world!')
    buffer.readInt8()
    const decoded = utf8.decode(buffer, buffer.length - 1)
    // Then
    expect(decoded).toBe('ello, world!')
    expect(buffer.position).toEqual(13)
  })

  it('should be able to decode substring', () => {
    // When
    const buffer = utf8.encode('hello, world!')
    buffer.readInt8()
    const decoded = utf8.decode(buffer, 3)
    // Then
    expect(decoded).toBe('ell')
    expect(buffer.position).toEqual(4)
  })

  it('should read/write utf8', () => {
    expect(packAndUnpack('')).toBe('')
    expect(packAndUnpack('åäö123')).toBe('åäö123')
  })

  it('should decode utf8 from a complete combined buffer', () => {
    // Given
    const msg = 'asåfqwer'
    const buf = utf8.encode(msg)
    const bufa = buf.readSlice(3)
    const bufb = buf.readSlice(3)
    const bufc = buf.readSlice(3)
    const combined = new CombinedBuffer([bufa, bufb, bufc])

    // When
    const decoded = utf8.decode(combined, combined.length)

    // Then
    expect(decoded).toBe(msg)
  })

  it('should decode utf8 from part of a combined buffer', () => {
    // Given
    const msg = 'asåfq'
    const expectMsg = msg.substring(0, msg.length - 1)
    const buf = utf8.encode(msg)
    const bufa = buf.readSlice(3)
    const bufb = buf.readSlice(3)
    const unrelatedData = alloc(3)
    const combined = new CombinedBuffer([bufa, bufb, unrelatedData])

    // When
    // We read all but the unrelatedData and the last character of bufb
    const decoded = utf8.decode(
      combined,
      combined.length - 1 - unrelatedData.length
    )

    // Then
    expect(decoded).toBe(expectMsg)
  })

  it('should respect the position in the combined buffer', () => {
    // Given
    const msg = 'abcdefgh'
    const buf = utf8.encode(msg)
    const bufa = buf.readSlice(4)
    const bufb = buf.readSlice(4)
    const combined = new CombinedBuffer([bufa, bufb])
    // move position forward
    combined.readInt8()
    combined.readInt8()

    // When
    const decoded = utf8.decode(combined, combined.length - 2)

    // Then
    expect(decoded).toEqual('cdefgh')
    expect(combined.position).toBe(8)
  })

  it('should be able to decode a substring in a combined buffer across buffers', () => {
    // Given
    const msg = 'abcdefghijkl'
    const buf = utf8.encode(msg)
    const bufa = buf.readSlice(4)
    const bufb = buf.readSlice(4)
    const bufc = buf.readSlice(4)
    const combined = new CombinedBuffer([bufa, bufb, bufc])
    // move position forward
    combined.readInt8()
    combined.readInt8()
    combined.readInt8()
    combined.readInt8()
    combined.readInt8()

    // When
    const decoded = utf8.decode(combined, 4)

    // Then
    expect(decoded).toBe('fghi')
    expect(combined.position).toBe(9)
  })

  it('should be able to decode a substring in a combined within buffer', () => {
    // Given
    const msg = 'abcdefghijkl'
    const buf = utf8.encode(msg)
    const bufa = buf.readSlice(4)
    const bufb = buf.readSlice(4)
    const bufc = buf.readSlice(4)
    const combined = new CombinedBuffer([bufa, bufb, bufc])
    // move position forward
    combined.readInt8()
    combined.readInt8()
    combined.readInt8()
    combined.readInt8()
    combined.readInt8()

    // When
    const decoded = utf8.decode(combined, 2)

    // Then
    expect(decoded).toBe('fg')
    expect(combined.position).toBe(7)
  })
})

function packAndUnpack (str) {
  const buffer = utf8.encode(str)
  return utf8.decode(buffer, buffer.length)
}

/**
 * Copyright (c) 2002-2020 "Neo4j,"
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

import ProtocolHandshaker from '../../src/internal/protocol-handshaker'
import Logger from '../../src/internal/logger'
import BoltProtocol from '../../src/internal/bolt-protocol-v1'
import BoltProtocolV4x3 from '../../src/internal/bolt-protocol-v4x3'

import { alloc } from '../../src/internal/node'

describe('#unit ProtocolHandshaker', () => {
  it('should write handshake request', () => {
    const writtenBuffers = []
    const fakeChannel = {
      write: buffer => writtenBuffers.push(buffer)
    }

    const handshaker = new ProtocolHandshaker(
      null,
      fakeChannel,
      null,
      false,
      Logger.noOp()
    )

    handshaker.writeHandshakeRequest()

    expect(writtenBuffers.length).toEqual(1)

    const boltMagicPreamble = '60 60 b0 17'
    const protocolVersion4x3 = '00 01 03 04'
    const protocolVersion4x1 = '00 00 01 04'
    const protocolVersion4x0 = '00 00 00 04'
    const protocolVersion3 = '00 00 00 03'

    expect(writtenBuffers[0].toHex()).toEqual(
      `${boltMagicPreamble} ${protocolVersion4x3} ${protocolVersion4x1} ${protocolVersion4x0} ${protocolVersion3}`
    )
  })

  it('should create protocol with valid version', () => {
    const handshaker = new ProtocolHandshaker(
      null,
      null,
      null,
      false,
      Logger.noOp()
    )

    // buffer with Bolt V1
    const buffer = handshakeResponse(1)

    const protocol = handshaker.createNegotiatedProtocol(buffer)

    expect(protocol).toBeDefined()
    expect(protocol).not.toBeNull()
    expect(protocol instanceof BoltProtocol).toBeTruthy()
  })

  it('should create protocol 4.3', () => {
    const handshaker = new ProtocolHandshaker(
      null,
      null,
      null,
      false,
      Logger.noOp()
    )

    // buffer with Bolt V4.3
    const buffer = handshakeResponse(4, 3)

    const protocol = handshaker.createNegotiatedProtocol(buffer)

    expect(protocol).toBeDefined()
    expect(protocol).not.toBeNull()
    expect(protocol.version).toEqual(4.3)
    expect(protocol instanceof BoltProtocolV4x3).toBeTruthy()
  })

  it('should fail to create protocol from invalid version', () => {
    const handshaker = new ProtocolHandshaker(
      null,
      null,
      null,
      false,
      Logger.noOp()
    )

    // buffer with Bolt V42 which is invalid
    const buffer = handshakeResponse(42)

    expect(() => handshaker.createNegotiatedProtocol(buffer)).toThrow()
  })

  it('should fail to create protocol from HTTP as invalid version', () => {
    const handshaker = new ProtocolHandshaker(
      null,
      null,
      null,
      false,
      Logger.noOp()
    )

    // buffer with HTTP magic int
    const buffer = handshakeResponse(1213486160)

    expect(() => handshaker.createNegotiatedProtocol(buffer)).toThrow()
  })
})

/**
 * @param {number} version
 * @return {BaseBuffer}
 */
function handshakeResponse (version, minor = 0) {
  const buffer = alloc(4)
  buffer.writeInt32((minor << 8) | version)
  buffer.reset()
  return buffer
}

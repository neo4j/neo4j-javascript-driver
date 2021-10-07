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

import { alloc } from '../channel'
import { newError } from 'neo4j-driver-core'

const BOLT_MAGIC_PREAMBLE = 0x6060b017

function version (major, minor) {
  return {
    major,
    minor
  }
}

function createHandshakeMessage (versions) {
  if (versions.length > 4) {
    throw newError('It should not have more than 4 versions of the protocol')
  }
  const handshakeBuffer = alloc(5 * 4)

  handshakeBuffer.writeInt32(BOLT_MAGIC_PREAMBLE)

  versions.forEach(version => {
    if (version instanceof Array) {
      const { major, minor } = version[0]
      const { minor: minMinor } = version[1]
      const range = minor - minMinor
      handshakeBuffer.writeInt32((range << 16) | (minor << 8) | major)
    } else {
      const { major, minor } = version
      handshakeBuffer.writeInt32((minor << 8) | major)
    }
  })

  handshakeBuffer.reset()

  return handshakeBuffer
}

function parseNegotiatedResponse (buffer) {
  const h = [
    buffer.readUInt8(),
    buffer.readUInt8(),
    buffer.readUInt8(),
    buffer.readUInt8()
  ]
  if (h[0] === 0x48 && h[1] === 0x54 && h[2] === 0x54 && h[3] === 0x50) {
    throw newError(
      'Server responded HTTP. Make sure you are not trying to connect to the http endpoint ' +
        '(HTTP defaults to port 7474 whereas BOLT defaults to port 7687)'
    )
  }
  return Number(h[3] + '.' + h[2])
}

/**
 * @return {BaseBuffer}
 * @private
 */
function newHandshakeBuffer () {
  return createHandshakeMessage([
    [version(4, 4), version(4, 2)],
    version(4, 1),
    version(4, 0),
    version(3, 0)
  ])
}

/**
 * This callback is displayed as a global member.
 * @callback BufferConsumerCallback
 * @param {buffer} buffer the remaining buffer
 */
/**
 * @typedef HandshakeResult
 * @property {number} protocolVersion The protocol version negotiated in the handshake
 * @property {function(BufferConsumerCallback)} consumeRemainingBuffer A function to consume the remaining buffer if it exists
 */
/**
 * Shake hands using the channel and return the protocol version
 *
 * @param {Channel} channel the channel use to shake hands
 * @returns {Promise<HandshakeResult>} Promise of protocol version and consumeRemainingBuffer
 */
export default function handshake (channel) {
  return new Promise((resolve, reject) => {
    const handshakeErrorHandler = error => {
      reject(error)
    }

    channel.onerror = handshakeErrorHandler.bind(this)
    if (channel._error) {
      handshakeErrorHandler(channel._error)
    }

    channel.onmessage = buffer => {
      try {
        // read the response buffer and initialize the protocol
        const protocolVersion = parseNegotiatedResponse(buffer)

        resolve({
          protocolVersion,
          consumeRemainingBuffer: consumer => {
            if (buffer.hasRemaining()) {
              consumer(buffer.readSlice(buffer.remaining()))
            }
          }
        })
      } catch (e) {
        reject(e)
      }
    }

    channel.write(newHandshakeBuffer())
  })
}

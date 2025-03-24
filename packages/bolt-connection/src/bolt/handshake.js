/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [https://neo4j.com]
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
const AVAILABLE_BOLT_PROTOCOLS = ['5.8', '5.7', '5.6', '5.4', '5.3', '5.2', '5.1', '5.0', '4.4', '4.3', '4.2', '3.0'] // bolt protocols the client will accept, ordered by preference
const DESIRED_CAPABILITES = 0

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

function parseNegotiatedResponse (buffer, log) {
  const h = [
    buffer.readUInt8(),
    buffer.readUInt8(),
    buffer.readUInt8(),
    buffer.readUInt8()
  ]
  if (h[0] === 0x48 && h[1] === 0x54 && h[2] === 0x54 && h[3] === 0x50) {
    log.error('Handshake failed since server responded with HTTP.')

    throw newError(
      'Server responded HTTP. Make sure you are not trying to connect to the http endpoint ' +
        '(HTTP defaults to port 7474 whereas BOLT defaults to port 7687)'
    )
  }
  return Number(h[3] + '.' + h[2])
}

function handshakeNegotiationV2 (channel, buffer, log) {
  const numVersions = buffer.readVarInt()
  let versions = []
  for (let i = 0; i < numVersions; i++) {
    const versionRange = [
      buffer.readUInt8(),
      buffer.readUInt8(),
      buffer.readUInt8(),
      buffer.readUInt8()
    ]
    versions = versions.concat(getVersions(versionRange))
  }
  const capabilityBitMask = buffer.readVarInt()
  const capabilites = selectCapabilites(capabilityBitMask)

  let major = 0
  let minor = 0
  versions.sort((a, b) => {
    if (Number(a.major) !== Number(b.major)) {
      return Number(b.major) - Number(a.major)
    } else {
      return Number(b.minor) - Number(a.minor)
    }
  })
  for (let i = 0; i < versions.length; i++) {
    const version = versions[i]
    if (AVAILABLE_BOLT_PROTOCOLS.includes(version.major + '.' + version.minor)) {
      major = version.major
      minor = version.minor
      break
    }
  }

  return new Promise((resolve, reject) => {
    try {
      const selectionBuffer = alloc(5)
      selectionBuffer.writeInt32((minor << 8) | major)
      selectionBuffer.writeVarInt(capabilites)
      channel.write(selectionBuffer)
      resolve({
        protocolVersion: Number(major + '.' + minor),
        capabilites,
        consumeRemainingBuffer: consumer => {
          if (buffer.hasRemaining()) {
            consumer(buffer.readSlice(buffer.remaining()))
          }
        }
      })
    } catch (e) {
      reject(e)
    }
  })
}

/**
 * @return {BaseBuffer}
 * @private
 */
function newHandshakeBuffer () {
  return createHandshakeMessage([
    version(255, 1),
    [version(5, 8), version(5, 0)],
    [version(4, 4), version(4, 2)],
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
 * @property {number} capabilites A bitmask representing the capabilities negotiated in the handshake
 * @property {function(BufferConsumerCallback)} consumeRemainingBuffer A function to consume the remaining buffer if it exists
 */

/**
 * Shake hands using the channel and return the protocol version
 *
 * @param {Channel} channel the channel use to shake hands
 * @param {Logger} log the log object
 * @returns {Promise<HandshakeResult>} Promise of protocol version and consumeRemainingBuffer
 */
export default function handshake (channel, log) {
  return initialHandshake(channel, log).then((result) => {
    if (result.protocolVersion === 255.1) {
      return handshakeNegotiationV2(channel, result.buffer, log)
    } else {
      return result
    }
  })
}

/**
 * Shake hands using the channel and return the protocol version, or the improved handshake protocol if communicating with a newer server.
 *
 * @param {Channel} channel the channel use to shake hands
 * @param {Logger} log the log object
 * @returns {Promise<HandshakeResult>} Promise of protocol version and consumeRemainingBuffer
 */
function initialHandshake (channel, log) {
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
        const protocolVersion = parseNegotiatedResponse(buffer, log)
        resolve({
          protocolVersion,
          capabilites: 0,
          buffer,
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

function getVersions (versionArray) {
  const resultArr = []
  const major = versionArray[3]
  const minor = versionArray[2]
  for (let i = 0; i <= versionArray[1]; i++) {
    resultArr.push({ major, minor: minor - i })
  }
  return resultArr
}

function selectCapabilites (capabilityBitMask) {
  return DESIRED_CAPABILITES // capabilites are currently unused and will always be 0.
}

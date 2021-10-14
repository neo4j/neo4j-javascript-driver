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
import Bolt from '../../src/bolt'
import DummyChannel from '../dummy-channel'
import { alloc } from '../../src/channel'
import { newError, internal } from 'neo4j-driver-core'
import { Chunker, Dechunker } from '../../src/channel/chunking'

import BoltProtocolV1 from '../../src/bolt/bolt-protocol-v1'
import BoltProtocolV2 from '../../src/bolt/bolt-protocol-v2'
import BoltProtocolV3 from '../../src/bolt/bolt-protocol-v3'
import BoltProtocolV4x0 from '../../src/bolt/bolt-protocol-v4x0'
import BoltProtocolV4x1 from '../../src/bolt/bolt-protocol-v4x1'
import BoltProtocolV4x2 from '../../src/bolt/bolt-protocol-v4x2'
import BoltProtocolV4x3 from '../../src/bolt/bolt-protocol-v4x3'
import BoltProtocolV4x4 from '../../src/bolt/bolt-protocol-v4x4'

const {
  logger: { Logger }
} = internal

describe('#unit Bolt', () => {
  describe('handshake', () => {
    it('should write the correct handshake message', () => {
      const { channel } = subject()
      expect(channel.written.length).toBe(1)
      const writtenBuffer = channel.written[0]

      const boltMagicPreamble = '60 60 b0 17'
      const protocolVersion4x4to4x2 = '00 02 04 04'
      const protocolVersion4x1 = '00 00 01 04'
      const protocolVersion4x0 = '00 00 00 04'
      const protocolVersion3 = '00 00 00 03'

      expect(writtenBuffer.toHex()).toEqual(
        `${boltMagicPreamble} ${protocolVersion4x4to4x2} ${protocolVersion4x1} ${protocolVersion4x0} ${protocolVersion3}`
      )
    })

    it('should handle a successful handshake without reaining buffer', done => {
      const { channel, handshakePromise } = subject()
      const expectedProtocolVersion = 4.3

      handshakePromise
        .then(({ protocolVersion, consumeRemainingBuffer }) => {
          expect(protocolVersion).toEqual(expectedProtocolVersion)
          consumeRemainingBuffer(() =>
            done.fail('Should not have remaining buffer')
          )
          done()
        })
        .catch(e => done.fail(e))

      channel.onmessage(packedHandshakeMessage(expectedProtocolVersion))
    })

    it('should handle a successful handshake with reaining buffer', done => {
      const { channel, handshakePromise } = subject()
      const expectedProtocolVersion = 4.3
      const expectedExtraBuffer = createExtraBuffer()
      handshakePromise
        .then(({ protocolVersion, consumeRemainingBuffer }) => {
          expect(protocolVersion).toEqual(expectedProtocolVersion)
          let consumeRemainingBufferCalled = false
          consumeRemainingBuffer(buffer => {
            consumeRemainingBufferCalled = true
            expect(buffer.toHex()).toEqual(expectedExtraBuffer.toHex())
          })
          expect(consumeRemainingBufferCalled).toBeTruthy()
          done()
        })
        .catch(e => done.fail(e))

      channel.onmessage(
        packedHandshakeMessage(expectedProtocolVersion, expectedExtraBuffer)
      )
    })

    it('should fail if the server responds with the http header', done => {
      const { channel, handshakePromise } = subject()
      const httpMagicNumber = 1213486160

      handshakePromise
        .then(() => done.fail('should not resolve an failure'))
        .catch(error => {
          expect(error).toEqual(
            newError(
              'Server responded HTTP. Make sure you are not trying to connect to the http endpoint ' +
                '(HTTP defaults to port 7474 whereas BOLT defaults to port 7687)'
            )
          )
          done()
        })

      channel.onmessage(packedHandshakeMessage(httpMagicNumber))
    })
    it('should handle a failed handshake', done => {
      const { channel, handshakePromise } = subject()
      const expectedError = new Error('Something got wrong')

      handshakePromise
        .then(() => done.fail('should not resolve an failure'))
        .catch(error => {
          expect(error).toBe(expectedError)
          done()
        })

      channel.onerror(expectedError)
    })

    it('should handle an already broken channel', done => {
      const channel = new DummyChannel()
      const expectedError = new Error('Something got wrong')
      channel._error = expectedError
      const { handshakePromise } = subject({ channel })

      handshakePromise
        .then(() => done.fail('should resolve an failure'))
        .catch(error => {
          expect(error).toBe(expectedError)
          done()
        })
    })

    function subject ({ channel = new DummyChannel() } = {}) {
      return {
        channel,
        handshakePromise: Bolt.handshake(channel)
      }
    }

    function packedHandshakeMessage (protocolVersion, extraBuffer) {
      const major = Math.floor(protocolVersion)
      const minor = protocolVersion * 10 - major * 10
      const bufferLength = 4 + (extraBuffer ? extraBuffer.length : 0)
      const result = alloc(bufferLength)
      result.putInt32(0, (minor << 8) | major)
      if (extraBuffer) {
        result.putBytes(4, extraBuffer)
      }
      result.reset()
      return result
    }

    function createExtraBuffer () {
      const buffer = alloc(16)
      buffer.putInt32(0, 1970)
      buffer.putInt32(4, 1984)
      buffer.putInt32(8, 2010)
      buffer.putInt32(12, 2012)
      buffer.reset()
      return buffer
    }
  })

  describe('create', () => {
    forEachAvailableProtcol(({ version, protocolClass }) => {
      it(`it should create protocol ${version}`, () => {
        const params = createBoltCreateParams({ version })

        const protocol = Bolt.create(params)

        expect(protocol.version).toEqual(version)
        expect(protocol).toEqual(expect.any(protocolClass))
        expect(protocol._server).toBe(params.server)
        expect(protocol._packer).toEqual(protocol._createPacker(params.chunker))
        expect(protocol._unpacker).toEqual(
          protocol._createUnpacker(
            params.disableLosslessIntegers,
            params.useBigInt
          )
        )
        expect(protocol._log).toEqual(params.log)
        const expectedError = 'Some error'
        protocol._onProtocolError(expectedError)
        expect(params.observer.protocolErrors).toEqual([expectedError])
      })

      it(`it should create protocol ${version} with useBigInt=true`, () => {
        const params = createBoltCreateParams({ version, useBigInt: true })

        const protocol = Bolt.create(params)

        expect(protocol.version).toEqual(version)
        expect(protocol).toEqual(expect.any(protocolClass))
        expect(protocol._server).toBe(params.server)
        expect(protocol._packer).toEqual(protocol._createPacker(params.chunker))
        expect(protocol._unpacker).toEqual(
          protocol._createUnpacker(
            params.disableLosslessIntegers,
            params.useBigInt
          )
        )
        expect(protocol._log).toEqual(params.log)
        const expectedError = 'Some error'
        protocol._onProtocolError(expectedError)
        expect(params.observer.protocolErrors).toEqual([expectedError])
      })

      it(`it should configure configure the correct ResponseHandler for version ${version}`, () => {
        const expectedFailure = 'expected failure'
        const expectedError = 'expected error'
        const expectedErrorAppliedTransformation =
          'expected error applied transformation'
        const params = createBoltCreateParams({ version })

        const protocol = Bolt.create(params)

        expect(protocol._responseHandler).toBeDefined()
        const responseHandler = protocol._responseHandler
        expect(responseHandler._log).toBe(params.log)

        const observer = responseHandler._observer
        observer.onError(expectedError)
        observer.onFailure(expectedFailure)
        observer.onErrorApplyTransformation(expectedErrorAppliedTransformation)

        expect(params.observer.failures).toEqual([expectedFailure])
        expect(params.observer.errors).toEqual([expectedError])
        expect(params.observer.errorsAppliedTransformation).toEqual([
          expectedErrorAppliedTransformation
        ])
      })

      it(`it should configure the channel.onerror to call the observer for version ${version}`, () => {
        const expectedError = 'expected error'
        const params = createBoltCreateParams({ version })

        const protocol = Bolt.create(params)

        expect(protocol).toBeDefined()

        params.channel.onerror(expectedError)

        expect(params.observer.errors).toEqual([expectedError])
      })

      it(`it should configure the channel.onmessage to dechunk and call the response handler ${version}`, () => {
        const params = createBoltCreateParams({ version })
        let receivedMessage = null
        const expectedMessage = {
          signature: 0x10,
          fields: [123]
        }
        const protocol = Bolt.create(params)
        protocol._responseHandler.handleResponse = msg => {
          receivedMessage = msg
        }

        protocol.packer().packStruct(
          expectedMessage.signature,
          expectedMessage.fields.map(field => protocol.packer().packable(field))
        )
        params.chunker.messageBoundary()
        params.chunker.flush()
        params.channel.onmessage(params.channel.toBuffer())

        expect(receivedMessage).not.toBeNull()
        expect(receivedMessage.signature).toEqual(expectedMessage.signature)
        expect(receivedMessage.fields).toEqual(expectedMessage.fields)
      })
    })

    forEachUnknownProtocolVersion(version => {
      it(`it should not create unknown protocol ${version}`, () => {
        try {
          Bolt.create(createBoltCreateParams({ version }))
          fail(`should not create protocol version ${version} with success`)
        } catch (error) {
          expect(error).toEqual(
            newError('Unknown Bolt protocol version: ' + version)
          )
        }
      })
    })

    function forEachAvailableProtcol (lambda) {
      function v (version, protocolClass) {
        return { version, protocolClass }
      }

      const availableProtocols = [
        v(1, BoltProtocolV1),
        v(2, BoltProtocolV2),
        v(3, BoltProtocolV3),
        v(4.0, BoltProtocolV4x0),
        v(4.1, BoltProtocolV4x1),
        v(4.2, BoltProtocolV4x2),
        v(4.3, BoltProtocolV4x3),
        v(4.4, BoltProtocolV4x4)
      ]

      availableProtocols.forEach(lambda)
    }

    function forEachUnknownProtocolVersion (lambda) {
      ;[0, -1, 'javascript', undefined, null, 1.1].forEach(lambda)
    }

    function createBoltCreateParams ({ version } = {}) {
      const server = {}
      const channel = new DummyChannel()
      const chunker = new Chunker(channel)
      const dechunker = new Dechunker()
      const disableLosslessIntegers = false
      const serversideRouting = false
      const log = Logger.noOp()
      const observer = createObserver()
      return {
        version,
        server,
        channel,
        chunker,
        dechunker,
        disableLosslessIntegers,
        serversideRouting,
        log,
        observer
      }
    }

    function createObserver () {
      const protocolErrors = []
      const errorsAppliedTransformation = []
      const failures = []
      const errors = []
      return {
        protocolErrors,
        failures,
        errors,
        errorsAppliedTransformation,
        onError: error => errors.push(error),
        onFailure: failure => failures.push(failure),
        onErrorApplyTransformation: error => {
          errorsAppliedTransformation.push(error)
          return error
        },
        onProtocolError: protocolError => protocolErrors.push(protocolError)
      }
    }
  })
})

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

import { internal, error } from 'neo4j-driver-core'
import { CompletedObserver, TelemetryObserver } from '../../../src/bolt'
import utils from '../../test-utils'
import RequestMessage from '../../../src/bolt/request-message'

const {
  constants: {
    TELEMETRY_APIS
  }
} = internal

const { PROTOCOL_ERROR } = error

/**
 * Test setup for protocol versions which doesn't supports telemetry
 *
 * @param {function()} createProtocol
 * @returns {void}
 */
export function protocolNotSupportsTelemetry (createProtocol) {
  describe('.telemetry()', () => {
    describe.each(telemetryApiFixture())('when called with { api= %s } and onCompleted defined', (api) => {
      let onCompleted
      let result

      beforeEach(() => {
        onCompleted = jest.fn()
        const protocol = createProtocol()

        result = protocol.telemetry({ api }, { onCompleted })
      })

      it('should return a completed observer', () => {
        expect(result).toBeInstanceOf(CompletedObserver)
      })

      it('should call onCompleted', () => {
        expect(onCompleted).toHaveBeenCalledTimes(1)
      })
    })
  })
}

/**
 *
 * @param {function()} createProtocol
 * @returns {void}
 */
export function protocolSupportsTelemetry (createProtocol) {
  describe('.telemetry()', () => {
    let protocol
    let recorder

    beforeEach(() => {
      recorder = new utils.MessageRecordingConnection()
      protocol = createProtocol(recorder)
      utils.spyProtocolWrite(protocol)
    })

    describe.each(telemetryApiFixture())('when called with { api = %s }', (api) => {
      describe.each([
        ['not defined', undefined],
        ['empty', {}],
        ['has onCompleted', { onCompleted: jest.fn() }],
        ['has onError', { onError: jest.fn() }],
        ['has onError and onCompleted', { onError: jest.fn(), onCompleted: jest.fn() }]
      ])('and config %s', (_, config) => {
        let result

        beforeEach(() => {
          result = protocol.telemetry({ api }, config)
        })

        it('should write the message and correct observer and not flush it', () => {
          protocol.verifyMessageCount(1)

          expect(protocol.messages[0]).toBeMessage(
            RequestMessage.telemetry({ api })
          )

          expect(protocol.observers.length).toBe(1)

          const telemetryObserver = protocol.observers[0]
          expect(telemetryObserver).toBeInstanceOf(TelemetryObserver)
          expect(telemetryObserver).toBe(result)
          expect(protocol.flushes).toEqual([false])
        })

        it('should notify onCompleted when completed is defined', () => {
          const meta = { meta: 'data ' }
          result.onCompleted(meta)

          if (config != null && config.onCompleted) {
            expect(config.onCompleted).toHaveBeenCalledWith(meta)
          }
        })

        it('should notify onError when error is defined', () => {
          const error = new Error('something right is not wrong')
          result.onError(error)

          if (config != null && config.onError) {
            expect(config.onError).toHaveBeenCalledTimes(1)
            expect(config.onError.mock.calls[0][0].code).toBe(PROTOCOL_ERROR)

            if (isErrorCauseSupported()) {
              expect(config.onError.mock.calls[0][0].cause).toBe(error)
            }
          }
        })
      })
    })
  })
}

export function isErrorCauseSupported () {
  const error = new Error('message', { cause: new Error('other error') })
  return error.cause != null
}

export function telemetryApiFixture () {
  return [
    ...Object.values(TELEMETRY_APIS)
  ]
}

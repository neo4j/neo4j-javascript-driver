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

import { newError } from 'neo4j-driver-core'
import LivenessCheckProvider from '../../src/connection-provider/liveness-check-provider'

describe('LivenessCheckProvider', () => {
  describe('.check', () => {
    describe.each([
      [undefined, null],
      [null, null],
      [-1, undefined],
      [undefined, undefined],
      [null, undefined],
      [-1, { scheme: 'none' }],
      [undefined, { scheme: 'none' }],
      [null, { scheme: 'none' }],
      [0, undefined],
      [0, null],
      [123, undefined],
      [3123, null]
    ])('when connectionLivenessCheckTimeout=%s and connection.authToken=%s', (connectionLivenessCheckTimeout, authToken) => {
      it('should return resolves with true', async () => {
        const { provider, connection } = scenario()

        await expect(provider.check(connection)).resolves.toBe(true)
      })

      it('should not reset connection', async () => {
        const { provider, connection } = scenario()

        await provider.check(connection)

        expect(connection.resetAndFlush).not.toHaveBeenCalled()
      })

      function scenario () {
        const provider = new LivenessCheckProvider({
          connectionLivenessCheckTimeout
        })

        const connection = mockConnection({ authToken })

        return { provider, connection }
      }
    })

    describe.each([
      [0, { scheme: 'none' }, 0],
      [0, { scheme: 'none' }, 1234],
      [0, { scheme: 'none' }, 3234]
    ])('when connectionLivenessCheckTimeout=%s, authToken=%s and connectionIdleFor=%s', (connectionLivenessCheckTimeout, authToken, connectionIdleFor) => {
      describe('and resetAndFlush succeed', () => {
        it('should return resolves with true', async () => {
          const { provider, connection } = scenario()

          await expect(provider.check(connection)).resolves.toBe(true)
        })

        it('should reset connection once', async () => {
          const { provider, connection } = scenario()

          await provider.check(connection)

          expect(connection.resetAndFlush).toHaveBeenCalledTimes(1)
        })

        function scenario () {
          const provider = new LivenessCheckProvider({
            connectionLivenessCheckTimeout
          })

          const connection = mockConnection({
            authToken,
            connectionIdleFor
          })

          return { provider, connection }
        }
      })

      describe('and resetAndFlush fail', () => {
        const error = newError('Something wrong is not right')

        it('should reject with expected error', async () => {
          const { provider, connection } = scenario()

          await expect(provider.check(connection)).rejects.toBe(error)
        })

        it('should reset connection once', async () => {
          const { provider, connection } = scenario()

          await provider.check(connection).catch(() => {})

          expect(connection.resetAndFlush).toHaveBeenCalledTimes(1)
        })

        function scenario () {
          const provider = new LivenessCheckProvider({
            connectionLivenessCheckTimeout
          })

          const connection = mockConnection({
            authToken,
            connectionIdleFor,
            resetAndFlushPromise: Promise.reject(error)
          })

          return { provider, connection }
        }
      })
    })
  })

  function mockConnection ({ resetAndFlushPromise, authToken } = {}) {
    return {
      resetAndFlush: jest.fn(() => resetAndFlushPromise || Promise.resolve()),
      authToken
    }
  }
})

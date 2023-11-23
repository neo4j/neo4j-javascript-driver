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
    describe.each(noNetworkNeededFixture())('when connectionLivenessCheckTimeout=%s, connection.authToken=%s and idleFor=%s', (connectionLivenessCheckTimeout, authToken, idleFor) => {
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

    describe.each(networkNeededFixture())('when connectionLivenessCheckTimeout=%s, connection.authToken=%s and idleFor=%s', (connectionLivenessCheckTimeout, authToken, idleFor) => {
      describe('and resetAndFlush succeed', () => {
        it('should return resolves with true', async () => {
          const { provider, connection } = scenario()

          await expect(provider.check(connection)).resolves.toBe(true)
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
            idleFor
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
            idleFor,
            resetAndFlushPromise: Promise.reject(error)
          })

          return { provider, connection }
        }
      })
    })
  })

  function noNetworkNeededFixture () {
    //  [connectionLivenessCheckTimeout, authToken, idleFor]
    return [
      [undefined, null, 1245],
      [null, null, 30000],
      [-1, undefined, 30000],
      [undefined, undefined, 30000],
      [null, undefined, 30000],
      [-1, { scheme: 'none' }, 30000],
      [undefined, { scheme: 'none' }, 30000],
      [null, { scheme: 'none' }, 30000],
      [0, undefined, 30000],
      [0, null, 30000],
      [123, undefined, 30000],
      [3123, null, 30000],
      [30000, { scheme: 'none' }, 30000],
      [29999, { scheme: 'none' }, 30000],
      [1, { scheme: 'none' }, 30000]
    ]
  }

  function networkNeededFixture () {
    //  [connectionLivenessCheckTimeout, authToken, idleFor]
    return [
      [0, { scheme: 'none' }, 0],
      [0, { scheme: 'none' }, 1234],
      [0, { scheme: 'none' }, 3234],
      [1000, { scheme: 'none' }, 3234],
      [3233, { scheme: 'none' }, 3234]
    ]
  }

  function mockConnection ({ resetAndFlushPromise, authToken, idleFor } = {}) {
    return {
      resetAndFlush: jest.fn(() => resetAndFlushPromise || Promise.resolve()),
      authToken,
      idleTimestamp: idleFor ? Date.now() - idleFor : undefined
    }
  }
})

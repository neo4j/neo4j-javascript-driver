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

import DirectConnectionProvider from '../../src/connection-provider/connection-provider-direct'
import { Pool } from '../../src/pool'
import { Connection, DelegateConnection } from '../../src/connection'
import { internal, newError, ServerInfo } from 'neo4j-driver-core'

const {
  serverAddress: { ServerAddress },
  logger: { Logger }
} = internal

describe('#unit DirectConnectionProvider', () => {
  it('acquires connection from the pool', done => {
    const address = ServerAddress.fromUrl('localhost:123')
    const pool = newPool()
    const connectionProvider = newDirectConnectionProvider(address, pool)

    connectionProvider
      .acquireConnection({ accessMode: 'READ', database: '' })
      .then(connection => {
        expect(connection).toBeDefined()
        expect(connection.address).toEqual(address)
        expect(pool.has(address)).toBeTruthy()

        done()
      })
  })

  it('acquires connection and returns a DelegateConnection', async () => {
    const address = ServerAddress.fromUrl('localhost:123')
    const pool = newPool()
    const connectionProvider = newDirectConnectionProvider(address, pool)

    const conn = await connectionProvider.acquireConnection({
      accessMode: 'READ',
      database: ''
    })
    expect(conn instanceof DelegateConnection).toBeTruthy()
  })

  it('should purge connections for address when AuthorizationExpired happens', async () => {
    const address = ServerAddress.fromUrl('localhost:123')
    const pool = newPool()
    jest.spyOn(pool, 'purge')
    const connectionProvider = newDirectConnectionProvider(address, pool)

    const conn = await connectionProvider.acquireConnection({
      accessMode: 'READ',
      database: ''
    })

    const error = newError(
      'Message',
      'Neo.ClientError.Security.AuthorizationExpired'
    )

    conn.handleAndTransformError(error, address)

    expect(pool.purge).toHaveBeenCalledWith(address)
  })

  it('should purge not change error when AuthorizationExpired happens', async () => {
    const address = ServerAddress.fromUrl('localhost:123')
    const pool = newPool()
    const connectionProvider = newDirectConnectionProvider(address, pool)

    const conn = await connectionProvider.acquireConnection({
      accessMode: 'READ',
      database: ''
    })

    const expectedError = newError(
      'Message',
      'Neo.ClientError.Security.AuthorizationExpired'
    )

    const error = conn.handleAndTransformError(expectedError, address)

    expect(error).toBe(expectedError)
  })
})

it('should purge connections for address when TokenExpired happens', async () => {
  const address = ServerAddress.fromUrl('localhost:123')
  const pool = newPool()
  jest.spyOn(pool, 'purge')
  const connectionProvider = newDirectConnectionProvider(address, pool)

  const conn = await connectionProvider.acquireConnection({
    accessMode: 'READ',
    database: ''
  })

  const error = newError(
    'Message',
    'Neo.ClientError.Security.TokenExpired'
  )

  conn.handleAndTransformError(error, address)

  expect(pool.purge).toHaveBeenCalledWith(address)
})

it('should not change error when TokenExpired happens', async () => {
  const address = ServerAddress.fromUrl('localhost:123')
  const pool = newPool()
  const connectionProvider = newDirectConnectionProvider(address, pool)

  const conn = await connectionProvider.acquireConnection({
    accessMode: 'READ',
    database: ''
  })

  const expectedError = newError(
    'Message',
    'Neo.ClientError.Security.TokenExpired'
  )

  const error = conn.handleAndTransformError(expectedError, address)

  expect(error).toBe(expectedError)
})

describe('.verifyConnectivityAndGetServerInfo()', () => {
  describe('when connection is available in the pool', () => {
    it('should return the server info', async () => {
      const { connectionProvider, server, protocolVersion } = setup()

      const serverInfo = await connectionProvider.verifyConnectivityAndGetServerInfo()

      expect(serverInfo).toEqual(new ServerInfo(server, protocolVersion))
    })

    it('should reset and flush the connection', async () => {
      const { connectionProvider, resetAndFlush } = setup()

      await connectionProvider.verifyConnectivityAndGetServerInfo()

      expect(resetAndFlush).toBeCalledTimes(1)
    })

    it('should release the connection', async () => {
      const { connectionProvider, seenConnections } = setup()

      await connectionProvider.verifyConnectivityAndGetServerInfo()

      expect(seenConnections[0]._release).toHaveBeenCalledTimes(1)
    })

    it('should resetAndFlush and then release the connection', async () => {
      const { connectionProvider, seenConnections, resetAndFlush } = setup()

      await connectionProvider.verifyConnectivityAndGetServerInfo()

      expect(seenConnections[0]._release.mock.invocationCallOrder[0])
        .toBeGreaterThan(resetAndFlush.mock.invocationCallOrder[0])
    })

    describe('when reset and flush fails', () => {
      it('should fails with the reset and flush error', async () => {
        const error = newError('Error')
        const { connectionProvider, resetAndFlush } = setup()

        resetAndFlush.mockRejectedValue(error)

        try {
          await connectionProvider.verifyConnectivityAndGetServerInfo()
          expect().toBe('Not reached')
        } catch (e) {
          expect(e).toBe(error)
        }
      })

      it('should release the connection', async () => {
        const error = newError('Error')
        const { connectionProvider, resetAndFlush, seenConnections } = setup()

        resetAndFlush.mockRejectedValue(error)

        try {
          await connectionProvider.verifyConnectivityAndGetServerInfo()
        } catch (e) {
        } finally {
          expect(seenConnections[0]._release).toHaveBeenCalledTimes(1)
        }
      })

      describe('and release fails', () => {
        it('should fails with the release error', async () => {
          const error = newError('Error')
          const releaseError = newError('release errror')

          const { connectionProvider, resetAndFlush } = setup(
            {
              releaseMock: () => Promise.reject(releaseError)
            })

          resetAndFlush.mockRejectedValue(error)

          try {
            await connectionProvider.verifyConnectivityAndGetServerInfo()
            expect().toBe('Not reached')
          } catch (e) {
            expect(e).toBe(releaseError)
          }
        })
      })
    })

    describe('when release fails', () => {
      it('should fails with the release error', async () => {
        const error = newError('Error')

        const { connectionProvider } = setup(
          {
            releaseMock: () => Promise.reject(error)
          })

        try {
          await connectionProvider.verifyConnectivityAndGetServerInfo()
          expect().toBe('Not reached')
        } catch (e) {
          expect(e).toBe(error)
        }
      })
    })

    function setup ({ releaseMock } = {}) {
      const protocolVersion = 4.4
      const resetAndFlush = jest.fn(() => Promise.resolve())
      const server = { address: 'localhost:123', version: 'neo4j/1234' }
      const seenConnections = []
      const create = (address, release) => {
        const connection = new FakeConnection(address, release, server)
        connection.protocol = () => {
          return { version: protocolVersion, isLastMessageLogin () { return false } }
        }
        connection.resetAndFlush = resetAndFlush
        if (releaseMock) {
          connection._release = releaseMock
        }
        seenConnections.push(connection)
        return connection
      }
      const address = ServerAddress.fromUrl('localhost:123')
      const pool = newPool({ create })
      const connectionProvider = newDirectConnectionProvider(address, pool)
      return {
        connectionProvider,
        server,
        protocolVersion,
        resetAndFlush,
        seenConnections
      }
    }
  })

  describe('when connection is not available in the pool', () => {
    it('should reject with acquisition timeout error', async () => {
      const address = ServerAddress.fromUrl('localhost:123')
      const pool = newPool({
        config: {
          acquisitionTimeout: 0
        }
      })

      const connectionProvider = newDirectConnectionProvider(address, pool)

      try {
        await connectionProvider.verifyConnectivityAndGetServerInfo()
        expect().toBe('not reached')
      } catch (e) {
        expect(e).toBeDefined()
      }
    })
  })

  describe('when connection it could not create the connection', () => {
    it('should reject with connection creation error', async () => {
      const error = new Error('Connection creation error')
      const address = ServerAddress.fromUrl('localhost:123')
      const pool = newPool({
        create: () => { throw error }
      })

      const connectionProvider = newDirectConnectionProvider(address, pool)

      try {
        await connectionProvider.verifyConnectivityAndGetServerInfo()
        expect().toBe('not reached')
      } catch (e) {
        expect(e).toBe(error)
      }
    })
  })
})

function newDirectConnectionProvider (address, pool) {
  const connectionProvider = new DirectConnectionProvider({
    id: 0,
    config: {},
    log: Logger.noOp(),
    address: address
  })
  connectionProvider._connectionPool = pool
  return connectionProvider
}

function newPool ({ create, config } = {}) {
  const _create = (address, release) => {
    if (create) {
      return create(address, release)
    }
    return new FakeConnection(address, release)
  }
  return new Pool({
    config,
    create: (address, release) =>
      Promise.resolve(_create(address, release))
  })
}

class FakeConnection extends Connection {
  constructor (address, release, server) {
    super(null)

    this._address = address
    this._release = jest.fn(() => release(address, this))
    this._server = server
  }

  get address () {
    return this._address
  }

  get server () {
    return this._server
  }
}

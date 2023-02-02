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
import AuthenticationProvider from '../../src/connection-provider/authentication-provider'
import { functional } from '../../src/lang'

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

  it('should close connection and remove authToken for address when AuthorizationExpired happens', async () => {
    const address = ServerAddress.fromUrl('localhost:123')
    const pool = newPool()
    jest.spyOn(pool, 'purge')
    jest.spyOn(pool, 'apply')
    const connectionProvider = newDirectConnectionProvider(address, pool)

    const conn = await connectionProvider.acquireConnection({
      accessMode: 'READ',
      database: ''
    })

    const error = newError(
      'Message',
      'Neo.ClientError.Security.AuthorizationExpired'
    )

    jest.spyOn(conn, 'close')

    conn.handleAndTransformError(error, address)

    expect(conn.close).toHaveBeenCalled()
    expect(pool.purge).not.toHaveBeenCalledWith(address)
    expect(pool.apply).toHaveBeenCalledTimes(1)

    const [[calledAddress, appliedFunction]] = pool.apply.mock.calls

    expect(calledAddress).toBe(address)

    const fakeConn = { authToken: 'some token' }

    appliedFunction(fakeConn)
    expect(fakeConn.authToken).toBe(null)
    pool.apply(address, conn => expect(conn.authToken).toBe(null))
  })

  it('should call authenticationAuthProvider.handleError when AuthorizationExpired happens', async () => {
    const address = ServerAddress.fromUrl('localhost:123')
    const pool = newPool()
    const connectionProvider = newDirectConnectionProvider(address, pool)

    const handleError = jest.spyOn(connectionProvider._authenticationProvider, 'handleError')

    const conn = await connectionProvider.acquireConnection({
      accessMode: 'READ',
      database: ''
    })

    const error = newError(
      'Message',
      'Neo.ClientError.Security.AuthorizationExpired'
    )

    conn.handleAndTransformError(error, address)

    expect(handleError).toBeCalledWith({ connection: conn, code: 'Neo.ClientError.Security.AuthorizationExpired' })
  })

  it('should not change error when AuthorizationExpired happens', async () => {
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

it('should close the connection when TokenExpired happens', async () => {
  const address = ServerAddress.fromUrl('localhost:123')
  const pool = newPool()
  jest.spyOn(pool, 'purge')
  jest.spyOn(pool, 'apply')
  const connectionProvider = newDirectConnectionProvider(address, pool)

  const conn = await connectionProvider.acquireConnection({
    accessMode: 'READ',
    database: ''
  })

  const error = newError(
    'Message',
    'Neo.ClientError.Security.TokenExpired'
  )

  jest.spyOn(conn, 'close')

  conn.handleAndTransformError(error, address)

  expect(conn.close).toHaveBeenCalled()
  expect(pool.purge).not.toHaveBeenCalledWith(address)
  expect(pool.apply).toHaveBeenCalledTimes(0)
  pool.apply(address, conn => expect(conn.authToken).toBeDefined())
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

it('should call authenticationAuthProvider.handleError when TokenExpired happens', async () => {
  const address = ServerAddress.fromUrl('localhost:123')
  const pool = newPool()
  const connectionProvider = newDirectConnectionProvider(address, pool)

  const handleError = jest.spyOn(connectionProvider._authenticationProvider, 'handleError')

  const conn = await connectionProvider.acquireConnection({
    accessMode: 'READ',
    database: ''
  })

  const error = newError(
    'Message',
    'Neo.ClientError.Security.TokenExpired'
  )

  conn.handleAndTransformError(error, address)

  expect(handleError).toBeCalledWith({ connection: conn, code: 'Neo.ClientError.Security.TokenExpired' })
})

describe('constructor', () => {
  describe('newPool', () => {
    const server0 = ServerAddress.fromUrl('localhost:123')
    const server01 = ServerAddress.fromUrl('localhost:1235')

    describe('param.create', () => {
      it('should create connection', async () => {
        const { create, createChannelConnectionHook, provider } = setup()

        const connection = await create({}, server0, undefined)

        expect(createChannelConnectionHook).toHaveBeenCalledWith(server0)
        expect(provider._openConnections[connection.id]).toBe(connection)
        await expect(createChannelConnectionHook.mock.results[0].value).resolves.toBe(connection)
      })

      it('should register the release function into the connection', async () => {
        const { create } = setup()
        const releaseResult = { property: 'some property' }
        const release = jest.fn(() => releaseResult)

        const connection = await create({}, server0, release)

        const released = connection._release()

        expect(released).toBe(releaseResult)
        expect(release).toHaveBeenCalledWith(server0, connection)
      })

      it.each([
        null,
        undefined,
        { scheme: 'bearer', credentials: 'token01' }
      ])('should authenticate connection (auth = %o)', async (auth) => {
        const { create, authenticationProviderHook } = setup()

        const connection = await create({ auth }, server0)

        expect(authenticationProviderHook.authenticate).toHaveBeenCalledWith({
          connection,
          auth
        })
      })

      it('should handle create connection failures', async () => {
        const error = newError('some error')
        const createConnection = jest.fn(() => Promise.reject(error))
        const { create, authenticationProviderHook, provider } = setup({ createConnection })
        const openConnections = { ...provider._openConnections }

        await expect(create({}, server0)).rejects.toThrow(error)

        expect(authenticationProviderHook.authenticate).not.toHaveBeenCalled()
        expect(provider._openConnections).toEqual(openConnections)
      })

      it.each([
        null,
        undefined,
        { scheme: 'bearer', credentials: 'token01' }
      ])('should handle authentication failures (auth = %o)', async (auth) => {
        const error = newError('some error')
        const authenticationProvider = jest.fn(() => Promise.reject(error))
        const { create, authenticationProviderHook, createChannelConnectionHook, provider } = setup({ authenticationProvider })
        const openConnections = { ...provider._openConnections }

        await expect(create({ auth }, server0)).rejects.toThrow(error)

        const connection = await createChannelConnectionHook.mock.results[0].value
        expect(authenticationProviderHook.authenticate).toHaveBeenCalledWith({ auth, connection })
        expect(provider._openConnections).toEqual(openConnections)
        expect(connection._closed).toBe(true)
      })
    })

    describe('param.destroy', () => {
      it('should close connection and unregister it', async () => {
        const { create, destroy, provider } = setup()
        const openConnections = { ...provider._openConnections }
        const connection = await create({}, server0, undefined)

        await destroy(connection)

        expect(connection._closed).toBe(true)
        expect(provider._openConnections).toEqual(openConnections)
      })
    })

    describe('param.validateOnAcquire', () => {
      it.each([
        null,
        undefined,
        { scheme: 'bearer', credentials: 'token01' }
      ])('should return true when connection is open and within the lifetime and authentication succeed (auth=%o)', async (auth) => {
        const connection = new FakeConnection(server0)
        connection.creationTimestamp = Date.now()

        const { validateOnAcquire, authenticationProviderHook } = setup()

        await expect(validateOnAcquire({ auth }, connection)).resolves.toBe(true)

        expect(authenticationProviderHook.authenticate).toHaveBeenCalledWith({
          connection, auth
        })
      })

      it.each([
        null,
        undefined,
        { scheme: 'bearer', credentials: 'token01' }
      ])('should return true when connection is open and within the lifetime and authentication fails (auth=%o)', async (auth) => {
        const connection = new FakeConnection(server0)
        const error = newError('failed')
        const authenticationProvider = jest.fn(() => Promise.reject(error))
        connection.creationTimestamp = Date.now()

        const { validateOnAcquire, authenticationProviderHook, log } = setup({ authenticationProvider })

        await expect(validateOnAcquire({ auth }, connection)).resolves.toBe(false)

        expect(authenticationProviderHook.authenticate).toHaveBeenCalledWith({
          connection, auth
        })

        expect(log.debug).toHaveBeenCalledWith(
          `The connection ${connection.id} is not valid because of an error ${error.code} '${error.message}'`
        )
      })
      it('should return false when connection is closed and within the lifetime', async () => {
        const connection = new FakeConnection(server0)
        connection.creationTimestamp = Date.now()
        await connection.close()

        const { validateOnAcquire, authenticationProviderHook } = setup()

        await expect(validateOnAcquire({}, connection)).resolves.toBe(false)
        expect(authenticationProviderHook.authenticate).not.toHaveBeenCalled()
      })

      it('should return false when connection is open and out of the lifetime', async () => {
        const connection = new FakeConnection(server0)
        connection.creationTimestamp = Date.now() - 4000

        const { validateOnAcquire, authenticationProviderHook } = setup({ maxConnectionLifetime: 3000 })

        await expect(validateOnAcquire({}, connection)).resolves.toBe(false)
        expect(authenticationProviderHook.authenticate).not.toHaveBeenCalled()
      })

      it('should return false when connection is closed and out of the lifetime', async () => {
        const connection = new FakeConnection(server0)
        await connection.close()
        connection.creationTimestamp = Date.now() - 4000

        const { validateOnAcquire, authenticationProviderHook } = setup({ maxConnectionLifetime: 3000 })

        await expect(validateOnAcquire({}, connection)).resolves.toBe(false)
        expect(authenticationProviderHook.authenticate).not.toHaveBeenCalled()
      })
    })

    describe('param.validateOnRelease', () => {
      it('should return true when connection is open and within the lifetime', () => {
        const connection = new FakeConnection(server0)
        connection.creationTimestamp = Date.now()

        const { validateOnRelease } = setup()

        expect(validateOnRelease(connection)).toBe(true)
      })

      it('should return false when connection is closed and within the lifetime', async () => {
        const connection = new FakeConnection(server0)
        connection.creationTimestamp = Date.now()
        await connection.close()

        const { validateOnRelease } = setup()

        expect(validateOnRelease(connection)).toBe(false)
      })

      it('should return false when connection is open and out of the lifetime', () => {
        const connection = new FakeConnection(server0)
        connection.creationTimestamp = Date.now() - 4000

        const { validateOnRelease } = setup({ maxConnectionLifetime: 3000 })

        expect(validateOnRelease(connection)).toBe(false)
      })

      it('should return false when connection is closed and out of the lifetime', async () => {
        const connection = new FakeConnection(server0)
        await connection.close()
        connection.creationTimestamp = Date.now() - 4000

        const { validateOnRelease } = setup({ maxConnectionLifetime: 3000 })

        expect(validateOnRelease(connection)).toBe(false)
      })

      it('should return false when connection is sticky', async () => {
        const connection = new FakeConnection(server0)
        connection._sticky = true

        const { validateOnRelease } = setup()

        expect(validateOnRelease(connection)).toBe(false)
      })
    })

    function setup ({ createConnection, authenticationProvider, maxConnectionLifetime } = {}) {
      const newPool = jest.fn((...args) => new Pool(...args))
      const log = new Logger('debug', () => undefined)
      jest.spyOn(log, 'debug')
      const createChannelConnectionHook = createConnection || jest.fn(async (address) => new FakeConnection(address))
      const authenticationProviderHook = new AuthenticationProvider({ })
      jest.spyOn(authenticationProviderHook, 'authenticate')
        .mockImplementation(authenticationProvider || jest.fn(({ connection }) => Promise.resolve(connection)))
      const provider = new DirectConnectionProvider({
        newPool,
        config: {
          maxConnectionLifetime: maxConnectionLifetime || 1000
        },
        address: server01,
        log
      })
      provider._createChannelConnection = createChannelConnectionHook
      provider._authenticationProvider = authenticationProviderHook
      return {
        provider,
        ...newPool.mock.calls[0][0],
        createChannelConnectionHook,
        authenticationProviderHook,
        log
      }
    }
  })
})

describe('user-switching', () => {
  describe.each([
    undefined,
    false,
    null
  ])('when allowStickyConnection is %s', (allowStickyConnection) => {
    describe('when does not supports re-auth', () => {
      it.each([
        ['new connection', { other: 'auth' }, { other: 'auth' }, true],
        ['old connection', { some: 'auth' }, { other: 'token' }, false]
      ])('should raise and error when try switch user on acquire [%s]', async (_, connAuth, acquireAuth, isStickyConn) => {
        const address = ServerAddress.fromUrl('localhost:123')
        const pool = newPool()
        const connection = new FakeConnection(address, () => {}, undefined, connAuth)
        const poolAcquire = jest.spyOn(pool, 'acquire').mockResolvedValue(connection)
        const connectionProvider = newDirectConnectionProvider(address, pool)

        const error = await connectionProvider
          .acquireConnection({
            accessMode: 'READ',
            database: '',
            allowStickyConnection,
            auth: acquireAuth
          })
          .catch(functional.identity)

        expect(error).toEqual(newError('Driver is connected to a database that does not support user switch.'))
        expect(poolAcquire).toHaveBeenCalledWith({ auth: acquireAuth }, address)
        expect(connection._release).toHaveBeenCalled()
        expect(connection._sticky).toEqual(isStickyConn)
      })
    })

    describe('when supports re-auth', () => {
      const connAuth = { some: 'auth' }
      const acquireAuth = connAuth

      it('should return connection when try switch user on acquire', async () => {
        const address = ServerAddress.fromUrl('localhost:123')
        const pool = newPool()
        const connection = new FakeConnection(address, () => {}, undefined, connAuth, { supportsReAuth: true })
        jest.spyOn(pool, 'acquire').mockResolvedValue(connection)
        const connectionProvider = newDirectConnectionProvider(address, pool)

        const delegatedConnection = await connectionProvider
          .acquireConnection({
            accessMode: 'READ',
            database: '',
            allowStickyConnection,
            auth: acquireAuth
          })

        expect(delegatedConnection).toBeInstanceOf(DelegateConnection)
        expect(delegatedConnection._delegate).toBe(connection)
        expect(connection._sticky).toEqual(false)
      })
    })
  })
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
          return { version: protocolVersion, isLastMessageLogon () { return false } }
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
  const auth = { scheme: 'bearer', credentials: 'my token' }
  const _create = (address, release) => {
    if (create) {
      return create(address, release)
    }
    return new FakeConnection(address, release, undefined, auth)
  }
  return new Pool({
    config,
    create: (_, address, release) =>
      Promise.resolve(_create(address, release))
  })
}

class FakeConnection extends Connection {
  constructor (address, release, server, auth, { supportsReAuth } = {}) {
    super(null)

    this._address = address
    this._release = jest.fn(() => release(address, this))
    this._server = server
    this._authToken = auth
    this._closed = false
    this._id = 1
    this._supportsReAuth = supportsReAuth || false
  }

  get id () {
    return this._id
  }

  get authToken () {
    return this._authToken
  }

  set authToken (authToken) {
    this._authToken = authToken
  }

  get address () {
    return this._address
  }

  get server () {
    return this._server
  }

  get supportsReAuth () {
    return this._supportsReAuth
  }

  async close () {
    this._closed = true
  }

  isOpen () {
    return !this._closed
  }
}

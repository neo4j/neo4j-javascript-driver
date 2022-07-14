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
import { internal, newError } from 'neo4j-driver-core'
import testUtils from '../test-utils'

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
  
  describe('config.sessionConnectionTimeout', () => {
    describe('when connection is acquired in time', () => {
      let connectionPromise
      let address
      let pool
  
      beforeEach(() => {
        address = ServerAddress.fromUrl('localhost:123')
        pool = newPool()
        const connectionProvider = newDirectConnectionProvider(address, pool, {
          sessionConnectionTimeout: 120000
        })
  
        connectionPromise = connectionProvider
          .acquireConnection({ accessMode: 'READ', database: '' })
      })
  
      it('should resolve with the connection', async () => {
        const connection = await connectionPromise
  
        expect(connection).toBeDefined()
        expect(connection.address).toEqual(address)
        expect(pool.has(address)).toBeTruthy()
      })
    })
  
    describe('when connection is not acquired in time', () => {
      let connectionPromise
      let address
      let pool
      let seenConnections
  
      beforeEach(() => {
        seenConnections = []
        address = ServerAddress.fromUrl('localhost:123')
        pool = newPool({ delay: 1000, seenConnections })
        const connectionProvider = newDirectConnectionProvider(address, pool, {
          sessionConnectionTimeout: 500
        })
  
        connectionPromise = connectionProvider
          .acquireConnection({ accessMode: 'READ', database: '' })
      })
  
      it('should reject with Session acquisition timeout error', async () => {
        await expect(connectionPromise).rejects.toThrowError(newError(
          'Session acquisition timed out in 500 ms.'
        ))
      })
  
      it('should return the connection back to the pool', async () => {
        await expect(connectionPromise).rejects.toThrow()
        // wait for connection be released to the pool
        await testUtils.wait(600)
  
        expect(seenConnections.length).toBe(1)
        expect(seenConnections[0]._release).toBeCalledTimes(1)
        expect(pool.has(address)).toBe(true)
      })
    })
  })
})

function newDirectConnectionProvider (address, pool, config) {
  const connectionProvider = new DirectConnectionProvider({
    id: 0,
    config: { ...config },
    log: Logger.noOp(),
    address: address
  })
  connectionProvider._connectionPool = pool
  return connectionProvider
}

function newPool ({ create, config, delay, seenConnections = [] } = {}) {
  const _create = (address, release) => {
    const connection = create != null ? create(address, release) : new FakeConnection(address, release)
    seenConnections.push(connection)
    return connection
  }
  return new Pool({
    config,
    create: async (address, release) => {
      await testUtils.wait(delay)
      return _create(address, release)
    }
  })
}

class FakeConnection extends Connection {
  constructor (address, release) {
    super(null)

    this._address = address
    this.release = release
    this._release = jest.fn(() => release(address, this))
  }

  get address () {
    return this._address
  }
}

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

function newPool () {
  return new Pool({
    create: (address, release) =>
      Promise.resolve(new FakeConnection(address, release))
  })
}

class FakeConnection extends Connection {
  constructor (address, release) {
    super(null)

    this._address = address
    this.release = release
  }

  get address () {
    return this._address
  }
}

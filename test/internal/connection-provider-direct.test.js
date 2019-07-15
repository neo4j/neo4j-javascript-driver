/**
 * Copyright (c) 2002-2019 "Neo4j,"
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

import { READ } from '../../src/driver'
import DirectConnectionProvider from '../../src/internal/connection-provider-direct'
import Pool from '../../src/internal/pool'
import ServerAddress from '../../src/internal/server-address'
import Connection from '../../src/internal/connection'
import Logger from '../../src/internal/logger'
import DelegateConnection from '../../src/internal/connection-delegate'

describe('#unit DirectConnectionProvider', () => {
  it('acquires connection from the pool', done => {
    const address = ServerAddress.fromUrl('localhost:123')
    const pool = newPool()
    const connectionProvider = newDirectConnectionProvider(address, pool)

    connectionProvider.acquireConnection(READ, '').then(connection => {
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

    const conn = await connectionProvider.acquireConnection(READ, '')
    expect(conn instanceof DelegateConnection).toBeTruthy()
  })
})

function newDirectConnectionProvider (address, pool) {
  const connectionProvider = new DirectConnectionProvider({
    id: 0,
    config: {},
    logger: Logger.noOp(),
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

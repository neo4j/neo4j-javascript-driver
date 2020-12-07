/**
 * Copyright (c) 2002-2020 "Neo4j,"
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

import Rediscovery from '../../src/internal/rediscovery'
import RoutingTable from '../../src/internal/routing-table'
import ServerAddress from '../../src/internal/server-address'

xdescribe('#unit Rediscovery', () => {
  it('should return the routing table when it available', async () => {
    const expectedRoutingTable = new RoutingTable({
      database: 'db',
      expirationTime: 113,
      routers: [ServerAddress.fromUrl('bolt://localhost:7687')],
      writers: [ServerAddress.fromUrl('bolt://localhost:7686')],
      readers: [ServerAddress.fromUrl('bolt://localhost:7683')]
    })
    const routingTableGetter = new FakeRoutingTableGetter(
      Promise.resolve(expectedRoutingTable)
    )

    const routingTable = await lookupRoutingTableOnRouter({
      routingTableGetter
    })

    expect(routingTable).toBe(expectedRoutingTable)
  })

  it('should call getter once with correct arguments', async () => {
    const expectedRoutingTable = new RoutingTable()
    const connection = { connection: 'abc' }
    const database = 'adb'
    const session = new FakeSession(connection)
    const routerAddress = ServerAddress.fromUrl('bolt://localhost:7682')
    const routingTableGetter = new FakeRoutingTableGetter(
      Promise.resolve(expectedRoutingTable)
    )

    await lookupRoutingTableOnRouter({
      routingTableGetter,
      connection,
      session,
      database,
      routerAddress
    })

    expect(routingTableGetter._called).toEqual(1)
    expect(routingTableGetter._arguments).toEqual([
      connection,
      database,
      routerAddress,
      session
    ])
  })

  it('should acquire connection once', async () => {
    const expectedRoutingTable = new RoutingTable()
    const connection = { connection: 'abc' }
    const database = 'adb'
    const session = new FakeSession(connection)
    const routerAddress = ServerAddress.fromUrl('bolt://localhost:7682')
    const routingTableGetter = new FakeRoutingTableGetter(
      Promise.resolve(expectedRoutingTable)
    )

    await lookupRoutingTableOnRouter({
      routingTableGetter,
      connection,
      session,
      database,
      routerAddress
    })

    expect(session._called).toEqual(1)
  })

  it('should create the routingTableGetter with the correct arguments', async () => {
    const routingTable = new RoutingTable()
    const connection = { connection: 'abc' }
    const routingTableGetter = new FakeRoutingTableGetter(
      Promise.resolve(routingTable)
    )
    const factory = new FakeRoutingTableGetterFactory(routingTableGetter)

    await lookupRoutingTableOnRouter({
      routingTableGetter,
      factory,
      connection
    })

    expect(factory._called).toEqual(1)
    expect(factory._arguments).toEqual([connection])
  })

  it('should return null when the getter resolves the table as null', async () => {
    const routingTableGetter = new FakeRoutingTableGetter(Promise.resolve(null))

    const routingTable = await lookupRoutingTableOnRouter({
      routingTableGetter
    })

    expect(routingTable).toBeNull()
  })

  it('should fail when the getter fails', async () => {
    const expectedError = 'error'
    try {
      const routingTableGetter = new FakeRoutingTableGetter(
        Promise.reject(expectedError)
      )
      await lookupRoutingTableOnRouter({ routingTableGetter })
      fail('should not complete with success')
    } catch (error) {
      expect(error).toBe(expectedError)
    }
  })
})

function lookupRoutingTableOnRouter ({
  database = 'db',
  routerAddress = ServerAddress.fromUrl('bolt://localhost:7687'),
  routingTableGetter = new FakeRoutingTableGetter(
    Promise.resolve(new RoutingTable())
  ),
  session,
  factory,
  connection = {}
} = {}) {
  const _factory =
    factory || new FakeRoutingTableGetterFactory(routingTableGetter)
  const _session = session || new FakeSession(connection)
  const rediscovery = new Rediscovery(_factory)

  return rediscovery.lookupRoutingTableOnRouter(
    _session,
    database,
    routerAddress
  )
}

class FakeRoutingTableGetter {
  constructor (result) {
    this._result = result
    this._called = 0
  }

  get () {
    this._called++
    this._arguments = [...arguments]
    return this._result
  }
}

class FakeRoutingTableGetterFactory {
  constructor (routingTableGetter) {
    this._routingTableGetter = routingTableGetter
    this._called = 0
  }

  create () {
    this._called++
    this._arguments = [...arguments]
    return this._routingTableGetter
  }
}

class FakeSession {
  constructor (connection) {
    this._connection = connection
    this._called = 0
  }

  _acquireConnection (callback) {
    this._called++
    return callback(this._connection)
  }
}

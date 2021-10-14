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

import { RawRoutingTable } from '../../src/bolt'
import Rediscovery from '../../src/rediscovery'
import RoutingTable from '../../src/rediscovery/routing-table'
import FakeConnection from '../fake-connection'
import lolex from 'lolex'
import { newError, error, int, internal } from 'neo4j-driver-core'

const {
  serverAddress: { ServerAddress }
} = internal

const { PROTOCOL_ERROR, SERVICE_UNAVAILABLE } = error

const PROCEDURE_NOT_FOUND_CODE = 'Neo.ClientError.Procedure.ProcedureNotFound'
const DATABASE_NOT_FOUND_CODE = 'Neo.ClientError.Database.DatabaseNotFound'

describe('#unit Rediscovery', () => {
  it('should return the routing table when it available', async () => {
    runWithClockAt(Date.now(), async () => {
      const ttl = int(123)
      const routers = ['bolt://localhost:7687']
      const writers = ['bolt://localhost:7686']
      const readers = ['bolt://localhost:7683']
      const initialAddress = '127.0.0.1'
      const routingContext = { context: '1234 ' }
      const rawRoutingTable = RawRoutingTable.ofMessageResponse(
        newMetadata({ ttl, routers, readers, writers })
      )

      const expectedRoutingTable = new RoutingTable({
        database: 'db',
        ttl,
        expirationTime: calculateExpirationTime(Date.now(), ttl),
        routers: [ServerAddress.fromUrl('bolt://localhost:7687')],
        writers: [ServerAddress.fromUrl('bolt://localhost:7686')],
        readers: [ServerAddress.fromUrl('bolt://localhost:7683')]
      })

      const routingTable = await lookupRoutingTableOnRouter({
        initialAddress,
        routingContext,
        rawRoutingTable
      })

      expect(routingTable).toEqual(expectedRoutingTable)
    })
  })

  it('should return the routing table null when it is not available', async () => {
    const initialAddress = '127.0.0.1'
    const routingContext = { context: '1234 ' }
    const rawRoutingTable = RawRoutingTable.ofNull()

    const routingTable = await lookupRoutingTableOnRouter({
      initialAddress,
      routingContext,
      rawRoutingTable
    })

    expect(routingTable).toEqual(null)
  })

  it('should call requestRoutingInformation with the correct params', async () => {
    const ttl = int(123)
    const routers = ['bolt://localhost:7687']
    const writers = ['bolt://localhost:7686']
    const readers = ['bolt://localhost:7683']
    const initialAddress = '127.0.0.1:1245'
    const routingContext = { context: '1234 ' }
    const database = 'this db'
    const rawRoutingTable = RawRoutingTable.ofMessageResponse(
      newMetadata({ ttl, routers, readers, writers })
    )
    const connection = new FakeConnection().withRequestRoutingInformationMock(
      fakeOnError(rawRoutingTable)
    )
    const session = new FakeSession(connection)

    await lookupRoutingTableOnRouter({
      database,
      connection,
      initialAddress,
      routingContext,
      rawRoutingTable
    })

    expect(connection.seenRequestRoutingInformation.length).toEqual(1)
    const requestParams = connection.seenRequestRoutingInformation[0]
    expect(requestParams.routingContext).toEqual(routingContext)
    expect(requestParams.databaseName).toEqual(database)
    expect(requestParams.sessionContext).toEqual({
      bookmark: session._lastBookmark,
      mode: session._mode,
      database: session._database,
      afterComplete: session._onComplete
    })
  })

  it('should reject with DATABASE_NOT_FOUND_CODE when it happens ', async () => {
    const expectedError = newError('Laia', DATABASE_NOT_FOUND_CODE)
    try {
      const initialAddress = '127.0.0.1'
      const routingContext = { context: '1234 ' }

      const connection = new FakeConnection().withRequestRoutingInformationMock(
        fakeOnError(expectedError)
      )
      await lookupRoutingTableOnRouter({
        initialAddress,
        routingContext,
        connection
      })

      fail('it should fail')
    } catch (error) {
      expect(error).toEqual(expectedError)
    }
  })

  it('should reject with PROCEDURE_NOT_FOUND_CODE when it happens ', async () => {
    const routerAddress = ServerAddress.fromUrl('bolt://localhost:1235')
    const expectedError = newError(
      `Server at ${routerAddress.asHostPort()} can't perform routing. Make sure you are connecting to a causal cluster`,
      SERVICE_UNAVAILABLE
    )
    try {
      const initialAddress = '127.0.0.1'
      const routingContext = { context: '1234 ' }

      const connection = new FakeConnection().withRequestRoutingInformationMock(
        fakeOnError(newError('1de', PROCEDURE_NOT_FOUND_CODE))
      )
      await lookupRoutingTableOnRouter({
        initialAddress,
        routingContext,
        connection,
        routerAddress
      })

      fail('it should fail')
    } catch (error) {
      expect(error).toEqual(expectedError)
    }
  })

  it('should return null when it happens an unexpected error ocorrus', async () => {
    const initialAddress = '127.0.0.1'
    const routingContext = { context: '1234 ' }

    const connection = new FakeConnection().withRequestRoutingInformationMock(
      fakeOnError(newError('1de', 'abc'))
    )
    const routingTable = await lookupRoutingTableOnRouter({
      initialAddress,
      routingContext,
      connection
    })

    expect(routingTable).toEqual(null)
  })

  it('should throw PROTOCOL_ERROR if the routing table is invalid', async () => {
    runWithClockAt(Date.now(), async () => {
      try {
        const ttl = int(123)
        const routers = ['bolt://localhost:7687']
        const writers = ['bolt://localhost:7686']
        const readers = []
        const initialAddress = '127.0.0.1'
        const routingContext = { context: '1234 ' }
        const rawRoutingTable = RawRoutingTable.ofMessageResponse(
          newMetadata({ ttl, routers, readers, writers })
        )

        await lookupRoutingTableOnRouter({
          initialAddress,
          routingContext,
          rawRoutingTable
        })

        fail('should not succeed')
      } catch (error) {
        expect(error).toEqual(
          newError(
            'Received no readers from router localhost:7687',
            PROTOCOL_ERROR
          )
        )
      }
    })
  })
})

function newMetadata ({
  ttl = int(42),
  routers = [],
  readers = [],
  writers = [],
  extra = []
} = {}) {
  const routersField = {
    role: 'ROUTE',
    addresses: routers
  }
  const readersField = {
    role: 'READ',
    addresses: readers
  }
  const writersField = {
    role: 'WRITE',
    addresses: writers
  }
  return {
    rt: {
      ttl,
      servers: [routersField, readersField, writersField, ...extra]
    }
  }
}

async function runWithClockAt (currentTime, callback) {
  const clock = lolex.install()
  try {
    clock.setSystemTime(currentTime)
    return await callback(currentTime)
  } finally {
    clock.uninstall()
  }
}

function calculateExpirationTime (currentTime, ttl) {
  return int(currentTime + ttl.toNumber() * 1000)
}

function lookupRoutingTableOnRouter ({
  database = 'db',
  routerAddress = ServerAddress.fromUrl('bolt://localhost:7687'),
  routingContext = {},
  initialAddress = 'localhost:1235',
  session,
  connection = new FakeConnection(),
  rawRoutingTable
} = {}) {
  const _session = session || new FakeSession(connection)

  if (connection && rawRoutingTable) {
    connection.withRequestRoutingInformationMock(
      fakeOnCompleted(rawRoutingTable)
    )
  }

  const rediscovery = new Rediscovery(routingContext, initialAddress)

  return rediscovery.lookupRoutingTableOnRouter(
    _session,
    database,
    routerAddress
  )
}
class FakeSession {
  constructor (connection) {
    this._connection = connection
    this._called = 0
    this._lastBookmark = 'lastBook'
    this._mode = 'READ'
    this._database = 'session db'
    this._onComplete = 'moked'
  }

  _acquireConnection (callback) {
    this._called++
    return callback(this._connection)
  }
}

function fakeOnCompleted (raw = null) {
  return ({ onCompleted }) => onCompleted(raw)
}

function fakeOnError (error) {
  return ({ onError }) => onError(error)
}

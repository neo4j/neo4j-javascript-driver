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

import {
  newError,
  Neo4jError,
  error,
  Integer,
  int,
  internal
} from 'neo4j-driver-core'
import { RoutingTable } from '../../src/rediscovery/'
import { Pool } from '../../src/pool'
import SimpleHostNameResolver from '../../src/channel/browser/browser-host-name-resolver'
import RoutingConnectionProvider from '../../src/connection-provider/connection-provider-routing'
import { DelegateConnection, Connection } from '../../src/connection'

const {
  serverAddress: { ServerAddress },
  logger: { Logger }
} = internal

const { SERVICE_UNAVAILABLE, SESSION_EXPIRED } = error
const READ = 'READ'
const WRITE = 'WRITE'

describe('#unit RoutingConnectionProvider', () => {
  const server0 = ServerAddress.fromUrl('server0')
  const server1 = ServerAddress.fromUrl('server1')
  const server2 = ServerAddress.fromUrl('server2')
  const server3 = ServerAddress.fromUrl('server3')
  const server4 = ServerAddress.fromUrl('server4')
  const server5 = ServerAddress.fromUrl('server5')
  const server6 = ServerAddress.fromUrl('server6')
  const server7 = ServerAddress.fromUrl('server7')
  const server42 = ServerAddress.fromUrl('server42')

  const server01 = ServerAddress.fromUrl('server01')
  const server02 = ServerAddress.fromUrl('server02')
  const server03 = ServerAddress.fromUrl('server03')

  const serverA = ServerAddress.fromUrl('serverA')
  const serverB = ServerAddress.fromUrl('serverB')
  const serverC = ServerAddress.fromUrl('serverC')
  const serverD = ServerAddress.fromUrl('serverD')
  const serverE = ServerAddress.fromUrl('serverE')
  const serverF = ServerAddress.fromUrl('serverF')
  const serverG = ServerAddress.fromUrl('serverG')

  const serverAA = ServerAddress.fromUrl('serverAA')
  const serverBB = ServerAddress.fromUrl('serverBB')
  const serverCC = ServerAddress.fromUrl('serverCC')
  const serverDD = ServerAddress.fromUrl('serverDD')
  const serverEE = ServerAddress.fromUrl('serverEE')

  const serverABC = ServerAddress.fromUrl('serverABC')
  
  const usersDataSet = [
    [null],
    [undefined],
    ['the-impostor']
  ]

  it('can forget address', () => {
    const connectionProvider = newRoutingConnectionProvider([
      newRoutingTable(
        null,
        [server1, server2],
        [server3, server2],
        [server2, server4]
      )
    ])

    connectionProvider.forget(server2)

    expectRoutingTable(
      connectionProvider,
      null,
      [server1, server2],
      [server3],
      [server4]
    )
  }, 10000)

  it('can not forget unknown address', () => {
    const connectionProvider = newRoutingConnectionProvider([
      newRoutingTable(
        null,
        [server1, server2],
        [server3, server4],
        [server5, server6]
      )
    ])

    connectionProvider.forget(server42)

    expectRoutingTable(
      connectionProvider,
      null,
      [server1, server2],
      [server3, server4],
      [server5, server6]
    )
  }, 10000)

  it('purges connections when address is forgotten', () => {
    const pool = newPool()

    pool.acquire(server1)
    pool.acquire(server3)
    pool.acquire(server5)
    expectPoolToContain(pool, [server1, server3, server5])

    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          null,
          [server1, server2],
          [server3, server2],
          [server2, server4]
        )
      ],
      pool
    )

    connectionProvider.forget(server1)
    connectionProvider.forget(server5)

    expectPoolToContain(pool, [server3])
    expectPoolToNotContain(pool, [server1, server5])
  }, 10000)

  it('can forget writer address', () => {
    const connectionProvider = newRoutingConnectionProvider([
      newRoutingTable(
        null,
        [server1, server2],
        [server3, server2],
        [server2, server4]
      )
    ])

    connectionProvider.forgetWriter(server2)

    expectRoutingTable(
      connectionProvider,
      null,
      [server1, server2],
      [server3, server2],
      [server4]
    )
  }, 10000)

  it('can not forget unknown writer address', () => {
    const connectionProvider = newRoutingConnectionProvider([
      newRoutingTable(
        null,
        [server1, server2],
        [server3, server4],
        [server5, server6]
      )
    ])

    connectionProvider.forgetWriter(server42)

    expectRoutingTable(
      connectionProvider,
      null,
      [server1, server2],
      [server3, server4],
      [server5, server6]
    )
  }, 10000)

  it.each(usersDataSet)('acquires connection and returns a DelegateConnection [user=%s]', async (user) => {
    const pool = newPool()
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          null,
          [server1, server2],
          [server3, server4],
          [server5, server6]
        )
      ],
      pool
    )

    const conn1 = await connectionProvider.acquireConnection({
      accessMode: READ,
      database: null,
      impersonatedUser: user
    })
    expect(conn1 instanceof DelegateConnection).toBeTruthy()

    const conn2 = await connectionProvider.acquireConnection({
      accessMode: WRITE,
      database: null,
      impersonatedUser: user
    })
    expect(conn2 instanceof DelegateConnection).toBeTruthy()
  }, 10000)

  it.each(usersDataSet)('acquires read connection with up-to-date routing table [user=%s]', (user, done) => {
    const pool = newPool()
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          null,
          [server1, server2],
          [server3, server4],
          [server5, server6]
        )
      ],
      pool
    )

    connectionProvider
      .acquireConnection({ accessMode: READ, database: null, impersonatedUser: user })
      .then(connection => {
        expect(connection.address).toEqual(server3)
        expect(pool.has(server3)).toBeTruthy()

        connectionProvider
          .acquireConnection({ accessMode: READ, database: null })
          .then(connection => {
            expect(connection.address).toEqual(server4)
            expect(pool.has(server4)).toBeTruthy()

            done()
          })
      })
  }, 10000)

  it.each(usersDataSet)('acquires write connection with up-to-date routing table [user=%s]', (user, done) => {
    const pool = newPool()
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          null,
          [server1, server2],
          [server3, server4],
          [server5, server6]
        )
      ],
      pool
    )

    connectionProvider
      .acquireConnection({ accessMode: WRITE, database: null, impersonatedUser: user })
      .then(connection => {
        expect(connection.address).toEqual(server5)
        expect(pool.has(server5)).toBeTruthy()

        connectionProvider
          .acquireConnection({ accessMode: WRITE, database: null, impersonatedUser: user })
          .then(connection => {
            expect(connection.address).toEqual(server6)
            expect(pool.has(server6)).toBeTruthy()

            done()
          })
      })
  }, 10000)

  it.each(usersDataSet)('throws for illegal access mode [user=%s]', (user, done) => {
    const connectionProvider = newRoutingConnectionProvider([
      newRoutingTable(
        null,
        [server1, server2],
        [server3, server4],
        [server5, server6]
      )
    ])

    connectionProvider
      .acquireConnection({ accessMode: 'WRONG', database: null, impersonatedUser: user })
      .catch(error => {
        expect(error.message).toEqual('Illegal mode WRONG')
        done()
      })
  }, 10000)

  it.each(usersDataSet)('refreshes stale routing table to get read connection [user=%s]', (user, done) => {
    const pool = newPool()
    const updatedRoutingTable = newRoutingTable(
      null,
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    )
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          null,
          [server1, server2],
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      pool,
      { null: { 'server1:7687': updatedRoutingTable } }
    )

    connectionProvider
      .acquireConnection({ accessMode: READ, database: null, impersonatedUser: user })
      .then(connection => {
        expect(connection.address).toEqual(serverC)
        expect(pool.has(serverC)).toBeTruthy()

        connectionProvider
          .acquireConnection({ accessMode: READ, database: null, impersonatedUser: user })
          .then(connection => {
            expect(connection.address).toEqual(serverD)
            expect(pool.has(serverD)).toBeTruthy()

            done()
          })
      })
  }, 10000)

  it.each(usersDataSet)('refreshes stale routing table to get write connection [user=%s]', (user, done) => {
    const pool = newPool()
    const updatedRoutingTable = newRoutingTable(
      null,
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    )
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          null,
          [server1, server2],
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      pool,
      { null: { 'server1:7687': updatedRoutingTable } }
    )

    connectionProvider
      .acquireConnection({ accessMode: WRITE, database: null, impersonatedUser: user })
      .then(connection => {
        expect(connection.address).toEqual(serverE)
        expect(pool.has(serverE)).toBeTruthy()

        connectionProvider
          .acquireConnection({ accessMode: WRITE, database: null, impersonatedUser: user })
          .then(connection => {
            expect(connection.address).toEqual(serverF)
            expect(pool.has(serverF)).toBeTruthy()

            done()
          })
      })
  }, 10000)

  it.each(usersDataSet)('refreshes stale routing table to get read connection when one router fails [user=%s]', (user, done) => {
    const pool = newPool()
    const updatedRoutingTable = newRoutingTable(
      null,
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    )
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          null,
          [server1, server2],
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      pool,
      {
        null: {
          'server1:7687': null, // returns no routing table
          'server2:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider
      .acquireConnection({ accessMode: READ, database: null, impersonatedUser: user })
      .then(connection => {
        expect(connection.address).toEqual(serverC)
        expect(pool.has(serverC)).toBeTruthy()

        connectionProvider
          .acquireConnection({ accessMode: READ, database: null, impersonatedUser: user })
          .then(connection => {
            expect(connection.address).toEqual(serverD)
            expect(pool.has(serverD)).toBeTruthy()

            done()
          })
      })
  }, 10000)

  it.each(usersDataSet)('refreshes stale routing table to get write connection when one router fails [user=%s]', (user, done) => {
    const pool = newPool()
    const updatedRoutingTable = newRoutingTable(
      null,
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    )
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          null,
          [server1, server2],
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      pool,
      {
        null: {
          'server1:7687': null, // returns no routing table
          'server2:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider
      .acquireConnection({ accessMode: WRITE, database: null, impersonatedUser: user })
      .then(connection => {
        expect(connection.address).toEqual(serverE)
        expect(pool.has(serverE)).toBeTruthy()

        connectionProvider
          .acquireConnection({ accessMode: WRITE, database: null, impersonatedUser: user })
          .then(connection => {
            expect(connection.address).toEqual(serverF)
            expect(pool.has(serverF)).toBeTruthy()

            done()
          })
      })
  }, 10000)

  it.each(usersDataSet)('refreshes routing table without readers to get read connection [user=%s]', (user, done) => {
    const pool = newPool()
    const updatedRoutingTable = newRoutingTable(
      null,
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    )
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          null,
          [server1, server2],
          [], // no readers
          [server3, server4],
          Integer.MAX_VALUE
        )
      ],
      pool,
      {
        null: {
          'server1:7687': null, // returns no routing table
          'server2:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider
      .acquireConnection({ accessMode: READ, database: null, impersonatedUser: user })
      .then(connection => {
        expect(connection.address).toEqual(serverC)
        expect(pool.has(serverC)).toBeTruthy()

        connectionProvider
          .acquireConnection({ accessMode: READ, database: null, impersonatedUser: user })
          .then(connection => {
            expect(connection.address).toEqual(serverD)
            expect(pool.has(serverD)).toBeTruthy()

            done()
          })
      })
  }, 10000)

  it.each(usersDataSet)('refreshes routing table without writers to get write connection [user=%s]', (user, done) => {
    const pool = newPool()
    const updatedRoutingTable = newRoutingTable(
      null,
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    )
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          null,
          [server1, server2],
          [server3, server4],
          [], // no writers
          int(0) // expired routing table
        )
      ],
      pool,
      {
        null: {
          'server1:7687': null, // returns no routing table
          'server2:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider
      .acquireConnection({ accessMode: WRITE, database: null, impersonatedUser: user })
      .then(connection => {
        expect(connection.address).toEqual(serverE)
        expect(pool.has(serverE)).toBeTruthy()

        connectionProvider
          .acquireConnection({ accessMode: WRITE, database: null, impersonatedUser: user })
          .then(connection => {
            expect(connection.address).toEqual(serverF)
            expect(pool.has(serverF)).toBeTruthy()

            done()
          })
      })
  }, 10000)

  it.each(usersDataSet)('throws when all routers return nothing while getting read connection [user=%s]', (user, done) => {
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          null,
          [server1, server2],
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      newPool(),
      {
        null: {
          'server1:7687': null, // returns no routing table
          'server2:7687': null // returns no routing table
        }
      }
    )

    connectionProvider
      .acquireConnection({ accessMode: READ, database: null, impersonatedUser: user })
      .catch(error => {
        expect(error.code).toEqual(SERVICE_UNAVAILABLE)
        done()
      })
  }, 10000)

  it.each(usersDataSet)('throws when all routers return nothing while getting write connection [user=%s]', (user, done) => {
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          null,
          [server1, server2],
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      newPool(),
      {
        null: {
          'server1:7687': null, // returns no routing table
          'server2:7687': null // returns no routing table
        }
      }
    )

    connectionProvider
      .acquireConnection({ accessMode: WRITE, database: null, impersonatedUser: user })
      .catch(error => {
        expect(error.code).toEqual(SERVICE_UNAVAILABLE)
        done()
      })
  }, 10000)

  it.each(usersDataSet)('throws when all routers return routing tables without readers while getting read connection', (user, done) => {
    const updatedRoutingTable = newRoutingTable(
      null,
      [serverA, serverB],
      [], // no readers - table can't satisfy connection requirement
      [serverC, serverD]
    )
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          null,
          [server1, server2],
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      newPool(),
      {
        null: {
          'server1:7687': updatedRoutingTable,
          'server2:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider
      .acquireConnection({ accessMode: READ, database: null, impersonatedUser: user })
      .catch(error => {
        expect(error.code).toEqual(SESSION_EXPIRED)
        done()
      })
  }, 10000)

  it.each(usersDataSet)('throws when all routers return routing tables without writers while getting write connection [user=%s]', (user, done) => {
    const updatedRoutingTable = newRoutingTable(
      null,
      [serverA, serverB],
      [serverC, serverD],
      [] // no writers - table can't satisfy connection requirement
    )
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          null,
          [server1, server2],
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      newPool(),
      {
        null: {
          'server1:7687': updatedRoutingTable,
          'server2:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider
      .acquireConnection({ accessMode: WRITE, database: null, impersonatedUser: user })
      .catch(error => {
        expect(error.code).toEqual(SESSION_EXPIRED)
        done()
      })
  }, 10000)

  it.each(usersDataSet)('throws when stale routing table without routers while getting read connection [user=%s]', (user, done) => {
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          null,
          [], // no routers
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      newPool()
    )

    connectionProvider
      .acquireConnection({ accessMode: READ, database: null, impersonatedUser: user })
      .catch(error => {
        expect(error.code).toEqual(SERVICE_UNAVAILABLE)
        done()
      })
  }, 10000)

  it.each(usersDataSet)('throws when stale routing table without routers while getting write connection [user=%s]', (user, done) => {
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          null,
          [], // no routers
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      newPool()
    )

    connectionProvider
      .acquireConnection({ accessMode: WRITE, database: null, impersonatedUser: user })
      .catch(error => {
        expect(error.code).toEqual(SERVICE_UNAVAILABLE)
        done()
      })
  }, 10000)

  it.each(usersDataSet)('updates routing table after refresh [user=%s]', (user, done) => {
    const pool = newPool()
    const updatedRoutingTable = newRoutingTable(
      null,
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    )
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          null,
          [server1, server2],
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      pool,
      {
        null: {
          'server1:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider
      .acquireConnection({ accessMode: READ, database: null, impersonatedUser: user })
      .then(() => {
        expectRoutingTable(
          connectionProvider,
          null,
          [serverA, serverB],
          [serverC, serverD],
          [serverE, serverF]
        )
        expectPoolToNotContain(pool, [
          server1,
          server2,
          server3,
          server4,
          server5,
          server6
        ])
        done()
      })
  }, 10000)

  it.each(usersDataSet)('forgets all routers when they fail while acquiring read connection [user=%s]', (user, done) => {
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          null,
          [server1, server2, server3],
          [server4, server5],
          [server6, server7],
          int(0) // expired routing table
        )
      ],
      newPool()
    )

    connectionProvider
      .acquireConnection({ accessMode: READ, database: null, impersonatedUser: user })
      .catch(error => {
        expect(error.code).toEqual(SERVICE_UNAVAILABLE)
        expectRoutingTable(
          connectionProvider,
          null,
          [],
          [server4, server5],
          [server6, server7]
        )
        done()
      })
  }, 10000)

  it.each(usersDataSet)('forgets all routers when they fail while acquiring write connection [user=%s]', (user, done) => {
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          null,
          [server1, server2, server3],
          [server4, server5],
          [server6, server7],
          int(0) // expired routing table
        )
      ],
      newPool()
    )

    connectionProvider
      .acquireConnection({ accessMode: WRITE, database: null, impersonatedUser: user })
      .catch(error => {
        expect(error.code).toEqual(SERVICE_UNAVAILABLE)
        expectRoutingTable(
          connectionProvider,
          null,
          [],
          [server4, server5],
          [server6, server7]
        )
        done()
      })
  }, 10000)

  it.each(usersDataSet)('uses seed router address when all existing routers fail [user=%s]', (user, done) => {
    const updatedRoutingTable = newRoutingTable(
      null,
      [serverA, serverB, serverC],
      [serverD, serverE],
      [serverF, serverG]
    )

    const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
      server0,
      [server0], // seed router address resolves just to itself
      [
        newRoutingTable(
          null,
          [server1, server2, server3],
          [server4, server5],
          [server6, server7],
          int(0) // expired routing table
        )
      ],
      {
        null: {
          'server1:7687': null, // returns no routing table
          'server2:7687': null, // returns no routing table
          'server3:7687': null, // returns no routing table
          'server0:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider
      .acquireConnection({ accessMode: READ, database: null, impersonatedUser: user })
      .then(connection1 => {
        expect(connection1.address).toEqual(serverD)

        connectionProvider
          .acquireConnection({ accessMode: WRITE, database: null, impersonatedUser: user })
          .then(connection2 => {
            expect(connection2.address).toEqual(serverF)

            expectRoutingTable(
              connectionProvider,
              null,
              [serverA, serverB, serverC],
              [serverD, serverE],
              [serverF, serverG]
            )
            done()
          })
      })
  }, 10000)

  it.each(usersDataSet)('uses resolved seed router address when all existing routers fail [user=%s]', (user, done) => {
    const updatedRoutingTable = newRoutingTable(
      null,
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    )

    const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
      server0,
      [server01], // seed router address resolves to a different one
      [
        newRoutingTable(
          null,
          [server1, server2, server3],
          [server4, server5],
          [server6, server7],
          int(0) // expired routing table
        )
      ],
      {
        null: {
          'server1:7687': null, // returns no routing table
          'server2:7687': null, // returns no routing table
          'server3:7687': null, // returns no routing table
          'server01:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider
      .acquireConnection({ accessMode: WRITE, database: null, user })
      .then(connection1 => {
        expect(connection1.address).toEqual(serverE)

        connectionProvider
          .acquireConnection({ accessMode: READ, database: null, user })
          .then(connection2 => {
            expect(connection2.address).toEqual(serverC)

            expectRoutingTable(
              connectionProvider,
              null,
              [serverA, serverB],
              [serverC, serverD],
              [serverE, serverF]
            )
            done()
          })
      })
  }, 10000)

  it.each(usersDataSet)('uses resolved seed router address that returns correct routing table when all existing routers fail [user=%s]', (user, done) => {
    const updatedRoutingTable = newRoutingTable(
      null,
      [serverA, serverB],
      [serverC],
      [serverD, serverE]
    )

    const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
      server0,
      [server01, server02, server03], // seed router address resolves to 3 different addresses
      [
        newRoutingTable(
          null,
          [server1],
          [server2],
          [server3],
          int(0) // expired routing table
        )
      ],
      {
        null: {
          'server1:7687': null, // returns no routing table
          'server01:7687': null, // returns no routing table
          'server02:7687': null, // returns no routing table
          'server03:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider
      .acquireConnection({ accessMode: WRITE, database: null, impersonatedUser: user })
      .then(connection1 => {
        expect(connection1.address).toEqual(serverD)

        connectionProvider
          .acquireConnection({ accessMode: WRITE, database: null, impersonatedUser: user })
          .then(connection2 => {
            expect(connection2.address).toEqual(serverE)

            expectRoutingTable(
              connectionProvider,
              null,
              [serverA, serverB],
              [serverC],
              [serverD, serverE]
            )
            done()
          })
      })
  }, 10000)

  it.each(usersDataSet)('fails when both existing routers and seed router fail to return a routing table [user=%s]', (user, done) => {
    const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
      server0,
      [server0], // seed router address resolves just to itself
      [
        newRoutingTable(
          null,
          [server1, server2, server3],
          [server4, server5],
          [server6],
          int(0) // expired routing table
        )
      ],
      {
        null: {
          'server1:7687': null, // returns no routing table
          'server2:7687': null, // returns no routing table
          'server3:7687': null, // returns no routing table
          'server0:7687': null // returns no routing table
        }
      }
    )

    connectionProvider
      .acquireConnection({ accessMode: READ, database: null, impersonatedUser: user })
      .catch(error => {
        expect(error.code).toEqual(SERVICE_UNAVAILABLE)

        expectRoutingTable(
          connectionProvider,
          null,
          [], // all routers were forgotten because they failed
          [server4, server5],
          [server6]
        )

        connectionProvider
          .acquireConnection({ accessMode: WRITE, database: null, impersonatedUser: user })
          .catch(error => {
            expect(error.code).toEqual(SERVICE_UNAVAILABLE)

            expectRoutingTable(
              connectionProvider,
              null,
              [], // all routers were forgotten because they failed
              [server4, server5],
              [server6]
            )

            done()
          })
      })
  }, 10000)

  it.each(usersDataSet)('fails when both existing routers and resolved seed router fail to return a routing table [user=%s]', (user, done) => {
    const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
      server0,
      [server01], // seed router address resolves to a different one
      [
        newRoutingTable(
          null,
          [server1, server2],
          [server3],
          [server4],
          int(0) // expired routing table
        )
      ],
      {
        null: {
          'server1:7687': null, // returns no routing table
          'server2:7687': null, // returns no routing table
          'server01:7687': null // returns no routing table
        }
      }
    )

    connectionProvider
      .acquireConnection({ accessMode: WRITE, database: null, impersonatedUser: user })
      .catch(error => {
        expect(error.code).toEqual(SERVICE_UNAVAILABLE)

        expectRoutingTable(
          connectionProvider,
          null,
          [], // all routers were forgotten because they failed
          [server3],
          [server4]
        )

        connectionProvider
          .acquireConnection({ accessMode: READ, database: null, impersonatedUser: user })
          .catch(error => {
            expect(error.code).toEqual(SERVICE_UNAVAILABLE)

            expectRoutingTable(
              connectionProvider,
              null,
              [], // all routers were forgotten because they failed
              [server3],
              [server4]
            )

            done()
          })
      })
  }, 10000)

  it.each(usersDataSet)('fails when both existing routers and all resolved seed routers fail to return a routing table [user=%s]', (user, done) => {
    const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
      server0,
      [server02, server01], // seed router address resolves to 2 different addresses
      [
        newRoutingTable(
          null,
          [server1, server2, server3],
          [server4],
          [server5],
          int(0) // expired routing table
        )
      ],
      {
        null: {
          'server1:7687': null, // returns no routing table
          'server2:7687': null, // returns no routing table
          'server3:7687': null, // returns no routing table
          'server01:7687': null, // returns no routing table
          'server02:7687': null // returns no routing table
        }
      }
    )

    connectionProvider
      .acquireConnection({ accessMode: READ, database: null, impersonatedUser: user })
      .catch(error => {
        expect(error.code).toEqual(SERVICE_UNAVAILABLE)

        expectRoutingTable(
          connectionProvider,
          null,
          [], // all known seed servers failed to return routing tables and were forgotten
          [server4],
          [server5]
        )

        connectionProvider
          .acquireConnection({ accessMode: WRITE, database: null, impersonatedUser: user })
          .catch(error => {
            expect(error.code).toEqual(SERVICE_UNAVAILABLE)

            expectRoutingTable(
              connectionProvider,
              null,
              [], // all known seed servers failed to return routing tables and were forgotten
              [server4],
              [server5]
            )

            done()
          })
      })
  }, 10000)

  it.each(usersDataSet)('uses seed router when no existing routers [user=%s]', (user, done) => {
    const updatedRoutingTable = newRoutingTable(
      null,
      [serverA, serverB],
      [serverC],
      [serverD]
    )

    const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
      server0,
      [server0], // seed router address resolves just to itself
      [
        newRoutingTable(
          null,
          [], // no routers in the known routing table
          [server1, server2],
          [server3],
          Integer.MAX_VALUE // not expired
        )
      ],
      {
        null: {
          'server0:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider
      .acquireConnection({ accessMode: WRITE, database: null, impersonatedUser: user })
      .then(connection1 => {
        expect(connection1.address).toEqual(serverD)

        connectionProvider
          .acquireConnection({ accessMode: READ, database: null, impersonatedUser: user })
          .then(connection2 => {
            expect(connection2.address).toEqual(serverC)

            expectRoutingTable(
              connectionProvider,
              null,
              [serverA, serverB],
              [serverC],
              [serverD]
            )
            done()
          })
      })
  }, 10000)

  it.each(usersDataSet)('uses resolved seed router when no existing routers [user=%s]', (user, done) => {
    const updatedRoutingTable = newRoutingTable(
      null,
      [serverA, serverB],
      [serverC, serverD],
      [serverF, serverE]
    )

    const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
      server0,
      [server01], // seed router address resolves to a different one
      [
        newRoutingTable(
          null,
          [], // no routers in the known routing table
          [server1, server2],
          [server3, server4],
          Integer.MAX_VALUE // not expired
        )
      ],
      {
        null: {
          'server01:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider
      .acquireConnection({ accessMode: READ, database: null, impersonatedUser: user })
      .then(connection1 => {
        expect(connection1.address).toEqual(serverC)

        connectionProvider
          .acquireConnection({ accessMode: WRITE, database: null, impersonatedUser: user })
          .then(connection2 => {
            expect(connection2.address).toEqual(serverF)

            expectRoutingTable(
              connectionProvider,
              null,
              [serverA, serverB],
              [serverC, serverD],
              [serverF, serverE]
            )
            done()
          })
      })
  }, 10000)

  it.each(usersDataSet)('uses resolved seed router that returns routing table when no existing routers exist [user=%s]', (user, done) => {
    const updatedRoutingTable = newRoutingTable(
      null,
      [serverA, serverB, serverC],
      [serverD, serverE],
      [serverF]
    )

    const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
      server0,
      [server02, server01, server03], // seed router address resolves to 3 different addresses
      [
        newRoutingTable(
          null,
          [], // no routers in the known routing table
          [server1],
          [server2, server3],
          Integer.MAX_VALUE // not expired
        )
      ],
      {
        null: {
          'server01:7687': null, // returns no routing table
          'server02:7687': null, // returns no routing table
          'server03:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider
      .acquireConnection({ accessMode: WRITE, database: null, impersonatedUser: user })
      .then(connection1 => {
        expect(connection1.address).toEqual(serverF)

        connectionProvider
          .acquireConnection({ accessMode: READ, database: null, impersonatedUser: user })
          .then(connection2 => {
            expect(connection2.address).toEqual(serverD)

            expectRoutingTable(
              connectionProvider,
              null,
              [serverA, serverB, serverC],
              [serverD, serverE],
              [serverF]
            )
            done()
          })
      })
  }, 10000)

  it.each(usersDataSet)('ignores already probed routers after seed router resolution [user=%s]', (user, done) => {
    const updatedRoutingTable = newRoutingTable(
      null,
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    )

    const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
      server0,
      [server1, server01, server2, server02], // seed router address resolves to 4 different addresses
      [
        newRoutingTable(
          null,
          [server1, server2],
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      {
        null: {
          'server1:7687': null, // returns no routing table
          'server01:7687': null, // returns no routing table
          'server2:7687': null, // returns no routing table
          'server02:7687': updatedRoutingTable
        }
      }
    )
    // override default use of seed router
    connectionProvider._useSeedRouter = false

    const usedRouterArrays = []
    setupRoutingConnectionProviderToRememberRouters(
      connectionProvider,
      usedRouterArrays
    )

    connectionProvider
      .acquireConnection({ accessMode: READ, database: null, impersonatedUser: user })
      .then(connection1 => {
        expect(connection1.address).toEqual(serverC)

        connectionProvider
          .acquireConnection({ accessMode: WRITE, database: null, impersonatedUser: user })
          .then(connection2 => {
            expect(connection2.address).toEqual(serverE)

            // two sets of routers probed:
            // 1) existing routers server1 & server2
            // 2) resolved routers server01 & server02
            expect(usedRouterArrays.length).toEqual(2)
            expect(usedRouterArrays[0]).toEqual([server1, server2])
            expect(usedRouterArrays[1]).toEqual([server01, server02])

            expectRoutingTable(
              connectionProvider,
              null,
              [serverA, serverB],
              [serverC, serverD],
              [serverE, serverF]
            )
            done()
          })
      })
  }, 10000)

  it.each(usersDataSet)('throws session expired when refreshed routing table has no readers [user=%s]', (user, done) => {
    const pool = newPool()
    const updatedRoutingTable = newRoutingTable(
      null,
      [serverA, serverB],
      [], // no readers
      [serverC, serverD]
    )
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          null,
          [server1, server2],
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      pool,
      {
        null: {
          'server1:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider
      .acquireConnection({ accessMode: READ, database: null, impersonatedUser: user })
      .catch(error => {
        expect(error.code).toEqual(SESSION_EXPIRED)
        done()
      })
  }, 10000)

  it.each(usersDataSet)('throws session expired when refreshed routing table has no writers [user=%s]', (user, done) => {
    const pool = newPool()
    const updatedRoutingTable = newRoutingTable(
      null,
      [serverA, serverB],
      [serverC, serverD],
      [] // no writers
    )
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          null,
          [server1, server2],
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      pool,
      {
        null: {
          'server1:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider
      .acquireConnection({ accessMode: WRITE, database: null, impersonatedUser: user })
      .catch(error => {
        expect(error.code).toEqual(SESSION_EXPIRED)
        done()
      })
  }, 10000)

  it.each(usersDataSet)('should purge connections for address when AuthorizationExpired happens [user=%s]', async (user) => {
    const pool = newPool()

    jest.spyOn(pool, 'purge')

    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          null,
          [server1, server2],
          [server3, server2],
          [server2, server4]
        )
      ],
      pool
    )

    const error = newError(
      'Message',
      'Neo.ClientError.Security.AuthorizationExpired'
    )

    const server2Connection = await connectionProvider.acquireConnection({
      accessMode: 'WRITE',
      database: null,
      impersonatedUser: user
    })

    const server3Connection = await connectionProvider.acquireConnection({
      accessMode: 'READ',
      database: null,
      impersonatedUser: user
    })

    server3Connection.handleAndTransformError(error, server3)
    server2Connection.handleAndTransformError(error, server2)

    expect(pool.purge).toHaveBeenCalledWith(server3)
    expect(pool.purge).toHaveBeenCalledWith(server2)
  })

  it.each(usersDataSet)('should purge not change error when AuthorizationExpired happens [user=%s]', async (user) => {
    const pool = newPool()

    jest.spyOn(pool, 'purge')

    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          null,
          [server1, server2],
          [server3, server2],
          [server2, server4]
        )
      ],
      pool
    )

    const expectedError = newError(
      'Message',
      'Neo.ClientError.Security.AuthorizationExpired'
    )

    const server2Connection = await connectionProvider.acquireConnection({
      accessMode: 'WRITE',
      database: null,
      impersonatedUser: user
    })

    const error = server2Connection.handleAndTransformError(
      expectedError,
      server2
    )

    expect(error).toBe(expectedError)
  })

  it.each(usersDataSet)('should purge connections for address when TokenExpired happens [user=%s]', async (user) => {
    const pool = newPool()

    jest.spyOn(pool, 'purge')

    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          null,
          [server1, server2],
          [server3, server2],
          [server2, server4]
        )
      ],
      pool
    )

    const error = newError(
      'Message',
      'Neo.ClientError.Security.TokenExpired'
    )

    const server2Connection = await connectionProvider.acquireConnection({
      accessMode: 'WRITE',
      database: null,
      impersonatedUser: user
    })

    const server3Connection = await connectionProvider.acquireConnection({
      accessMode: 'READ',
      database: null,
      impersonatedUser: user
    })

    server3Connection.handleAndTransformError(error, server3)
    server2Connection.handleAndTransformError(error, server2)

    expect(pool.purge).toHaveBeenCalledWith(server3)
    expect(pool.purge).toHaveBeenCalledWith(server2)
  })

  it.each(usersDataSet)('should not change error when TokenExpired happens [user=%s]', async (user) => {
    const pool = newPool()

    jest.spyOn(pool, 'purge')

    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          null,
          [server1, server2],
          [server3, server2],
          [server2, server4]
        )
      ],
      pool
    )

    const expectedError = newError(
      'Message',
      'Neo.ClientError.Security.TokenExpired'
    )

    const server2Connection = await connectionProvider.acquireConnection({
      accessMode: 'WRITE',
      database: null,
      impersonatedUser: user
    })

    const error = server2Connection.handleAndTransformError(
      expectedError,
      server2
    )

    expect(error).toBe(expectedError)
  })

  it.each(usersDataSet)('should use resolved seed router after accepting table with no writers [user=%s]', (user, done) => {
    const routingTable1 = newRoutingTable(
      null,
      [serverA, serverB],
      [serverC, serverD],
      [] // no writers
    )
    const routingTable2 = newRoutingTable(
      null,
      [serverAA, serverBB],
      [serverCC, serverDD],
      [serverEE]
    )

    const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
      server0,
      [server02, server01], // seed router address resolves to 2 different addresses
      [
        newRoutingTable(
          null,
          [server1],
          [server2, server3],
          [server4, server5],
          int(0) // expired routing table
        )
      ],
      {
        null: {
          'server1:7687': routingTable1,
          'serverA:7687': routingTable1,
          'serverB:7687': routingTable1,
          'server01:7687': null, // returns no routing table
          'server02:7687': routingTable2
        }
      }
    )
    // override default use of seed router
    connectionProvider._useSeedRouter = false

    connectionProvider
      .acquireConnection({ accessMode: READ, database: null, impersonatedUser: user })
      .then(connection1 => {
        expect(connection1.address).toEqual(serverC)

        connectionProvider
          .acquireConnection({ accessMode: READ, database: null, impersonatedUser: user })
          .then(connection2 => {
            expect(connection2.address).toEqual(serverD)

            expectRoutingTable(
              connectionProvider,
              null,
              [serverA, serverB],
              [serverC, serverD],
              []
            )

            connectionProvider
              .acquireConnection({ accessMode: WRITE, database: null, impersonatedUser: user })
              .then(connection3 => {
                expect(connection3.address).toEqual(serverEE)

                expectRoutingTable(
                  connectionProvider,
                  null,
                  [serverAA, serverBB],
                  [serverCC, serverDD],
                  [serverEE]
                )

                done()
              })
          })
      })
  }, 10000)

  describe('multi-database', () => {
    it.each(usersDataSet)('should acquire read connection from correct routing table [user=%s]', async (user) => {
      const pool = newPool()
      const connectionProvider = newRoutingConnectionProvider(
        [
          newRoutingTable(
            'databaseA',
            [server1, server2],
            [server1],
            [server2]
          ),
          newRoutingTable('databaseB', [serverA, serverB], [serverA], [serverB])
        ],
        pool
      )

      const conn1 = await connectionProvider.acquireConnection({
        accessMode: READ,
        database: 'databaseA',
        impersonatedUser: user
      })
      expect(conn1 instanceof DelegateConnection).toBeTruthy()
      expect(conn1.address).toBe(server1)

      const conn2 = await connectionProvider.acquireConnection({
        accessMode: READ,
        database: 'databaseB',
        impersonatedUser: user
      })
      expect(conn2 instanceof DelegateConnection).toBeTruthy()
      expect(conn2.address).toBe(serverA)
    }, 10000)

    it.each(usersDataSet)('should purge connections for address when AuthorizationExpired happens [user=%s]', async (user) => {
      const pool = newPool()

      jest.spyOn(pool, 'purge')

      const connectionProvider = newRoutingConnectionProvider(
        [
          newRoutingTable(
            'databaseA',
            [server1, server2],
            [server1],
            [server2]
          ),
          newRoutingTable('databaseB', [serverA, serverB], [serverA], [serverB])
        ],
        pool
      )

      const error = newError(
        'Message',
        'Neo.ClientError.Security.AuthorizationExpired'
      )

      const server2Connection = await connectionProvider.acquireConnection({
        accessMode: 'WRITE',
        database: 'databaseA',
        impersonatedUser: user
      })

      const serverAConnection = await connectionProvider.acquireConnection({
        accessMode: 'READ',
        database: 'databaseB',
        impersonatedUser: user
      })

      serverAConnection.handleAndTransformError(error, serverA)
      server2Connection.handleAndTransformError(error, server2)

      expect(pool.purge).toHaveBeenCalledWith(serverA)
      expect(pool.purge).toHaveBeenCalledWith(server2)
    })

    it.each(usersDataSet)('should purge not change error when AuthorizationExpired happens [user=%s]', async (user) => {
      const pool = newPool()

      const connectionProvider = newRoutingConnectionProvider(
        [
          newRoutingTable(
            'databaseA',
            [server1, server2],
            [server1],
            [server2]
          ),
          newRoutingTable('databaseB', [serverA, serverB], [serverA], [serverB])
        ],
        pool
      )

      const expectedError = newError(
        'Message',
        'Neo.ClientError.Security.AuthorizationExpired'
      )

      const server2Connection = await connectionProvider.acquireConnection({
        accessMode: 'WRITE',
        database: 'databaseA',
        impersonatedUser: user
      })

      const error = server2Connection.handleAndTransformError(
        expectedError,
        server2
      )

      expect(error).toBe(expectedError)
    })

    it.each(usersDataSet)('should purge connections for address when TokenExpired happens [user=%s]', async (user) => {
      const pool = newPool()

      jest.spyOn(pool, 'purge')

      const connectionProvider = newRoutingConnectionProvider(
        [
          newRoutingTable(
            'databaseA',
            [server1, server2],
            [server1],
            [server2]
          ),
          newRoutingTable('databaseB', [serverA, serverB], [serverA], [serverB])
        ],
        pool
      )

      const error = newError(
        'Message',
        'Neo.ClientError.Security.TokenExpired'
      )

      const server2Connection = await connectionProvider.acquireConnection({
        accessMode: 'WRITE',
        database: 'databaseA',
        impersonatedUser: user
      })

      const serverAConnection = await connectionProvider.acquireConnection({
        accessMode: 'READ',
        database: 'databaseB',
        impersonatedUser: user
      })

      serverAConnection.handleAndTransformError(error, serverA)
      server2Connection.handleAndTransformError(error, server2)

      expect(pool.purge).toHaveBeenCalledWith(serverA)
      expect(pool.purge).toHaveBeenCalledWith(server2)
    })

    it.each(usersDataSet)('should not change error when TokenExpired happens [user=%s]', async (user) => {
      const pool = newPool()

      const connectionProvider = newRoutingConnectionProvider(
        [
          newRoutingTable(
            'databaseA',
            [server1, server2],
            [server1],
            [server2]
          ),
          newRoutingTable('databaseB', [serverA, serverB], [serverA], [serverB])
        ],
        pool
      )

      const expectedError = newError(
        'Message',
        'Neo.ClientError.Security.TokenExpired'
      )

      const server2Connection = await connectionProvider.acquireConnection({
        accessMode: 'WRITE',
        database: 'databaseA',
        impersonatedUser: user
      })

      const error = server2Connection.handleAndTransformError(
        expectedError,
        server2
      )

      expect(error).toBe(expectedError)
    })

    it.each(usersDataSet)('should acquire write connection from correct routing table [user=%s]', async (user) => {
      const pool = newPool()
      const connectionProvider = newRoutingConnectionProvider(
        [
          newRoutingTable(
            'databaseA',
            [server1, server2],
            [server1],
            [server2]
          ),
          newRoutingTable('databaseB', [serverA, serverB], [serverA], [serverB])
        ],
        pool
      )

      const conn1 = await connectionProvider.acquireConnection({
        accessMode: WRITE,
        database: 'databaseA',
        impersonatedUser: user
      })
      expect(conn1 instanceof DelegateConnection).toBeTruthy()
      expect(conn1.address).toBe(server2)

      const conn2 = await connectionProvider.acquireConnection({
        accessMode: WRITE,
        database: 'databaseB',
        impersonatedUser: user
      })
      expect(conn2 instanceof DelegateConnection).toBeTruthy()
      expect(conn2.address).toBe(serverB)
    }, 10000)

    it.each(usersDataSet)('should fail connection acquisition if database is not known [user=%s]', async (user) => {
      const pool = newPool()
      const connectionProvider = newRoutingConnectionProvider(
        [
          newRoutingTable('databaseA', [server1, server2], [server1], [server2])
        ],
        pool
      )

      try {
        await connectionProvider.acquireConnection({
          accessMode: WRITE,
          database: 'databaseX',
          impersonatedUser: user
        })
      } catch (error) {
        expect(error instanceof Neo4jError).toBeTruthy()
        expect(error.code).toBe(SERVICE_UNAVAILABLE)
        expect(error.message).toContain(
          'Could not perform discovery. No routing servers available.'
        )
        return
      }

      expect(false).toBeTruthy('exception expected')
    }, 10000)

    it.each(usersDataSet)('should forget read server from correct routing table on availability error [user=%s]', async (user) => {
      const pool = newPool()
      const connectionProvider = newRoutingConnectionProvider(
        [
          newRoutingTable(
            'databaseA',
            [server1, server2, server3],
            [server1, server2],
            [server3]
          ),
          newRoutingTable(
            'databaseB',
            [serverA, serverB, serverC],
            [serverA, serverB],
            [serverA, serverC]
          )
        ],
        pool
      )

      const conn1 = await connectionProvider.acquireConnection({
        accessMode: READ,
        database: 'databaseB',
        impersonatedUser: user
      })

      // when
      conn1._errorHandler.handleAndTransformError(
        newError('connection error', SERVICE_UNAVAILABLE),
        conn1.address
      )

      expectRoutingTable(
        connectionProvider,
        'databaseA',
        [server1, server2, server3],
        [server1, server2],
        [server3]
      )
      expectRoutingTable(
        connectionProvider,
        'databaseB',
        [serverA, serverB, serverC],
        [serverB],
        [serverC]
      )
    }, 10000)

    it.each(usersDataSet)('should forget write server from correct routing table on availability error [user=%s]', async (user) => {
      const pool = newPool()
      const connectionProvider = newRoutingConnectionProvider(
        [
          newRoutingTable(
            'databaseA',
            [server1, server2, server3],
            [server1, server2],
            [server3]
          ),
          newRoutingTable(
            'databaseB',
            [serverA, serverB, serverC],
            [serverA, serverB],
            [serverA, serverC]
          )
        ],
        pool
      )

      const conn1 = await connectionProvider.acquireConnection({
        accessMode: WRITE,
        database: 'databaseB',
        impersonatedUser: user
      })

      // when
      conn1._errorHandler.handleAndTransformError(
        newError('connection error', SERVICE_UNAVAILABLE),
        conn1.address
      )

      expectRoutingTable(
        connectionProvider,
        'databaseA',
        [server1, server2, server3],
        [server1, server2],
        [server3]
      )
      expectRoutingTable(
        connectionProvider,
        'databaseB',
        [serverA, serverB, serverC],
        [serverB],
        [serverC]
      )
    }, 10000)

    it.each(usersDataSet)('should forget write server from the default database routing table on availability error [user=%s]', async (user) => {
      const pool = newPool()
      const connectionProvider = newRoutingConnectionProvider(
        [
          newRoutingTable(
            'databaseA',
            [server1, server2, server3],
            [server1, server2],
            [server3]
          ),
          newRoutingTable(
            null,
            [serverA, serverB, serverC],
            [serverA, serverB],
            [serverA, serverC]
          )
        ],
        pool
      )

      const conn1 = await connectionProvider.acquireConnection({
        accessMode: WRITE,
        database: null,
        impersonatedUser: user
      })

      // when
      conn1._errorHandler.handleAndTransformError(
        newError('connection error', SERVICE_UNAVAILABLE),
        conn1.address
      )

      expectRoutingTable(
        connectionProvider,
        'databaseA',
        [server1, server2, server3],
        [server1, server2],
        [server3]
      )
      expectRoutingTable(
        connectionProvider,
        null,
        [serverA, serverB, serverC],
        [serverB],
        [serverC]
      )
    })

    it.each(usersDataSet)('should forget write server from the default database routing table on availability error when db not informed [user=%s]', async (user) => {
      const pool = newPool()
      const connectionProvider = newRoutingConnectionProvider(
        [
          newRoutingTable(
            'databaseA',
            [server1, server2, server3],
            [server1, server2],
            [server3]
          ),
          newRoutingTable(
            null,
            [serverA, serverB, serverC],
            [serverA, serverB],
            [serverA, serverC]
          )
        ],
        pool
      )

      const conn1 = await connectionProvider.acquireConnection({
        accessMode: WRITE,
        impersonatedUser: user
      })

      // when
      conn1._errorHandler.handleAndTransformError(
        newError('connection error', SERVICE_UNAVAILABLE),
        conn1.address
      )

      expectRoutingTable(
        connectionProvider,
        'databaseA',
        [server1, server2, server3],
        [server1, server2],
        [server3]
      )
      expectRoutingTable(
        connectionProvider,
        null,
        [serverA, serverB, serverC],
        [serverB],
        [serverC]
      )
    })

    it.each(usersDataSet)('should forget write server from correct routing table on write error [user=%s]', async (user) => {
      const pool = newPool()
      const connectionProvider = newRoutingConnectionProvider(
        [
          newRoutingTable(
            'databaseA',
            [server1, server2, server3],
            [server1, server2],
            [server3]
          ),
          newRoutingTable(
            'databaseB',
            [serverA, serverB, serverC],
            [serverA, serverB],
            [serverA, serverC]
          )
        ],
        pool
      )

      const conn1 = await connectionProvider.acquireConnection({
        accessMode: WRITE,
        database: 'databaseB',
        impersonatedUser: user
      })

      // when
      conn1._errorHandler.handleAndTransformError(
        newError('connection error', 'Neo.ClientError.Cluster.NotALeader'),
        conn1.address
      )

      expectRoutingTable(
        connectionProvider,
        'databaseA',
        [server1, server2, server3],
        [server1, server2],
        [server3]
      )
      expectRoutingTable(
        connectionProvider,
        'databaseB',
        [serverA, serverB, serverC],
        [serverA, serverB],
        [serverC]
      )
    }, 10000)

    it.each(usersDataSet)('should purge expired routing tables after specified duration on update [user=%s]', async (user) => {
      var originalDateNow = Date.now
      Date.now = () => 50000
      try {
        const routingTableToLoad = newRoutingTable(
          'databaseC',
          [server1, server2, server3],
          [server2, server3],
          [server1]
        )
        const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
          server1,
          [server1],
          [
            newRoutingTable(
              'databaseA',
              [server1, server2, server3],
              [server1, server2],
              [server3],
              int(Date.now() + 12000)
            ),
            newRoutingTable(
              'databaseB',
              [server1, server2, server3],
              [server1, server3],
              [server2],
              int(Date.now() + 2000)
            )
          ],
          {
            databaseC: {
              'server1:7687': routingTableToLoad
            }
          },
          null,
          4000
        )

        expectRoutingTable(
          connectionProvider,
          'databaseA',
          [server1, server2, server3],
          [server1, server2],
          [server3]
        )
        expectRoutingTable(
          connectionProvider,
          'databaseB',
          [server1, server2, server3],
          [server1, server3],
          [server2]
        )

        // make routing table for databaseA to report true for isExpiredFor(4000)
        // call.
        Date.now = () => 58000

        // force a routing table update for databaseC
        const conn1 = await connectionProvider.acquireConnection({
          accessMode: WRITE,
          database: 'databaseC',
          impersonatedUser: user
        })
        expect(conn1).not.toBeNull()
        expect(conn1.address).toBe(server1)

        // Then
        expectRoutingTable(
          connectionProvider,
          'databaseA',
          [server1, server2, server3],
          [server1, server2],
          [server3]
        )
        expectRoutingTable(
          connectionProvider,
          'databaseC',
          [server1, server2, server3],
          [server2, server3],
          [server1]
        )
        expectNoRoutingTable(connectionProvider, 'databaseB', user)
      } finally {
        Date.now = originalDateNow
      }
    }, 10000)

    it.each(usersDataSet)('should resolve the home database name for the user=%s', async (user) => {
      const pool = newPool()
      const connectionProvider = newRoutingConnectionProvider(
        [],
        pool,
        { 
          null: {
            'server-non-existing-seed-router:7687': newRoutingTableWithUser(
              {
                database: null, 
                routers: [server1, server2, server3],
                readers: [server1, server2],
                writers: [server3],
                user,
                routingTableDatabase: 'homedb'
              }
            )
          } 
        }
      )

      const connection = await connectionProvider.acquireConnection({ impersonatedUser: user, accessMode: READ })

      expect(connection.address).toEqual(server1)

      expectRoutingTable(
        connectionProvider,
        'homedb',
        [server1, server2, server3],
        [server1, server2],
        [server3]
      )
    })

    it.each(usersDataSet)('should acquire the non default database name for the user=%s with the informed name', async (user) => {
      const pool = newPool()
      const connectionProvider = newRoutingConnectionProvider(
        [],
        pool,
        { 
          'databaseA': {
            'server-non-existing-seed-router:7687': newRoutingTableWithUser(
              {
                database: 'databaseA', 
                routers: [server1, server3],
                readers: [server1],
                writers: [server3],
                user,
                routingTableDatabase: 'homedb'
              }
            )
          },
          'databaseB': {
            'server-non-existing-seed-router:7687': newRoutingTableWithUser(
              {
                database: 'homedb', 
                routers: [server2, server3],
                readers: [server2],
                writers: [server3],
                user,
                routingTableDatabase: 'homedb'
              }
            )
          } 
        }
      )

      const connection = await connectionProvider.acquireConnection({ database: 'databaseA', impersonatedUser: user, accessMode: READ })

      expect(connection.address).toEqual(server1)

      expectRoutingTable(
        connectionProvider,
        'databaseA',
        [server1, server3],
        [server1],
        [server3]
      )
    })

    it.each(usersDataSet)('should be able to acquire connection for homedb using it name', async (user) => {
      const pool = newPool()
      const connectionProvider = newRoutingConnectionProvider(
        [],
        pool,
        {
          null: {
            'server-non-existing-seed-router:7687': newRoutingTableWithUser({
              database: null,
              routers: [server1, server2, server3],
              readers: [server1, server2],
              writers: [server3],
              user,
              routingTableDatabase: 'homedb'
            })
          }
        }
      )

      await connectionProvider.acquireConnection({ accessMode: READ, impersonatedUser: user, accessMode: WRITE })
      const connection = await connectionProvider.acquireConnection({ accessMode: READ, database: 'homedb', impersonatedUser: user })

      expect(connection.address).toEqual(server1)
      expect(pool.has(server1)).toBeTruthy()
    })


    it('should be to acquire connection other users homedb using it name', async () => {
      const user1 = 'the-impostor-number-1'
      const user2 = 'the-impostor-number-2'
      const defaultUser = undefined
      const expirationTime = int(Date.now()).add(60000)

      const pool = newPool()
      const connectionProvider = newRoutingConnectionProvider(
        [],
        pool,
        {
          null: {
            'server-non-existing-seed-router:7687': [
              newRoutingTableWithUser(
                {
                  database: null,
                  routers: [server1],
                  readers: [server1],
                  writers: [server1],
                  user: user1,
                  expirationTime,
                  routingTableDatabase: 'homedb1'
                }
              ),

              newRoutingTableWithUser(
                {
                  database: null,
                  routers: [server2],
                  readers: [server2],
                  writers: [server2],
                  expirationTime,
                  user: user2,
                  routingTableDatabase: 'homedb2'
                }
              ),

              newRoutingTableWithUser(
                {
                  database: null,
                  routers: [server3],
                  readers: [server3],
                  writers: [server3],
                  expirationTime,
                  user: defaultUser,
                  routingTableDatabase: 'default-home-db'
                }
              )
            ]
          },
          "kakakaka": {}
        },
      )

      await connectionProvider.acquireConnection({ accessMode: WRITE, impersonatedUser: user2 })
      await connectionProvider.acquireConnection({ accessMode: WRITE, impersonatedUser: user1 })
      await connectionProvider.acquireConnection({ accessMode: WRITE })


      const defaultConnToHomeDb1 = await connectionProvider.acquireConnection({ accessMode: READ, database: 'homedb1' })
      expect(defaultConnToHomeDb1.address).toEqual(server1)
      expect(pool.has(server1)).toBeTruthy()

      const defaultConnToHomeDb2 = await connectionProvider.acquireConnection({ accessMode: READ, database: 'homedb2' })
      expect(defaultConnToHomeDb2.address).toEqual(server2)
      expect(pool.has(server2)).toBeTruthy()

      const user1ConnToDefaultHomeDb = await connectionProvider.acquireConnection({ accessMode: READ, database: 'default-home-db', impersonatedUser: user1 })
      expect(user1ConnToDefaultHomeDb.address).toEqual(server3)
      expect(pool.has(server3)).toBeTruthy()

      const user1ConnToHomeDb2 = await connectionProvider.acquireConnection({ accessMode: READ, database: 'homedb2', impersonatedUser: user1 })
      expect(user1ConnToHomeDb2.address).toEqual(server2)
      expect(pool.has(server2)).toBeTruthy()

      const user2ConnToDefaultHomeDb = await connectionProvider.acquireConnection({ accessMode: READ, database: 'default-home-db', impersonatedUser: user2 })
      expect(user2ConnToDefaultHomeDb.address).toEqual(server3)
      expect(pool.has(server3)).toBeTruthy()

      const user2ConnToHomeDb1 = await connectionProvider.acquireConnection({ accessMode: READ, database: 'homedb1', impersonatedUser: user2 })
      expect(user2ConnToHomeDb1.address).toEqual(server1)
      expect(pool.has(server1)).toBeTruthy()

    })


    it.each(usersDataSet)('should call onDatabaseNameResolved with the resolved db acquiring home db [user=%s]', async (user) => {
      const pool = newPool()
      const connectionProvider = newRoutingConnectionProvider(
        [],
        pool,
        {
          null: {
            'server-non-existing-seed-router:7687': newRoutingTableWithUser({
              database: null,
              routers: [server1, server2, server3],
              readers: [server1, server2],
              writers: [server3],
              user,
              routingTableDatabase: 'homedb'
            })
          }
        }
      )
      const onDatabaseNameResolved = jest.fn()

      await connectionProvider.acquireConnection({ accessMode: READ, impersonatedUser: user, onDatabaseNameResolved })

      expect(onDatabaseNameResolved).toHaveBeenCalledWith('homedb')
    })

    it.each(usersDataSet)('should call onDatabaseNameResolved with the resolved db acquiring named db [user=%s]', async (user) => {
      const pool = newPool()
      const connectionProvider = newRoutingConnectionProvider(
        [],
        pool,
        {
          'databaseA': {
            'server-non-existing-seed-router:7687': newRoutingTableWithUser({
              database: 'databaseA',
              routers: [server1, server2, server3],
              readers: [server1, server2],
              writers: [server3],
              user,
              routingTableDatabase: 'databaseB'
            })
          }
        }
      )

      const onDatabaseNameResolved = jest.fn()

      await connectionProvider.acquireConnection({ accessMode: READ, impersonatedUser: user, onDatabaseNameResolved, database: 'databaseA' })

      expect(onDatabaseNameResolved).toHaveBeenCalledWith('databaseA')
    })

  })
})

function newRoutingConnectionProvider (
  routingTables,
  pool = null,
  routerToRoutingTable = { null: {} }
) {
  const seedRouter = ServerAddress.fromUrl('server-non-existing-seed-router')
  return newRoutingConnectionProviderWithSeedRouter(
    seedRouter,
    [seedRouter],
    routingTables,
    routerToRoutingTable,
    pool
  )
}

function newRoutingConnectionProviderWithSeedRouter (
  seedRouter,
  seedRouterResolved,
  routingTables,
  routerToRoutingTable = { null: {} },
  connectionPool = null,
  routingTablePurgeDelay = null
) {
  const pool = connectionPool || newPool()
  const connectionProvider = new RoutingConnectionProvider({
    id: 0,
    address: seedRouter,
    routingContext: {},
    hostNameResolver: new SimpleHostNameResolver(),
    config: {},
    log: Logger.noOp(),
    routingTablePurgeDelay: routingTablePurgeDelay
  })
  connectionProvider._connectionPool = pool
  routingTables.forEach(r => {
    connectionProvider._routingTableRegistry.register(r)
  })
  connectionProvider._rediscovery = new FakeRediscovery(routerToRoutingTable)
  connectionProvider._hostNameResolver = new FakeDnsResolver(seedRouterResolved)
  connectionProvider._useSeedRouter = routingTables.every(
    r => r.expirationTime !== Integer.ZERO
  )
  return connectionProvider
}

function newRoutingTableWithUser ({
  database,
  routers,
  readers,
  writers,
  expirationTime = Integer.MAX_VALUE,
  routingTableDatabase,
  user
}) {
  const routingTable = newRoutingTable(database, routers, readers, writers, expirationTime, routingTableDatabase)
  routingTable.user = user
  return routingTable
}

function newRoutingTable (
  database,
  routers,
  readers,
  writers,
  expirationTime = Integer.MAX_VALUE,
  routingTableDatabase
) {
  var routingTable = new  RoutingTable({
    database: database || routingTableDatabase,
    routers,
    readers,
    writers,
    expirationTime
  })
  return routingTable
}

function setupRoutingConnectionProviderToRememberRouters (
  connectionProvider,
  routersArray
) {
  const originalFetch = connectionProvider._fetchRoutingTable.bind(
    connectionProvider
  )
  const rememberingFetch = (routerAddresses, routingTable, bookmark) => {
    routersArray.push(routerAddresses)
    return originalFetch(routerAddresses, routingTable, bookmark)
  }
  connectionProvider._fetchRoutingTable = rememberingFetch
}

function newPool () {
  return new Pool({
    create: (address, release) =>
      Promise.resolve(new FakeConnection(address, release, 'version', 4.0))
  })
}

function expectRoutingTable (
  connectionProvider,
  database,
  routers,
  readers,
  writers
) {
  const routingTable = connectionProvider._routingTableRegistry.get(database)
  expect(routingTable.database).toEqual(database)
  expect(routingTable.routers).toEqual(routers)
  expect(routingTable.readers).toEqual(readers)
  expect(routingTable.writers).toEqual(writers)
}

function expectNoRoutingTable (connectionProvider, database) {
  expect(connectionProvider._routingTableRegistry.get(database)).toBeFalsy()
}

function expectPoolToContain (pool, addresses) {
  addresses.forEach(address => {
    expect(pool.has(address)).toBeTruthy()
  })
}

function expectPoolToNotContain (pool, addresses) {
  addresses.forEach(address => {
    expect(pool.has(address)).toBeFalsy()
  })
}

class FakeConnection extends Connection {
  constructor (address, release, version, protocolVersion) {
    super(null)

    this._address = address
    this._version = version || VERSION_IN_DEV.toString()
    this._protocolVersion = protocolVersion
    this.release = release
  }

  get address () {
    return this._address
  }

  get version () {
    return this._version
  }

  protocol () {
    return {
      version: this._protocolVersion
    }
  }
}

class FakeRediscovery {
  constructor (routerToRoutingTable) {
    this._routerToRoutingTable = routerToRoutingTable
  }

  lookupRoutingTableOnRouter (ignored, database, router, user) {
    const table = this._routerToRoutingTable[database || null]
    if (table) {
      let routingTables = table[router.asKey()]
      let routingTable = routingTables
      if (routingTables instanceof Array) {
        routingTable = routingTables.find(rt => rt.user === user)
      }
      return Promise.resolve(routingTable)
    }
    return Promise.resolve(null)
  }
}

class FakeDnsResolver {
  constructor (addresses) {
    this._addresses = addresses
  }

  resolve (seedRouter) {
    return Promise.resolve(this._addresses ? this._addresses : [seedRouter])
  }
}

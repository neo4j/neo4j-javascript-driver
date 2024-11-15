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

import {
  newError,
  Neo4jError,
  error,
  Integer,
  int,
  internal,
  ServerInfo,
  staticAuthTokenManager,
  authTokenManagers
} from 'neo4j-driver-core'
import { RoutingTable } from '../../src/rediscovery/'
import SimpleHostNameResolver from '../../src/channel/browser/browser-host-name-resolver'
import RoutingConnectionProvider from '../../src/connection-provider/connection-provider-routing'
import { DelegateConnection, Connection } from '../../src/connection'
import AuthenticationProvider from '../../src/connection-provider/authentication-provider'
import { functional } from '../../src/lang'
import LivenessCheckProvider from '../../src/connection-provider/liveness-check-provider'

const {
  serverAddress: { ServerAddress },
  logger: { Logger },
  pool: { Pool }
} = internal

const { SERVICE_UNAVAILABLE, SESSION_EXPIRED } = error
const READ = 'READ'
const WRITE = 'WRITE'

describe.each([
  3,
  4.0,
  4.1,
  4.2,
  4.3,
  4.4,
  5.0,
  5.1
])('#unit RoutingConnectionProvider (PROTOCOL_VERSION=%d)', (PROTOCOL_VERSION) => {
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

    pool.acquire({}, server1)
    pool.acquire({}, server3)
    pool.acquire({}, server5)
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

  it.each(usersDataSet)('should close connection and erase authToken for connection with address when AuthorizationExpired happens [user=%s]', async (user) => {
    const pool = newPool()

    jest.spyOn(pool, 'purge')
    jest.spyOn(pool, 'apply')

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

    jest.spyOn(server2Connection, 'close')
    jest.spyOn(server3Connection, 'close')

    server3Connection.handleAndTransformError(error, server3)
    server2Connection.handleAndTransformError(error, server2)

    expect(server2Connection.close).toHaveBeenCalled()
    expect(server3Connection.close).toHaveBeenCalled()

    expect(pool.purge).not.toHaveBeenCalledWith(server3)
    expect(pool.purge).not.toHaveBeenCalledWith(server2)

    expect(pool.apply).toHaveBeenCalledTimes(2)

    const [[
      calledAddress1, appliedFunction1
    ],
    [
      calledAddress2, appliedFunction2
    ]] = pool.apply.mock.calls

    expect(calledAddress1).toBe(server3)
    let fakeConn = { authToken: 'some token' }
    appliedFunction1(fakeConn)
    expect(fakeConn.authToken).toBe(null)
    pool.apply(server3, conn => expect(conn.authToken).toBe(null))

    expect(calledAddress2).toBe(server2)
    fakeConn = { authToken: 'some token' }
    appliedFunction2(fakeConn)
    expect(fakeConn.authToken).toBe(null)
    pool.apply(server2, conn => expect(conn.authToken).toBe(null))
  })

  it.each(usersDataSet)('should call authenticationAuthProvider.handleError when AuthorizationExpired happens [user=%s]', async (user) => {
    const pool = newPool()
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

    const handleError = jest.spyOn(connectionProvider._authenticationProvider, 'handleError')

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

    expect(handleError).toBeCalledWith({ connection: server3Connection, code: 'Neo.ClientError.Security.AuthorizationExpired' })
    expect(handleError).toBeCalledWith({ connection: server2Connection, code: 'Neo.ClientError.Security.AuthorizationExpired' })
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

  it.each(usersDataSet)('should not purge connections for address when TokenExpired happens [user=%s]', async (user) => {
    const pool = newPool()

    jest.spyOn(pool, 'purge')
    jest.spyOn(pool, 'apply')

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

    expect(pool.purge).not.toHaveBeenCalledWith(server3)
    expect(pool.purge).not.toHaveBeenCalledWith(server2)
    expect(pool.apply).toHaveBeenCalledTimes(0)
    pool.apply(server2, conn => expect(conn.authToken).toBeDefined())
    pool.apply(server3, conn => expect(conn.authToken).toBeDefined())
  })

  it.each(usersDataSet)('should call authenticationAuthProvider.handleError when TokenExpired happens [user=%s]', async (user) => {
    const pool = newPool()
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

    const handleError = jest.spyOn(connectionProvider._authenticationProvider, 'handleError')

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

    expect(handleError).toBeCalledWith({ connection: server3Connection, code: 'Neo.ClientError.Security.TokenExpired' })
    expect(handleError).toBeCalledWith({ connection: server2Connection, code: 'Neo.ClientError.Security.TokenExpired' })
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

  it.each(usersDataSet)('should change error to retriable when error when TokenExpired happens and staticAuthTokenManager is not being used [user=%s]', async (user) => {
    const pool = newPool()
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

    setupAuthTokenManager(connectionProvider, authTokenManagers.bearer({ tokenProvider: () => null }))

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

    const error1 = server3Connection.handleAndTransformError(error, server3)
    const error2 = server2Connection.handleAndTransformError(error, server2)

    expect(error1.retriable).toBe(true)
    expect(error2.retriable).toBe(true)
  })

  it.each(usersDataSet)('should not change error to retriable when error when TokenExpired happens and staticAuthTokenManager is being used [user=%s]', async (user) => {
    const pool = newPool()
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

    setupAuthTokenManager(connectionProvider, staticAuthTokenManager({ authToken: null }))

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

    const error1 = server3Connection.handleAndTransformError(error, server3)
    const error2 = server2Connection.handleAndTransformError(error, server2)

    expect(error1.retriable).toBe(false)
    expect(error2.retriable).toBe(false)
  })

  it.each(usersDataSet)('should not change error to retriable when error when TokenExpired happens and authTokenManagers.basic is being used [user=%s]', async (user) => {
    const pool = newPool()
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

    setupAuthTokenManager(connectionProvider, authTokenManagers.basic({ tokenProvider: () => {} }))

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

    const error1 = server3Connection.handleAndTransformError(error, server3)
    const error2 = server2Connection.handleAndTransformError(error, server2)

    expect(error1.retriable).toBe(false)
    expect(error2.retriable).toBe(false)
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

  describe('when rediscovery.lookupRoutingTableOnRouter fails', () => {
    describe.each([
      'Neo.ClientError.Database.DatabaseNotFound',
      'Neo.ClientError.Transaction.InvalidBookmark',
      'Neo.ClientError.Transaction.InvalidBookmarkMixture',
      'Neo.ClientError.Request.Invalid',
      'Neo.ClientError.Statement.ArgumentError',
      'Neo.ClientError.Statement.TypeError',
      'Neo.ClientError.Security.Forbidden',
      'Neo.ClientError.Security.IWontTellYou'
    ])('with "%s"', errorCode => {
      it('should fail without changing the error ', async () => {
        const error = newError('something wrong', errorCode)
        const connectionProvider = newRoutingConnectionProviderWithFakeRediscovery(
          new FakeRediscovery(null, error),
          newPool()
        )

        let completed = false
        try {
          await connectionProvider.acquireConnection({ accessMode: READ })
          completed = true
        } catch (capturedError) {
          expect(capturedError).toBe(error)
        }

        expect(completed).toBe(false)
      })
    })

    describe('with "Neo.ClientError.Procedure.ProcedureNotFound"', () => {
      it('should fail with SERVICE_UNAVAILABLE and a message about the need for a causal cluster', async () => {
        const error = newError('something wrong', 'Neo.ClientError.Procedure.ProcedureNotFound')
        const connectionProvider = newRoutingConnectionProviderWithFakeRediscovery(
          new FakeRediscovery(null, error),
          newPool()
        )

        let completed = false
        try {
          await connectionProvider.acquireConnection({ accessMode: READ })
          completed = true
        } catch (capturedError) {
          expect(capturedError.code).toBe(SERVICE_UNAVAILABLE)
          expect(capturedError.message).toBe(
            'Server at server-non-existing-seed-router:7687 can\'t ' +
            'perform routing. Make sure you are connecting to a causal cluster'
          )
          // Error should be the cause of the given capturedError
          expect(capturedError).toEqual(newError(capturedError.message, capturedError.code, error))
        }

        expect(completed).toBe(false)
      })
    })

    describe.each([
      'Neo.ClientError.Security.AuthorizationExpired',
      'Neo.ClientError.MadeUp.Error'
    ])('with "%s"', errorCode => {
      it('should fail with SERVICE_UNAVAILABLE and message about no routing servers available', async () => {
        const error = newError('something wrong', errorCode)
        const connectionProvider = newRoutingConnectionProviderWithFakeRediscovery(
          new FakeRediscovery(null, error),
          newPool()
        )

        let completed = false
        try {
          await connectionProvider.acquireConnection({ accessMode: READ })
          completed = true
        } catch (capturedError) {
          expect(capturedError.code).toBe(SERVICE_UNAVAILABLE)
          expect(capturedError.message).toEqual(expect.stringContaining(
            'Could not perform discovery. ' +
            'No routing servers available. Known routing table: '
          ))

          // Error should be the cause of the given capturedError
          expect(capturedError).toEqual(newError(capturedError.message, capturedError.code, error))
        }

        expect(completed).toBe(false)
      })
    })
  })

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

    it.each(usersDataSet)('should not purge connections for address when AuthorizationExpired happens [user=%s]', async (user) => {
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

      expect(pool.purge).not.toHaveBeenCalledWith(serverA)
      expect(pool.purge).not.toHaveBeenCalledWith(server2)
    })

    it.each(usersDataSet)('should not purge change error when AuthorizationExpired happens [user=%s]', async (user) => {
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

    it.each(usersDataSet)('should not purge connections for address when TokenExpired happens [user=%s]', async (user) => {
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

      expect(pool.purge).not.toHaveBeenCalledWith(serverA)
      expect(pool.purge).not.toHaveBeenCalledWith(server2)
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
      const originalDateNow = Date.now
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
          databaseA: {
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
          databaseB: {
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

      await connectionProvider.acquireConnection({ accessMode: WRITE, impersonatedUser: user })
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
          kakakaka: {}
        }
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
          databaseA: {
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

  describe.each([
    [undefined, READ],
    [undefined, WRITE],
    ['', READ],
    ['', WRITE],
    ['databaseA', READ],
    ['databaseA', WRITE]
  ])('.verifyConnectivityAndGetServeInfo({ database: %s, accessMode: %s })', (database, accessMode) => {
    describe('when connection is available in the pool', () => {
      it('should return the server info', async () => {
        const { connectionProvider, server, protocolVersion } = setup()

        const serverInfo = await connectionProvider.verifyConnectivityAndGetServerInfo({ database, accessMode })

        expect(serverInfo).toEqual(new ServerInfo(server, protocolVersion))
      })

      it('should acquire, resetAndFlush and release connections for sever first', async () => {
        const { connectionProvider, routingTable, seenConnectionsPerAddress, pool } = setup()
        const acquireSpy = jest.spyOn(pool, 'acquire')

        await connectionProvider.verifyConnectivityAndGetServerInfo({ database, accessMode })

        const targetServers = accessMode === WRITE ? routingTable.writers : routingTable.readers
        const address = targetServers[0]
        expect(acquireSpy).toHaveBeenCalledWith({}, address)

        const connections = seenConnectionsPerAddress.get(address)

        expect(connections.length).toBe(1)
        expect(connections[0].resetAndFlush).toHaveBeenCalled()
        expect(connections[0].release).toHaveBeenCalled()
        expect(connections[0].release.mock.invocationCallOrder[0])
          .toBeGreaterThan(connections[0].resetAndFlush.mock.invocationCallOrder[0])
      })

      it('should not call resetAndFlush for newly created connections', async () => {
        const { connectionProvider, routingTable, seenConnectionsPerAddress, pool } = setup({ newConnection: true })
        const acquireSpy = jest.spyOn(pool, 'acquire')

        await connectionProvider.verifyConnectivityAndGetServerInfo({ database, accessMode })

        const targetServers = accessMode === WRITE ? routingTable.writers : routingTable.readers
        const address = targetServers[0]
        expect(acquireSpy).toHaveBeenCalledWith({}, address)

        const connections = seenConnectionsPerAddress.get(address)

        // verifying resetAndFlush was not called
        expect(connections[0].resetAndFlush).not.toHaveBeenCalled()

        // extra checks
        expect(connections.length).toBe(1)
        expect(connections[0].release).toHaveBeenCalled()
      })

      it('should not acquire, resetAndFlush and release connections for sever with the other access mode', async () => {
        const { connectionProvider, routingTable, seenConnectionsPerAddress, pool } = setup()
        const acquireSpy = jest.spyOn(pool, 'acquire')

        await connectionProvider.verifyConnectivityAndGetServerInfo({ database, accessMode })

        const targetServers = accessMode === WRITE ? routingTable.readers : routingTable.writers
        for (const address of targetServers) {
          expect(acquireSpy).not.toHaveBeenCalledWith({}, address)
          expect(seenConnectionsPerAddress.get(address)).toBeUndefined()
        }
      })

      describe('when the reset and flush fails for at least one the address', () => {
        it('should succeed with the server info ', async () => {
          const error = newError('Error')
          let i = 0
          const resetAndFlush = jest.fn(() => i++ % 2 === 0 ? Promise.reject(error) : Promise.resolve())
          const { connectionProvider, server, protocolVersion } = setup({ resetAndFlush })

          const serverInfo = await connectionProvider.verifyConnectivityAndGetServerInfo({ database, accessMode })

          expect(serverInfo).toEqual(new ServerInfo(server, protocolVersion))
        })

        it('should release the connection', async () => {
          const error = newError('Error')
          let i = 0
          const resetAndFlush = jest.fn(() => i++ % 2 === 0 ? Promise.reject(error) : Promise.resolve())
          const { connectionProvider, seenConnectionsPerAddress, routingTable } = setup({ resetAndFlush })

          try {
            await connectionProvider.verifyConnectivityAndGetServerInfo({ database, accessMode })
          } catch (e) {
          } finally {
            const targetServers = accessMode === WRITE ? routingTable.writers : routingTable.readers
            for (const address of targetServers) {
              const connections = seenConnectionsPerAddress.get(address)

              expect(connections.length).toBe(1)
              expect(connections[0].resetAndFlush).toHaveBeenCalled()
              expect(connections[0].release).toHaveBeenCalled()
            }
          }
        })

        describe('and the release fails', () => {
          it('should fails with the release error', async () => {
            const error = newError('Error')
            const releaseError = newError('Release error')
            let i = 0
            const resetAndFlush = jest.fn(() => i++ % 2 === 0 ? Promise.reject(error) : Promise.resolve())
            const releaseMock = jest.fn(() => Promise.reject(releaseError))
            const { connectionProvider } = setup({ resetAndFlush, releaseMock })

            try {
              await connectionProvider.verifyConnectivityAndGetServerInfo({ database, accessMode })
              expect().toBe('Not reached')
            } catch (e) {
              expect(e).toBe(releaseError)
            }
          })
        })
      })

      describe('when the reset and flush fails for all addresses', () => {
        it('should succeed with the server info ', async () => {
          const error = newError('Error')
          const resetAndFlush = jest.fn(() => Promise.reject(error))
          const { connectionProvider } = setup({ resetAndFlush })

          try {
            await connectionProvider.verifyConnectivityAndGetServerInfo({ database, accessMode })
            expect().toBe('Not reached')
          } catch (e) {
            expect(e).toBe(error)
          }
        })

        it('should acquire, resetAndFlush and release connections for all servers', async () => {
          const resetAndFlush = jest.fn(() => Promise.reject(error))
          const { connectionProvider, routingTable, seenConnectionsPerAddress, pool } = setup({ resetAndFlush })
          const acquireSpy = jest.spyOn(pool, 'acquire')

          try {
            await connectionProvider.verifyConnectivityAndGetServerInfo({ database, accessMode })
          } catch (e) {
            // nothing to do
          } finally {
            const targetServers = accessMode === WRITE ? routingTable.writers : routingTable.readers
            for (const address of targetServers) {
              expect(acquireSpy).toHaveBeenCalledWith({}, address)

              const connections = seenConnectionsPerAddress.get(address)

              expect(connections.length).toBe(1)
              expect(connections[0].resetAndFlush).toHaveBeenCalled()
              expect(connections[0].release).toHaveBeenCalled()
              expect(connections[0].release.mock.invocationCallOrder[0])
                .toBeGreaterThan(connections[0].resetAndFlush.mock.invocationCallOrder[0])
            }
          }
        })

        it('should release the connection', async () => {
          const error = newError('Error')
          let i = 0
          const resetAndFlush = jest.fn(() => i++ % 2 === 0 ? Promise.reject(error) : Promise.resolve())
          const { connectionProvider, seenConnectionsPerAddress, routingTable } = setup({ resetAndFlush })

          try {
            await connectionProvider.verifyConnectivityAndGetServerInfo({ database, accessMode })
          } catch (e) {
          } finally {
            const targetServers = accessMode === WRITE ? routingTable.writers : routingTable.readers
            for (const address of targetServers) {
              const connections = seenConnectionsPerAddress.get(address)

              expect(connections.length).toBe(1)
              expect(connections[0].resetAndFlush).toHaveBeenCalled()
              expect(connections[0].release).toHaveBeenCalled()
            }
          }
        })

        describe('and the release fails', () => {
          it('should fails with the release error', async () => {
            const error = newError('Error')
            const releaseError = newError('Release error')
            let i = 0
            const resetAndFlush = jest.fn(() => i++ % 2 === 0 ? Promise.reject(error) : Promise.resolve())
            const releaseMock = jest.fn(() => Promise.reject(releaseError))
            const { connectionProvider } = setup({ resetAndFlush, releaseMock })

            try {
              await connectionProvider.verifyConnectivityAndGetServerInfo({ database, accessMode })
              expect().toBe('Not reached')
            } catch (e) {
              expect(e).toBe(releaseError)
            }
          })
        })
      })

      describe('when the release for at least one the address', () => {
        it('should succeed with the server info', async () => {
          const error = newError('Error')
          let i = 0
          const releaseMock = jest.fn(() => i++ % 2 === 0 ? Promise.reject(error) : Promise.resolve())
          const { connectionProvider, server, protocolVersion } = setup({ releaseMock })

          const serverInfo = await connectionProvider.verifyConnectivityAndGetServerInfo({ database, accessMode })

          expect(serverInfo).toEqual(new ServerInfo(server, protocolVersion))
        })
      })

      describe('when the release for all address', () => {
        it('should fail with release error', async () => {
          const error = newError('Error')
          const releaseMock = jest.fn(() => Promise.reject(error))
          const { connectionProvider } = setup({ releaseMock })

          try {
            await connectionProvider.verifyConnectivityAndGetServerInfo({ database, accessMode })
            expect().toBe('Not reached')
          } catch (e) {
            expect(e).toBe(error)
          }
        })
      })

      function setup ({ resetAndFlush, releaseMock, newConnection } = {}) {
        const routingTable = newRoutingTable(
          database || null,
          [server1, server2],
          [server3, server4],
          [server5, server6]
        )
        const protocolVersion = 4.4
        const server = { address: 'localhost:123', version: 'neo4j/1234' }

        const seenConnectionsPerAddress = new Map()

        const pool = newPool({
          create: (address, release) => {
            if (!seenConnectionsPerAddress.has(address)) {
              seenConnectionsPerAddress.set(address, [])
            }
            const connection = new FakeConnection(address, release, 'version', protocolVersion, server)
            connection._firstUsage = !!newConnection
            if (resetAndFlush) {
              connection.resetAndFlush = resetAndFlush
            }
            if (releaseMock) {
              connection.release = releaseMock
            }
            seenConnectionsPerAddress.get(address).push(connection)
            return connection
          }
        })
        const connectionProvider = newRoutingConnectionProvider(
          [
            routingTable
          ],
          pool
        )
        return { connectionProvider, routingTable, seenConnectionsPerAddress, server, protocolVersion, pool }
      }
    })

    describe('when at least the one of the servers is not available', () => {
      it('should reject with acquistion timeout error', async () => {
        const routingTable = newRoutingTable(
          database || null,
          [server1, server2],
          [server3, server4],
          [server5, server6]
        )

        const pool = newPool({
          config: {
            acquisitionTimeout: 0
          }
        })

        const connectionProvider = newRoutingConnectionProvider(
          [
            routingTable
          ],
          pool
        )

        try {
          await connectionProvider.verifyConnectivityAndGetServerInfo({ database, accessMode })
          expect().toBe('not reached')
        } catch (e) {
          expect(e).toBeDefined()
        }
      })
    })

    describe('when at least the one of the connections could not be created', () => {
      it('should succeed with the server info', async () => {
        let i = 0
        const error = new Error('Connection creation error')
        const routingTable = newRoutingTable(
          database || null,
          [server1, server2],
          [server3, server4],
          [server5, server6]
        )

        const pool = newPool({
          create: (address, release) => {
            if (i++ % 2 === 0) {
              return new FakeConnection(address, release, 'version', 4.4, {})
            }
            throw error
          }
        })

        const connectionProvider = newRoutingConnectionProvider(
          [
            routingTable
          ],
          pool
        )

        const serverInfo = await connectionProvider.verifyConnectivityAndGetServerInfo({ database, accessMode })
        expect(serverInfo).toEqual(new ServerInfo({}, 4.4))
      })
    })

    describe('when there is not server available in the routing table', () => {
      it('should thown an discovery error', async () => {
        const expectedError = newError(
          `No servers available for database '${database || null}' with access mode '${accessMode || READ}'`,
          SERVICE_UNAVAILABLE
        )
        const routingTable = newRoutingTable(
          database || null,
          [server1, server2],
          accessMode === READ ? [] : [server3, server4],
          accessMode === WRITE ? [] : [server5, server6],
          Integer.MAX_SAFE_VALUE
        )

        const routingTableToRouters = {}
        const routingMap = {}
        routingMap[server0.asKey()] = routingTable
        routingMap[server1.asKey()] = routingTable
        routingMap[server2.asKey()] = routingTable
        routingTableToRouters[database || null] = routingMap

        const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
          server0,
          [server0], // seed router address resolves just to itself
          [
            routingTable
          ],
          routingTableToRouters
        )

        try {
          await connectionProvider.verifyConnectivityAndGetServerInfo({ database, accessMode })
          expect().toBe('not reached')
        } catch (error) {
          expect(error).toEqual(expectedError)
        }
      })
    })
  })

  describe('constructor', () => {
    describe('newPool', () => {
      describe('param.create', () => {
        it('should create connection', async () => {
          const { create, createChannelConnectionHook, provider } = setup()

          const connection = await create({}, server0, undefined)

          expect(createChannelConnectionHook).toHaveBeenCalledWith(server0)
          expect(provider._openConnections[connection.id]).toBe(connection)
          await expect(createChannelConnectionHook.mock.results[0].value).resolves.toBe(connection)
        })

        it('should register the release function into the connection', async () => {
          jest.useFakeTimers()
          try {
            const { create } = setup()
            const releaseResult = { property: 'some property' }
            const release = jest.fn(() => releaseResult)

            const connection = await create({}, server0, release)
            connection.idleTimestamp = -1234

            const released = connection.release()

            expect(released).toBe(releaseResult)
            expect(release).toHaveBeenCalledWith(server0, connection)
            expect(connection.idleTimestamp).toBeCloseTo(Date.now())
          } finally {
            jest.useRealTimers()
          }
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

          const { validateOnAcquire, authenticationProviderHook, livenessCheckProviderHook } = setup()

          await expect(validateOnAcquire({ auth }, connection)).resolves.toBe(true)

          expect(authenticationProviderHook.authenticate).toHaveBeenCalledWith({
            connection, auth
          })
          expect(livenessCheckProviderHook.check).toHaveBeenCalledWith(connection)
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

          const { validateOnAcquire, authenticationProviderHook, log, livenessCheckProviderHook } = setup({ authenticationProvider })

          await expect(validateOnAcquire({ auth }, connection)).resolves.toBe(false)

          expect(authenticationProviderHook.authenticate).toHaveBeenCalledWith({
            connection, auth
          })

          expect(log.debug).toHaveBeenCalledWith(
            `The connection ${connection.id} is not valid because of an error ${error.code} '${error.message}'`
          )
          expect(livenessCheckProviderHook.check).toHaveBeenCalledWith(connection)
        })

        it.each([
          true,
          false
        ])('should call authenticationProvider.authenticate with skipReAuth=%s', async (skipReAuth) => {
          const connection = new FakeConnection(server0)
          const auth = {}
          connection.creationTimestamp = Date.now()

          const { validateOnAcquire, authenticationProviderHook, livenessCheckProviderHook } = setup()

          await expect(validateOnAcquire({ auth, skipReAuth }, connection)).resolves.toBe(true)

          expect(authenticationProviderHook.authenticate).toHaveBeenCalledWith({
            connection, auth, skipReAuth
          })
          expect(livenessCheckProviderHook.check).toHaveBeenCalledWith(connection)
        })

        it('should return false when liveness checks fails', async () => {
          const connection = new FakeConnection(server0)
          connection.creationTimestamp = Date.now()
          const error = newError('#themessage', '#thecode')

          const { validateOnAcquire, authenticationProviderHook, log, livenessCheckProviderHook } = setup({
            livenessCheckProvider: () => Promise.reject(error)
          })

          await expect(validateOnAcquire({}, connection)).resolves.toBe(false)

          expect(livenessCheckProviderHook.check).toBeCalledWith(connection)
          expect(log.debug).toBeCalledWith(
            `The connection ${connection.id} is not alive because of an error ${error.code} '${error.message}'`
          )
          expect(authenticationProviderHook.authenticate).not.toHaveBeenCalled()
        })

        it('should return false when connection is closed and within the lifetime', async () => {
          const connection = new FakeConnection(server0)
          connection.creationTimestamp = Date.now()
          await connection.close()

          const { validateOnAcquire, authenticationProviderHook, livenessCheckProviderHook } = setup()

          await expect(validateOnAcquire({}, connection)).resolves.toBe(false)
          expect(authenticationProviderHook.authenticate).not.toHaveBeenCalled()
          expect(livenessCheckProviderHook.check).not.toHaveBeenCalled()
        })

        it('should return false when connection is open and out of the lifetime', async () => {
          const connection = new FakeConnection(server0)
          connection.creationTimestamp = Date.now() - 4000

          const { validateOnAcquire, authenticationProviderHook, livenessCheckProviderHook } = setup({ maxConnectionLifetime: 3000 })

          await expect(validateOnAcquire({}, connection)).resolves.toBe(false)
          expect(authenticationProviderHook.authenticate).not.toHaveBeenCalled()
          expect(livenessCheckProviderHook.check).not.toHaveBeenCalled()
        })

        it('should return false when connection is closed and out of the lifetime', async () => {
          const connection = new FakeConnection(server0)
          await connection.close()
          connection.creationTimestamp = Date.now() - 4000

          const { validateOnAcquire, authenticationProviderHook, livenessCheckProviderHook } = setup({ maxConnectionLifetime: 3000 })

          await expect(validateOnAcquire({}, connection)).resolves.toBe(false)
          expect(authenticationProviderHook.authenticate).not.toHaveBeenCalled()
          expect(livenessCheckProviderHook.check).not.toHaveBeenCalled()
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

      function setup ({ createConnection, authenticationProvider, maxConnectionLifetime, livenessCheckProvider } = {}) {
        const newPool = jest.fn((...args) => new Pool(...args))
        const log = new Logger('debug', () => undefined)
        jest.spyOn(log, 'debug')
        const createChannelConnectionHook = createConnection || jest.fn(async (address) => new FakeConnection(address))
        const authenticationProviderHook = new AuthenticationProvider({})
        const livenessCheckProviderHook = new LivenessCheckProvider({})
        jest.spyOn(authenticationProviderHook, 'authenticate')
          .mockImplementation(authenticationProvider || jest.fn(({ connection }) => Promise.resolve(connection)))
        jest.spyOn(livenessCheckProviderHook, 'check')
          .mockImplementation(livenessCheckProvider || jest.fn(() => Promise.resolve(true)))
        const provider = new RoutingConnectionProvider({
          newPool,
          config: {
            maxConnectionLifetime: maxConnectionLifetime || 1000
          },
          address: server01,
          log
        })
        provider._createChannelConnection = createChannelConnectionHook
        provider._authenticationProvider = authenticationProviderHook
        provider._livenessCheckProvider = livenessCheckProviderHook
        return {
          provider,
          ...newPool.mock.calls[0][0],
          createChannelConnectionHook,
          authenticationProviderHook,
          livenessCheckProviderHook,
          log
        }
      }
    })
  })

  describe('user-switching', () => {
    describe('when does not support re-auth', () => {
      describe.each([
        ['new connection', { other: 'auth' }, { other: 'auth' }, true],
        ['old connection', { some: 'auth' }, { other: 'token' }, false]
      ])('%s', (_, connAuth, acquireAuth, isStickyConn) => {
        it('should raise and error when try switch user on acquire', async () => {
          const address = ServerAddress.fromUrl('localhost:123')
          const pool = newPool()
          const connection = new FakeConnection(address, () => { }, undefined, PROTOCOL_VERSION, null, connAuth)
          const poolAcquire = jest.spyOn(pool, 'acquire').mockResolvedValue(connection)
          const connectionProvider = newRoutingConnectionProvider([
            newRoutingTable(
              null,
              [server1, server2],
              [server3, server2],
              [server2, server4]
            )
          ],
          pool
          )
          const auth = acquireAuth

          const error = await connectionProvider
            .acquireConnection({
              accessMode: 'READ',
              database: '',
              auth
            })
            .catch(functional.identity)

          expect(error).toEqual(newError('Driver is connected to a database that does not support user switch.'))
          expect(poolAcquire).toHaveBeenCalledWith({ auth }, server3)
          expect(connection.release).toHaveBeenCalled()
          expect(connection._sticky).toEqual(isStickyConn)
        })

        it('should raise and error when try switch user on acquire [expired rt]', async () => {
          const address = ServerAddress.fromUrl('localhost:123')
          const pool = newPool()
          const connection = new FakeConnection(address, () => { }, undefined, PROTOCOL_VERSION, null, connAuth)
          const poolAcquire = jest.spyOn(pool, 'acquire').mockResolvedValue(connection)
          const connectionProvider = newRoutingConnectionProvider([
            newRoutingTable(
              'dba',
              [server1, server2],
              [server3, server2],
              [server2, server4],
              int(0) // expired
            )
          ],
          pool,
          {
            dba: newRoutingTable(
              'dba',
              [server1, server2],
              [server3, server2],
              [server2, server4]
            )
          }
          )
          connectionProvider._useSeedRouter = false

          const auth = acquireAuth

          const error = await connectionProvider
            .acquireConnection({
              accessMode: 'READ',
              database: 'dba',
              auth
            })
            .catch(functional.identity)

          expect(error).toEqual(newError('Driver is connected to a database that does not support user switch.'))
          expect(poolAcquire).toHaveBeenCalledWith({ auth }, server1)
          expect(connection.release).toHaveBeenCalled()
          expect(connection._sticky).toEqual(isStickyConn)
        })

        it('should raise and error when try switch user on acquire [expired rt and userSeedRouter]', async () => {
          const address = ServerAddress.fromUrl('localhost:123')
          const pool = newPool()
          const connection = new FakeConnection(address, () => { }, undefined, PROTOCOL_VERSION, null, connAuth)
          const poolAcquire = jest.spyOn(pool, 'acquire').mockResolvedValue(connection)
          const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
            server0,
            [server0],
            [
              newRoutingTable(
                'dba',
                [server1, server2],
                [server3, server2],
                [server2, server4],
                int(0) // expired
              )
            ],
            {
              dba: newRoutingTable(
                'dba',
                [server1, server2],
                [server3, server2],
                [server2, server4]
              )
            },
            pool
          )

          const auth = acquireAuth

          const error = await connectionProvider
            .acquireConnection({
              accessMode: 'READ',
              database: 'dba',
              auth
            })
            .catch(functional.identity)

          expect(error).toEqual(newError('Driver is connected to a database that does not support user switch.'))
          expect(poolAcquire).toHaveBeenCalledWith({ auth }, server0)
          expect(connection.release).toHaveBeenCalled()
          expect(connection._sticky).toEqual(isStickyConn)
        })

        it('should raise and error when try switch user on acquire [firstCall and userSeedRouter]', async () => {
          const address = ServerAddress.fromUrl('localhost:123')
          const pool = newPool()
          const connection = new FakeConnection(address, () => { }, undefined, PROTOCOL_VERSION, null, connAuth)
          const poolAcquire = jest.spyOn(pool, 'acquire').mockResolvedValue(connection)
          const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
            server0,
            [server0],
            [],
            {},
            pool
          )

          const auth = acquireAuth

          const error = await connectionProvider
            .acquireConnection({
              accessMode: 'READ',
              database: 'dba',
              auth
            })
            .catch(functional.identity)

          expect(error).toEqual(newError('Driver is connected to a database that does not support user switch.'))
          expect(poolAcquire).toHaveBeenCalledWith({ auth }, server0)
          expect(connection.release).toHaveBeenCalled()
          expect(connection._sticky).toEqual(isStickyConn)
        })
      })
    })

    describe('when does it support re-auth', () => {
      const connAuth = { myAuth: 'auth' }
      const acquireAuth = connAuth

      it('should return connection when try switch user on acquire', async () => {
        const address = ServerAddress.fromUrl('localhost:123')
        const pool = newPool()
        const connection = new FakeConnection(address, () => { }, undefined, PROTOCOL_VERSION, null, connAuth, { supportsReAuth: true })
        jest.spyOn(pool, 'acquire').mockResolvedValue(connection)
        const connectionProvider = newRoutingConnectionProvider([
          newRoutingTable(
            null,
            [server1, server2],
            [server3, server2],
            [server2, server4]
          )
        ],
        pool
        )
        const auth = acquireAuth

        const acquiredConnection = await connectionProvider
          .acquireConnection({
            accessMode: 'READ',
            database: '',
            auth
          })

        expect(acquiredConnection).toBe(connection)
        expect(acquiredConnection._sticky).toEqual(false)
      })

      it('should return connection when try switch user on acquire [expired rt]', async () => {
        const address = ServerAddress.fromUrl('localhost:123')
        const pool = newPool()
        const connection = new FakeConnection(address, () => { }, undefined, PROTOCOL_VERSION, null, connAuth, { supportsReAuth: true })
        jest.spyOn(pool, 'acquire').mockResolvedValue(connection)
        const connectionProvider = newRoutingConnectionProvider([
          newRoutingTable(
            'dba',
            [server1, server2],
            [server3, server2],
            [server2, server4],
            int(0) // expired
          )
        ],
        pool,
        {
          dba: {
            [server1.asHostPort()]: newRoutingTable(
              'dba',
              [server1, server2],
              [server3, server2],
              [server2, server4]
            )
          }
        }
        )
        connectionProvider._useSeedRouter = false

        const auth = acquireAuth

        const acquiredConnection = await connectionProvider
          .acquireConnection({
            accessMode: 'READ',
            database: 'dba',
            auth
          })

        expect(acquiredConnection).toBe(connection)
        expect(acquiredConnection._sticky).toEqual(false)
      })

      it('should return connection when try switch user on acquire [expired rt and userSeedRouter]', async () => {
        const address = ServerAddress.fromUrl('localhost:123')
        const pool = newPool()
        const connection = new FakeConnection(address, () => { }, undefined, PROTOCOL_VERSION, null, connAuth, { supportsReAuth: true })
        jest.spyOn(pool, 'acquire').mockResolvedValue(connection)
        const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
          server0,
          [server0],
          [
            newRoutingTable(
              'dba',
              [server1, server2],
              [server3, server2],
              [server2, server4],
              int(0) // expired
            )
          ],
          {
            dba: {
              [server0.asHostPort()]: newRoutingTable(
                'dba',
                [server1, server2],
                [server3, server2],
                [server2, server4]
              )
            }
          },
          pool
        )

        const auth = acquireAuth

        const acquiredConnection = await connectionProvider
          .acquireConnection({
            accessMode: 'READ',
            database: 'dba',
            auth
          })

        expect(acquiredConnection).toBe(connection)
        expect(acquiredConnection._sticky).toEqual(false)
      })

      it('should not delegated connection when try switch user on acquire [firstCall and userSeedRouter]', async () => {
        const address = ServerAddress.fromUrl('localhost:123')
        const pool = newPool()
        const connection = new FakeConnection(address, () => { }, undefined, PROTOCOL_VERSION, null, connAuth, { supportsReAuth: true })
        jest.spyOn(pool, 'acquire').mockResolvedValue(connection)
        const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
          server0,
          [server0],
          [],
          {
            dba: {
              [server0.asHostPort()]: newRoutingTable(
                'dba',
                [server1, server2],
                [server3, server2],
                [server2, server4]
              )
            }
          },
          pool
        )

        const auth = acquireAuth

        const acquiredConnection = await connectionProvider
          .acquireConnection({
            accessMode: 'READ',
            database: 'dba',
            auth
          })

        expect(acquiredConnection).toBe(connection)
        expect(acquiredConnection._sticky).toEqual(false)
      })
    })
  })

  function newPool ({ create, config } = {}) {
    const _create = (address, release) => {
      if (create) {
        try {
          return Promise.resolve(create(address, release))
        } catch (e) {
          return Promise.reject(e)
        }
      }
      return Promise.resolve(new FakeConnection(address, release, 'version', PROTOCOL_VERSION, undefined, {
        scheme: 'bearer',
        credentials: 'token'
      }))
    }
    return new Pool({
      config,
      create: (_, address, release) => _create(address, release)
    })
  }

  function newRoutingConnectionProviderWithSeedRouter (
    seedRouter,
    seedRouterResolved,
    routingTables,
    routerToRoutingTable = { null: {} },
    connectionPool = null,
    routingTablePurgeDelay = null,
    fakeRediscovery = null
  ) {
    const pool = connectionPool || newPool()
    const connectionProvider = new RoutingConnectionProvider({
      id: 0,
      address: seedRouter,
      routingContext: {},
      hostNameResolver: new SimpleHostNameResolver(),
      config: {},
      log: Logger.noOp(),
      routingTablePurgeDelay
    })
    connectionProvider._connectionPool = pool
    routingTables.forEach(r => {
      connectionProvider._routingTableRegistry.register(r)
    })
    connectionProvider._rediscovery =
      fakeRediscovery || new FakeRediscovery(routerToRoutingTable)
    connectionProvider._hostNameResolver = new FakeDnsResolver(seedRouterResolved)
    connectionProvider._useSeedRouter = routingTables.every(
      r => r.expirationTime !== Integer.ZERO
    )
    return connectionProvider
  }

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

  function newRoutingConnectionProviderWithFakeRediscovery (
    fakeRediscovery,
    pool = null,
    routerToRoutingTable = { null: {} }
  ) {
    const seedRouter = ServerAddress.fromUrl('server-non-existing-seed-router')
    return newRoutingConnectionProviderWithSeedRouter(
      seedRouter,
      [seedRouter],
      [],
      routerToRoutingTable,
      pool,
      null,
      fakeRediscovery
    )
  }
})

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
  const routingTable = new RoutingTable({
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
  const rememberingFetch = (routerAddresses, routingTable, bookmarks) => {
    routersArray.push(routerAddresses)
    return originalFetch(routerAddresses, routingTable, bookmarks)
  }
  connectionProvider._fetchRoutingTable = rememberingFetch
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
  constructor (address, release, version, protocolVersion, server, authToken, { supportsReAuth } = {}) {
    super(null)

    this._address = address
    this._version = version
    this._protocolVersion = protocolVersion
    this.release = release
    this.release = jest.fn(() => release(address, this))
    this.resetAndFlush = jest.fn(() => Promise.resolve())
    this._server = server
    this._authToken = authToken
    this._id = 1
    this._closed = false
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

  get version () {
    return this._version
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

  set creationTimestamp (value) {
    this._creationTimestamp = value
  }

  get creationTimestamp () {
    return this._creationTimestamp
  }

  set idleTimestamp (value) {
    this._idleTimestamp = value
  }

  get idleTimestamp () {
    return this._idleTimestamp
  }

  isOpen () {
    return !this._closed
  }

  protocol () {
    return {
      version: this._protocolVersion,
      isLastMessageLogon: () => this._firstUsage
    }
  }
}

class FakeRediscovery {
  constructor (routerToRoutingTable, error) {
    this._routerToRoutingTable = routerToRoutingTable || {}
    this._error = error
  }

  lookupRoutingTableOnRouter (ignored, database, router, user) {
    if (this._error) {
      return Promise.reject(this._error)
    }
    const table = this._routerToRoutingTable[database || null]
    if (table) {
      const routingTables = table[router.asKey()]
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

function setupAuthTokenManager (provider, authTokenManager) {
  provider._authenticationProvider._authTokenManager = authTokenManager
}

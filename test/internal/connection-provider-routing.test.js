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

import { READ, WRITE } from '../../src/driver'
import Integer, { int } from '../../src/integer'
import { newError, SERVICE_UNAVAILABLE, SESSION_EXPIRED } from '../../src/error'
import RoutingTable from '../../src/internal/routing-table'
import Pool from '../../src/internal/pool'
import Logger from '../../src/internal/logger'
import SimpleHostNameResolver from '../../src/internal/browser/browser-host-name-resolver'
import ServerAddress from '../../src/internal/server-address'
import RoutingConnectionProvider from '../../src/internal/connection-provider-routing'
import { VERSION_IN_DEV } from '../../src/internal/server-version'
import Connection from '../../src/internal/connection'
import DelegateConnection from '../../src/internal/connection-delegate'
import { Neo4jError } from '../../src'

describe('#unit RoutingConnectionProvider', () => {
  let originalTimeout
  beforeEach(function () {
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000
  })

  afterEach(function () {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout
  })

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

  it('can forget address', () => {
    const connectionProvider = newRoutingConnectionProvider([
      newRoutingTable(
        '',
        [server1, server2],
        [server3, server2],
        [server2, server4]
      )
    ])

    connectionProvider.forget(server2)

    expectRoutingTable(
      connectionProvider,
      '',
      [server1, server2],
      [server3],
      [server4]
    )
  })

  it('can not forget unknown address', () => {
    const connectionProvider = newRoutingConnectionProvider([
      newRoutingTable(
        '',
        [server1, server2],
        [server3, server4],
        [server5, server6]
      )
    ])

    connectionProvider.forget(server42)

    expectRoutingTable(
      connectionProvider,
      '',
      [server1, server2],
      [server3, server4],
      [server5, server6]
    )
  })

  it('purges connections when address is forgotten', () => {
    const pool = newPool()

    pool.acquire(server1)
    pool.acquire(server3)
    pool.acquire(server5)
    expectPoolToContain(pool, [server1, server3, server5])

    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          '',
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
  })

  it('can forget writer address', () => {
    const connectionProvider = newRoutingConnectionProvider([
      newRoutingTable(
        '',
        [server1, server2],
        [server3, server2],
        [server2, server4]
      )
    ])

    connectionProvider.forgetWriter(server2)

    expectRoutingTable(
      connectionProvider,
      '',
      [server1, server2],
      [server3, server2],
      [server4]
    )
  })

  it('can not forget unknown writer address', () => {
    const connectionProvider = newRoutingConnectionProvider([
      newRoutingTable(
        '',
        [server1, server2],
        [server3, server4],
        [server5, server6]
      )
    ])

    connectionProvider.forgetWriter(server42)

    expectRoutingTable(
      connectionProvider,
      '',
      [server1, server2],
      [server3, server4],
      [server5, server6]
    )
  })

  it('acquires connection and returns a DelegateConnection', async () => {
    const pool = newPool()
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          '',
          [server1, server2],
          [server3, server4],
          [server5, server6]
        )
      ],
      pool
    )

    const conn1 = await connectionProvider.acquireConnection(READ, '')
    expect(conn1 instanceof DelegateConnection).toBeTruthy()

    const conn2 = await connectionProvider.acquireConnection(WRITE, '')
    expect(conn2 instanceof DelegateConnection).toBeTruthy()
  })

  it('acquires read connection with up-to-date routing table', done => {
    const pool = newPool()
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          '',
          [server1, server2],
          [server3, server4],
          [server5, server6]
        )
      ],
      pool
    )

    connectionProvider.acquireConnection(READ, '').then(connection => {
      expect(connection.address).toEqual(server3)
      expect(pool.has(server3)).toBeTruthy()

      connectionProvider.acquireConnection(READ, '').then(connection => {
        expect(connection.address).toEqual(server4)
        expect(pool.has(server4)).toBeTruthy()

        done()
      })
    })
  })

  it('acquires write connection with up-to-date routing table', done => {
    const pool = newPool()
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          '',
          [server1, server2],
          [server3, server4],
          [server5, server6]
        )
      ],
      pool
    )

    connectionProvider.acquireConnection(WRITE, '').then(connection => {
      expect(connection.address).toEqual(server5)
      expect(pool.has(server5)).toBeTruthy()

      connectionProvider.acquireConnection(WRITE, '').then(connection => {
        expect(connection.address).toEqual(server6)
        expect(pool.has(server6)).toBeTruthy()

        done()
      })
    })
  })

  it('throws for illegal access mode', done => {
    const connectionProvider = newRoutingConnectionProvider([
      newRoutingTable(
        '',
        [server1, server2],
        [server3, server4],
        [server5, server6]
      )
    ])

    connectionProvider.acquireConnection('WRONG', '').catch(error => {
      expect(error.message).toEqual('Illegal mode WRONG')
      done()
    })
  })

  it('refreshes stale routing table to get read connection', done => {
    const pool = newPool()
    const updatedRoutingTable = newRoutingTable(
      '',
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    )
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          '',
          [server1, server2],
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      pool,
      { '': { 'server1:7687': updatedRoutingTable } }
    )

    connectionProvider.acquireConnection(READ, '').then(connection => {
      expect(connection.address).toEqual(serverC)
      expect(pool.has(serverC)).toBeTruthy()

      connectionProvider.acquireConnection(READ, '').then(connection => {
        expect(connection.address).toEqual(serverD)
        expect(pool.has(serverD)).toBeTruthy()

        done()
      })
    })
  })

  it('refreshes stale routing table to get write connection', done => {
    const pool = newPool()
    const updatedRoutingTable = newRoutingTable(
      '',
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    )
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          '',
          [server1, server2],
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      pool,
      { '': { 'server1:7687': updatedRoutingTable } }
    )

    connectionProvider.acquireConnection(WRITE, '').then(connection => {
      expect(connection.address).toEqual(serverE)
      expect(pool.has(serverE)).toBeTruthy()

      connectionProvider.acquireConnection(WRITE, '').then(connection => {
        expect(connection.address).toEqual(serverF)
        expect(pool.has(serverF)).toBeTruthy()

        done()
      })
    })
  })

  it('refreshes stale routing table to get read connection when one router fails', done => {
    const pool = newPool()
    const updatedRoutingTable = newRoutingTable(
      '',
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    )
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          '',
          [server1, server2],
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      pool,
      {
        '': {
          'server1:7687': null, // returns no routing table
          'server2:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider.acquireConnection(READ, '').then(connection => {
      expect(connection.address).toEqual(serverC)
      expect(pool.has(serverC)).toBeTruthy()

      connectionProvider.acquireConnection(READ, '').then(connection => {
        expect(connection.address).toEqual(serverD)
        expect(pool.has(serverD)).toBeTruthy()

        done()
      })
    })
  })

  it('refreshes stale routing table to get write connection when one router fails', done => {
    const pool = newPool()
    const updatedRoutingTable = newRoutingTable(
      '',
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    )
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          '',
          [server1, server2],
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      pool,
      {
        '': {
          'server1:7687': null, // returns no routing table
          'server2:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider.acquireConnection(WRITE, '').then(connection => {
      expect(connection.address).toEqual(serverE)
      expect(pool.has(serverE)).toBeTruthy()

      connectionProvider.acquireConnection(WRITE, '').then(connection => {
        expect(connection.address).toEqual(serverF)
        expect(pool.has(serverF)).toBeTruthy()

        done()
      })
    })
  })

  it('refreshes routing table without readers to get read connection', done => {
    const pool = newPool()
    const updatedRoutingTable = newRoutingTable(
      '',
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    )
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          '',
          [server1, server2],
          [], // no readers
          [server3, server4],
          Integer.MAX_VALUE
        )
      ],
      pool,
      {
        '': {
          'server1:7687': null, // returns no routing table
          'server2:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider.acquireConnection(READ, '').then(connection => {
      expect(connection.address).toEqual(serverC)
      expect(pool.has(serverC)).toBeTruthy()

      connectionProvider.acquireConnection(READ, '').then(connection => {
        expect(connection.address).toEqual(serverD)
        expect(pool.has(serverD)).toBeTruthy()

        done()
      })
    })
  })

  it('refreshes routing table without writers to get write connection', done => {
    const pool = newPool()
    const updatedRoutingTable = newRoutingTable(
      '',
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    )
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          '',
          [server1, server2],
          [server3, server4],
          [], // no writers
          int(0) // expired routing table
        )
      ],
      pool,
      {
        '': {
          'server1:7687': null, // returns no routing table
          'server2:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider.acquireConnection(WRITE, '').then(connection => {
      expect(connection.address).toEqual(serverE)
      expect(pool.has(serverE)).toBeTruthy()

      connectionProvider.acquireConnection(WRITE, '').then(connection => {
        expect(connection.address).toEqual(serverF)
        expect(pool.has(serverF)).toBeTruthy()

        done()
      })
    })
  })

  it('throws when all routers return nothing while getting read connection', done => {
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          '',
          [server1, server2],
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      newPool(),
      {
        '': {
          'server1:7687': null, // returns no routing table
          'server2:7687': null // returns no routing table
        }
      }
    )

    connectionProvider.acquireConnection(READ, '').catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE)
      done()
    })
  })

  it('throws when all routers return nothing while getting write connection', done => {
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          '',
          [server1, server2],
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      newPool(),
      {
        '': {
          'server1:7687': null, // returns no routing table
          'server2:7687': null // returns no routing table
        }
      }
    )

    connectionProvider.acquireConnection(WRITE, '').catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE)
      done()
    })
  })

  it('throws when all routers return routing tables without readers while getting read connection', done => {
    const updatedRoutingTable = newRoutingTable(
      '',
      [serverA, serverB],
      [], // no readers - table can't satisfy connection requirement
      [serverC, serverD]
    )
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          '',
          [server1, server2],
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      newPool(),
      {
        '': {
          'server1:7687': updatedRoutingTable,
          'server2:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider.acquireConnection(READ, '').catch(error => {
      expect(error.code).toEqual(SESSION_EXPIRED)
      done()
    })
  })

  it('throws when all routers return routing tables without writers while getting write connection', done => {
    const updatedRoutingTable = newRoutingTable(
      '',
      [serverA, serverB],
      [serverC, serverD],
      [] // no writers - table can't satisfy connection requirement
    )
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          '',
          [server1, server2],
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      newPool(),
      {
        '': {
          'server1:7687': updatedRoutingTable,
          'server2:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider.acquireConnection(WRITE, '').catch(error => {
      expect(error.code).toEqual(SESSION_EXPIRED)
      done()
    })
  })

  it('throws when stale routing table without routers while getting read connection', done => {
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          '',
          [], // no routers
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      newPool()
    )

    connectionProvider.acquireConnection(READ, '').catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE)
      done()
    })
  })

  it('throws when stale routing table without routers while getting write connection', done => {
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          '',
          [], // no routers
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      newPool()
    )

    connectionProvider.acquireConnection(WRITE, '').catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE)
      done()
    })
  })

  it('updates routing table after refresh', done => {
    const pool = newPool()
    const updatedRoutingTable = newRoutingTable(
      '',
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    )
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          '',
          [server1, server2],
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      pool,
      {
        '': {
          'server1:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider.acquireConnection(READ, '').then(() => {
      expectRoutingTable(
        connectionProvider,
        '',
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
  })

  it('forgets all routers when they fail while acquiring read connection', done => {
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          '',
          [server1, server2, server3],
          [server4, server5],
          [server6, server7],
          int(0) // expired routing table
        )
      ],
      newPool()
    )

    connectionProvider.acquireConnection(READ, '').catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE)
      expectRoutingTable(
        connectionProvider,
        '',
        [],
        [server4, server5],
        [server6, server7]
      )
      done()
    })
  })

  it('forgets all routers when they fail while acquiring write connection', done => {
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          '',
          [server1, server2, server3],
          [server4, server5],
          [server6, server7],
          int(0) // expired routing table
        )
      ],
      newPool()
    )

    connectionProvider.acquireConnection(WRITE, '').catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE)
      expectRoutingTable(
        connectionProvider,
        '',
        [],
        [server4, server5],
        [server6, server7]
      )
      done()
    })
  })

  it('uses seed router address when all existing routers fail', done => {
    const updatedRoutingTable = newRoutingTable(
      '',
      [serverA, serverB, serverC],
      [serverD, serverE],
      [serverF, serverG]
    )

    const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
      server0,
      [server0], // seed router address resolves just to itself
      [
        newRoutingTable(
          '',
          [server1, server2, server3],
          [server4, server5],
          [server6, server7],
          int(0) // expired routing table
        )
      ],
      {
        '': {
          'server1:7687': null, // returns no routing table
          'server2:7687': null, // returns no routing table
          'server3:7687': null, // returns no routing table
          'server0:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider.acquireConnection(READ, '').then(connection1 => {
      expect(connection1.address).toEqual(serverD)

      connectionProvider.acquireConnection(WRITE, '').then(connection2 => {
        expect(connection2.address).toEqual(serverF)

        expectRoutingTable(
          connectionProvider,
          '',
          [serverA, serverB, serverC],
          [serverD, serverE],
          [serverF, serverG]
        )
        done()
      })
    })
  })

  it('uses resolved seed router address when all existing routers fail', done => {
    const updatedRoutingTable = newRoutingTable(
      '',
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    )

    const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
      server0,
      [server01], // seed router address resolves to a different one
      [
        newRoutingTable(
          '',
          [server1, server2, server3],
          [server4, server5],
          [server6, server7],
          int(0) // expired routing table
        )
      ],
      {
        '': {
          'server1:7687': null, // returns no routing table
          'server2:7687': null, // returns no routing table
          'server3:7687': null, // returns no routing table
          'server01:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider.acquireConnection(WRITE, '').then(connection1 => {
      expect(connection1.address).toEqual(serverE)

      connectionProvider.acquireConnection(READ, '').then(connection2 => {
        expect(connection2.address).toEqual(serverC)

        expectRoutingTable(
          connectionProvider,
          '',
          [serverA, serverB],
          [serverC, serverD],
          [serverE, serverF]
        )
        done()
      })
    })
  })

  it('uses resolved seed router address that returns correct routing table when all existing routers fail', done => {
    const updatedRoutingTable = newRoutingTable(
      '',
      [serverA, serverB],
      [serverC],
      [serverD, serverE]
    )

    const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
      server0,
      [server01, server02, server03], // seed router address resolves to 3 different addresses
      [
        newRoutingTable(
          '',
          [server1],
          [server2],
          [server3],
          int(0) // expired routing table
        )
      ],
      {
        '': {
          'server1:7687': null, // returns no routing table
          'server01:7687': null, // returns no routing table
          'server02:7687': null, // returns no routing table
          'server03:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider.acquireConnection(WRITE, '').then(connection1 => {
      expect(connection1.address).toEqual(serverD)

      connectionProvider.acquireConnection(WRITE, '').then(connection2 => {
        expect(connection2.address).toEqual(serverE)

        expectRoutingTable(
          connectionProvider,
          '',
          [serverA, serverB],
          [serverC],
          [serverD, serverE]
        )
        done()
      })
    })
  })

  it('fails when both existing routers and seed router fail to return a routing table', done => {
    const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
      server0,
      [server0], // seed router address resolves just to itself
      [
        newRoutingTable(
          '',
          [server1, server2, server3],
          [server4, server5],
          [server6],
          int(0) // expired routing table
        )
      ],
      {
        '': {
          'server1:7687': null, // returns no routing table
          'server2:7687': null, // returns no routing table
          'server3:7687': null, // returns no routing table
          'server0:7687': null // returns no routing table
        }
      }
    )

    connectionProvider.acquireConnection(READ, '').catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE)

      expectRoutingTable(
        connectionProvider,
        '',
        [], // all routers were forgotten because they failed
        [server4, server5],
        [server6]
      )

      connectionProvider.acquireConnection(WRITE, '').catch(error => {
        expect(error.code).toEqual(SERVICE_UNAVAILABLE)

        expectRoutingTable(
          connectionProvider,
          '',
          [], // all routers were forgotten because they failed
          [server4, server5],
          [server6]
        )

        done()
      })
    })
  })

  it('fails when both existing routers and resolved seed router fail to return a routing table', done => {
    const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
      server0,
      [server01], // seed router address resolves to a different one
      [
        newRoutingTable(
          '',
          [server1, server2],
          [server3],
          [server4],
          int(0) // expired routing table
        )
      ],
      {
        '': {
          'server1:7687': null, // returns no routing table
          'server2:7687': null, // returns no routing table
          'server01:7687': null // returns no routing table
        }
      }
    )

    connectionProvider.acquireConnection(WRITE, '').catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE)

      expectRoutingTable(
        connectionProvider,
        '',
        [], // all routers were forgotten because they failed
        [server3],
        [server4]
      )

      connectionProvider.acquireConnection(READ, '').catch(error => {
        expect(error.code).toEqual(SERVICE_UNAVAILABLE)

        expectRoutingTable(
          connectionProvider,
          '',
          [], // all routers were forgotten because they failed
          [server3],
          [server4]
        )

        done()
      })
    })
  })

  it('fails when both existing routers and all resolved seed routers fail to return a routing table', done => {
    const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
      server0,
      [server02, server01], // seed router address resolves to 2 different addresses
      [
        newRoutingTable(
          '',
          [server1, server2, server3],
          [server4],
          [server5],
          int(0) // expired routing table
        )
      ],
      {
        '': {
          'server1:7687': null, // returns no routing table
          'server2:7687': null, // returns no routing table
          'server3:7687': null, // returns no routing table
          'server01:7687': null, // returns no routing table
          'server02:7687': null // returns no routing table
        }
      }
    )

    connectionProvider.acquireConnection(READ, '').catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE)

      expectRoutingTable(
        connectionProvider,
        '',
        [], // all known seed servers failed to return routing tables and were forgotten
        [server4],
        [server5]
      )

      connectionProvider.acquireConnection(WRITE, '').catch(error => {
        expect(error.code).toEqual(SERVICE_UNAVAILABLE)

        expectRoutingTable(
          connectionProvider,
          '',
          [], // all known seed servers failed to return routing tables and were forgotten
          [server4],
          [server5]
        )

        done()
      })
    })
  })

  it('uses seed router when no existing routers', done => {
    const updatedRoutingTable = newRoutingTable(
      '',
      [serverA, serverB],
      [serverC],
      [serverD]
    )

    const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
      server0,
      [server0], // seed router address resolves just to itself
      [
        newRoutingTable(
          '',
          [], // no routers in the known routing table
          [server1, server2],
          [server3],
          Integer.MAX_VALUE // not expired
        )
      ],
      {
        '': {
          'server0:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider.acquireConnection(WRITE, '').then(connection1 => {
      expect(connection1.address).toEqual(serverD)

      connectionProvider.acquireConnection(READ, '').then(connection2 => {
        expect(connection2.address).toEqual(serverC)

        expectRoutingTable(
          connectionProvider,
          '',
          [serverA, serverB],
          [serverC],
          [serverD]
        )
        done()
      })
    })
  })

  it('uses resolved seed router when no existing routers', done => {
    const updatedRoutingTable = newRoutingTable(
      '',
      [serverA, serverB],
      [serverC, serverD],
      [serverF, serverE]
    )

    const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
      server0,
      [server01], // seed router address resolves to a different one
      [
        newRoutingTable(
          '',
          [], // no routers in the known routing table
          [server1, server2],
          [server3, server4],
          Integer.MAX_VALUE // not expired
        )
      ],
      {
        '': {
          'server01:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider.acquireConnection(READ, '').then(connection1 => {
      expect(connection1.address).toEqual(serverC)

      connectionProvider.acquireConnection(WRITE, '').then(connection2 => {
        expect(connection2.address).toEqual(serverF)

        expectRoutingTable(
          connectionProvider,
          '',
          [serverA, serverB],
          [serverC, serverD],
          [serverF, serverE]
        )
        done()
      })
    })
  })

  it('uses resolved seed router that returns routing table when no existing routers exist', done => {
    const updatedRoutingTable = newRoutingTable(
      '',
      [serverA, serverB, serverC],
      [serverD, serverE],
      [serverF]
    )

    const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
      server0,
      [server02, server01, server03], // seed router address resolves to 3 different addresses
      [
        newRoutingTable(
          '',
          [], // no routers in the known routing table
          [server1],
          [server2, server3],
          Integer.MAX_VALUE // not expired
        )
      ],
      {
        '': {
          'server01:7687': null, // returns no routing table
          'server02:7687': null, // returns no routing table
          'server03:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider.acquireConnection(WRITE, '').then(connection1 => {
      expect(connection1.address).toEqual(serverF)

      connectionProvider.acquireConnection(READ, '').then(connection2 => {
        expect(connection2.address).toEqual(serverD)

        expectRoutingTable(
          connectionProvider,
          '',
          [serverA, serverB, serverC],
          [serverD, serverE],
          [serverF]
        )
        done()
      })
    })
  })

  it('ignores already probed routers after seed router resolution', done => {
    const updatedRoutingTable = newRoutingTable(
      '',
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    )

    const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
      server0,
      [server1, server01, server2, server02], // seed router address resolves to 4 different addresses
      [
        newRoutingTable(
          '',
          [server1, server2],
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      {
        '': {
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

    connectionProvider.acquireConnection(READ, '').then(connection1 => {
      expect(connection1.address).toEqual(serverC)

      connectionProvider.acquireConnection(WRITE, '').then(connection2 => {
        expect(connection2.address).toEqual(serverE)

        // two sets of routers probed:
        // 1) existing routers server1 & server2
        // 2) resolved routers server01 & server02
        expect(usedRouterArrays.length).toEqual(2)
        expect(usedRouterArrays[0]).toEqual([server1, server2])
        expect(usedRouterArrays[1]).toEqual([server01, server02])

        expectRoutingTable(
          connectionProvider,
          '',
          [serverA, serverB],
          [serverC, serverD],
          [serverE, serverF]
        )
        done()
      })
    })
  })

  it('throws session expired when refreshed routing table has no readers', done => {
    const pool = newPool()
    const updatedRoutingTable = newRoutingTable(
      '',
      [serverA, serverB],
      [], // no readers
      [serverC, serverD]
    )
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          '',
          [server1, server2],
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      pool,
      {
        '': {
          'server1:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider.acquireConnection(READ, '').catch(error => {
      expect(error.code).toEqual(SESSION_EXPIRED)
      done()
    })
  })

  it('throws session expired when refreshed routing table has no writers', done => {
    const pool = newPool()
    const updatedRoutingTable = newRoutingTable(
      '',
      [serverA, serverB],
      [serverC, serverD],
      [] // no writers
    )
    const connectionProvider = newRoutingConnectionProvider(
      [
        newRoutingTable(
          '',
          [server1, server2],
          [server3, server4],
          [server5, server6],
          int(0) // expired routing table
        )
      ],
      pool,
      {
        '': {
          'server1:7687': updatedRoutingTable
        }
      }
    )

    connectionProvider.acquireConnection(WRITE, '').catch(error => {
      expect(error.code).toEqual(SESSION_EXPIRED)
      done()
    })
  })

  it('should use resolved seed router after accepting table with no writers', done => {
    const routingTable1 = newRoutingTable(
      '',
      [serverA, serverB],
      [serverC, serverD],
      [] // no writers
    )
    const routingTable2 = newRoutingTable(
      '',
      [serverAA, serverBB],
      [serverCC, serverDD],
      [serverEE]
    )

    const connectionProvider = newRoutingConnectionProviderWithSeedRouter(
      server0,
      [server02, server01], // seed router address resolves to 2 different addresses
      [
        newRoutingTable(
          '',
          [server1],
          [server2, server3],
          [server4, server5],
          int(0) // expired routing table
        )
      ],
      {
        '': {
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

    connectionProvider.acquireConnection(READ, '').then(connection1 => {
      expect(connection1.address).toEqual(serverC)

      connectionProvider.acquireConnection(READ, '').then(connection2 => {
        expect(connection2.address).toEqual(serverD)

        expectRoutingTable(
          connectionProvider,
          '',
          [serverA, serverB],
          [serverC, serverD],
          []
        )

        connectionProvider.acquireConnection(WRITE, '').then(connection3 => {
          expect(connection3.address).toEqual(serverEE)

          expectRoutingTable(
            connectionProvider,
            '',
            [serverAA, serverBB],
            [serverCC, serverDD],
            [serverEE]
          )

          done()
        })
      })
    })
  })

  describe('multi-database', () => {
    it('should acquire read connection from correct routing table', async () => {
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

      const conn1 = await connectionProvider.acquireConnection(
        READ,
        'databaseA'
      )
      expect(conn1 instanceof DelegateConnection).toBeTruthy()
      expect(conn1.address).toBe(server1)

      const conn2 = await connectionProvider.acquireConnection(
        READ,
        'databaseB'
      )
      expect(conn2 instanceof DelegateConnection).toBeTruthy()
      expect(conn2.address).toBe(serverA)
    })

    it('should acquire write connection from correct routing table', async () => {
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

      const conn1 = await connectionProvider.acquireConnection(
        WRITE,
        'databaseA'
      )
      expect(conn1 instanceof DelegateConnection).toBeTruthy()
      expect(conn1.address).toBe(server2)

      const conn2 = await connectionProvider.acquireConnection(
        WRITE,
        'databaseB'
      )
      expect(conn2 instanceof DelegateConnection).toBeTruthy()
      expect(conn2.address).toBe(serverB)
    })

    it('should fail connection acquisition if database is not known', async () => {
      const pool = newPool()
      const connectionProvider = newRoutingConnectionProvider(
        [
          newRoutingTable('databaseA', [server1, server2], [server1], [server2])
        ],
        pool
      )

      try {
        await connectionProvider.acquireConnection(WRITE, 'databaseX')
      } catch (error) {
        expect(error instanceof Neo4jError).toBeTruthy()
        expect(error.code).toBe(SERVICE_UNAVAILABLE)
        expect(error.message).toContain(
          'Could not perform discovery. No routing servers available.'
        )
        return
      }

      expect(false).toBeTruthy('exception expected')
    })

    it('should forget read server from correct routing table on availability error', async () => {
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

      const conn1 = await connectionProvider.acquireConnection(
        READ,
        'databaseB'
      )

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
    })

    it('should forget write server from correct routing table on availability error', async () => {
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

      const conn1 = await connectionProvider.acquireConnection(
        WRITE,
        'databaseB'
      )

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
    })

    it('should forget write server from correct routing table on write error', async () => {
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

      const conn1 = await connectionProvider.acquireConnection(
        WRITE,
        'databaseB'
      )

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
    })
  })
})

function newRoutingConnectionProvider (
  routingTables,
  pool = null,
  routerToRoutingTable = { '': {} }
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
  routerToRoutingTable = { '': {} },
  connectionPool = null
) {
  const pool = connectionPool || newPool()
  const connectionProvider = new RoutingConnectionProvider({
    id: 0,
    address: seedRouter,
    routingContext: {},
    hostNameResolver: new SimpleHostNameResolver(),
    config: {},
    log: Logger.noOp()
  })
  connectionProvider._connectionPool = pool
  routingTables.forEach(r => {
    connectionProvider._routingTables[r.database] = r
  })
  connectionProvider._rediscovery = new FakeRediscovery(routerToRoutingTable)
  connectionProvider._hostNameResolver = new FakeDnsResolver(seedRouterResolved)
  connectionProvider._useSeedRouter = routingTables.every(
    r => r.expirationTime !== Integer.ZERO
  )
  return connectionProvider
}

function newRoutingTable (
  database,
  routers,
  readers,
  writers,
  expirationTime = Integer.MAX_VALUE
) {
  return new RoutingTable({
    database,
    routers,
    readers,
    writers,
    expirationTime
  })
}

function setupRoutingConnectionProviderToRememberRouters (
  connectionProvider,
  routersArray
) {
  const originalFetch = connectionProvider._fetchRoutingTable.bind(
    connectionProvider
  )
  const rememberingFetch = (routerAddresses, routingTable) => {
    routersArray.push(routerAddresses)
    return originalFetch(routerAddresses, routingTable)
  }
  connectionProvider._fetchRoutingTable = rememberingFetch
}

function newPool () {
  return new Pool({
    create: (address, release) =>
      Promise.resolve(
        new FakeConnection(address, release, VERSION_IN_DEV.toString())
      )
  })
}

function expectRoutingTable (
  connectionProvider,
  database,
  routers,
  readers,
  writers
) {
  expect(connectionProvider._routingTables[database].database).toEqual(database)
  expect(connectionProvider._routingTables[database].routers).toEqual(routers)
  expect(connectionProvider._routingTables[database].readers).toEqual(readers)
  expect(connectionProvider._routingTables[database].writers).toEqual(writers)
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
  constructor (address, release, version) {
    super(null)

    this._address = address
    this._version = version || VERSION_IN_DEV.toString()
    this.release = release
  }

  get address () {
    return this._address
  }

  get version () {
    return this._version
  }
}

class FakeRediscovery {
  constructor (routerToRoutingTable) {
    this._routerToRoutingTable = routerToRoutingTable
  }

  lookupRoutingTableOnRouter (ignored, database, router) {
    const table = this._routerToRoutingTable[database || '']
    if (table) {
      return Promise.resolve(table[router.asKey()])
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

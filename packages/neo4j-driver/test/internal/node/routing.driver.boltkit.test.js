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

import neo4j from '../../../src'
import { READ, WRITE } from '../../../src/driver'
import boltStub from '../bolt-stub'
import RoutingTable from '../../../../bolt-connection/lib/rediscovery/routing-table'
import { error, internal } from 'neo4j-driver-core'
import lolex from 'lolex'

const {
  serverAddress: { ServerAddress }
} = internal

const { SERVICE_UNAVAILABLE, SESSION_EXPIRED } = error

describe('#stub-routing routing driver with stub server', () => {
  it('should discover IPv6 servers', async () => {
    if (!boltStub.supported) {
      return
    }

    const server = await boltStub.start(
      './test/resources/boltstub/v3/discover_ipv6_servers_and_read.script',
      9001
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')
    const session = driver.session({ defaultAccessMode: READ })
    await session.run('MATCH (n) RETURN n.name')
    expect(hasAddressInConnectionPool(driver, '127.0.0.1:9001')).toBeTruthy()
    assertHasReaders(driver, ['127.0.0.1:9001', '[::1]:9001'])
    assertHasWriters(driver, [
      '[2001:db8:a0b:12f0::1]:9002',
      '[3731:54:65fe:2::a7]:9003'
    ])
    assertHasRouters(driver, [
      '[ff02::1]:9001',
      '[684D:1111:222:3333:4444:5555:6:77]:9002',
      '[::1]:9003'
    ])

    expect(hasAddressInConnectionPool(driver, '127.0.0.1:9001')).toBeTruthy()
    assertHasReaders(driver, ['127.0.0.1:9001', '[::1]:9001'])
    assertHasWriters(driver, [
      '[2001:db8:a0b:12f0::1]:9002',
      '[3731:54:65fe:2::a7]:9003'
    ])
    assertHasRouters(driver, [
      '[ff02::1]:9001',
      '[684D:1111:222:3333:4444:5555:6:77]:9002',
      '[::1]:9003'
    ])

    await driver.close()
    await server.exit()
  }, 60000)

  it('should round-robin among read servers', async () => {
    if (!boltStub.supported) {
      return
    }
    // Given
    const seedServer = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9001
    )
    const readServer1 = await boltStub.start(
      './test/resources/boltstub/v3/read.script',
      9005
    )
    const readServer2 = await boltStub.start(
      './test/resources/boltstub/v3/read.script',
      9006
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')
    // When
    const session1 = driver.session({ defaultAccessMode: READ })
    const res1 = await session1.run('MATCH (n) RETURN n.name')
    // Then
    expect(res1.records[0].get('n.name')).toEqual('Bob')
    expect(res1.records[1].get('n.name')).toEqual('Alice')
    expect(res1.records[2].get('n.name')).toEqual('Tina')
    await session1.close()

    const session2 = driver.session({ defaultAccessMode: READ })
    const res2 = await session2.run('MATCH (n) RETURN n.name')
    // Then
    expect(res2.records[0].get('n.name')).toEqual('Bob')
    expect(res2.records[1].get('n.name')).toEqual('Alice')
    expect(res2.records[2].get('n.name')).toEqual('Tina')
    await session2.close()

    await driver.close()
    await seedServer.exit()
    await readServer1.exit()
    await readServer2.exit()
  }, 60000)

  it('should round-robin among write servers', async () => {
    if (!boltStub.supported) {
      return
    }
    // Given
    const seedServer = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9001
    )
    const writeServer1 = await boltStub.start(
      './test/resources/boltstub/v3/write.script',
      9007
    )
    const writeServer2 = await boltStub.start(
      './test/resources/boltstub/v3/write.script',
      9008
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

    // When & Then
    const session1 = driver.session({ defaultAccessMode: WRITE })
    await session1.run("CREATE (n {name:'Bob'})")

    const session2 = driver.session({ defaultAccessMode: WRITE })
    await session2.run("CREATE (n {name:'Bob'})")

    await driver.close()
    await seedServer.exit()
    await writeServer1.exit()
    await writeServer2.exit()
  }, 60000)

  it('should re-use connections', async () => {
    if (!boltStub.supported) {
      return
    }
    // Given
    const seedServer = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_three_servers_set_1.script',
      9002
    )
    const writeServer = await boltStub.start(
      './test/resources/boltstub/v3/write_twice.script',
      9001
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9002')
    // When
    const session1 = driver.session({ defaultAccessMode: WRITE })
    await session1.run("CREATE (n {name:'Bob'})")
    await session1.close()
    const openConnectionsCount = numberOfOpenConnections(driver)

    const session2 = driver.session({ defaultAccessMode: WRITE })
    await session2.run('CREATE ()')

    // driver should have same amount of open connections at this point;
    // no new connections should be created, existing connections should be reused
    expect(numberOfOpenConnections(driver)).toEqual(openConnectionsCount)

    await driver.close()
    // all connections should be closed when driver is closed
    expect(numberOfOpenConnections(driver)).toEqual(0)

    await seedServer.exit()
    await writeServer.exit()
  }, 60000)

  it('should expose server info in cluster', async () => {
    if (!boltStub.supported) {
      return
    }

    // Given
    const routingServer = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9001
    )
    const writeServer = await boltStub.start(
      './test/resources/boltstub/v3/write_with_server_version.script',
      9007
    )
    const readServer = await boltStub.start(
      './test/resources/boltstub/v3/read_with_server_version.script',
      9005
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')
    // When
    const readSession = driver.session({ defaultAccessMode: READ })
    const readResult = await readSession.run('MATCH (n) RETURN n.name')

    const writeSession = driver.session({ defaultAccessMode: WRITE })
    const writeResult = await writeSession.run("CREATE (n {name:'Bob'})")

    // Then
    const readServerInfo = readResult.summary.server
    expect(readServerInfo.address).toBe('127.0.0.1:9005')
    expect(readServerInfo.version).toBe('Neo4j/8.8.8')

    const writeServerInfo = writeResult.summary.server
    expect(writeServerInfo.address).toBe('127.0.0.1:9007')
    expect(writeServerInfo.version).toBe('Neo4j/9.9.9')

    await readSession.close()
    await writeSession.close()
    await driver.close()
    await routingServer.exit()
    await writeServer.exit()
    await readServer.exit()
  }, 60000)

  it('should expose server info in cluster using observer', done => {
    if (!boltStub.supported) {
      done()
      return
    }

    // Given
    boltStub
      .start('./test/resources/boltstub/v3/acquire_endpoints.script', 9001)
      .then(routingServer =>
        boltStub
          .start(
            './test/resources/boltstub/v3/write_with_server_version.script',
            9007
          )
          .then(writeServer =>
            boltStub
              .start(
                './test/resources/boltstub/v3/read_with_server_version.script',
                9005
              )
              .then(readServer => {
                const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

                // When
                const readSession = driver.session({
                  defaultAccessMode: READ
                })
                readSession.run('MATCH (n) RETURN n.name').subscribe({
                  onNext: () => {},
                  onError: () => {},
                  onCompleted: readSummary => {
                    const writeSession = driver.session({
                      defaultAccessMode: WRITE
                    })
                    writeSession.run("CREATE (n {name:'Bob'})").subscribe({
                      onNext: () => {},
                      onError: () => {},
                      onCompleted: writeSummary => {
                        expect(readSummary.server.address).toBe(
                          '127.0.0.1:9005'
                        )
                        expect(readSummary.server.version).toBe('Neo4j/8.8.8')

                        expect(writeSummary.server.address).toBe(
                          '127.0.0.1:9007'
                        )
                        expect(writeSummary.server.version).toBe('Neo4j/9.9.9')

                        readSession
                          .close()
                          .then(() =>
                            writeSession.close().then(() => driver.close())
                          )
                          .then(() => routingServer.exit())
                          .then(() => writeServer.exit())
                          .then(() => readServer.exit())
                          .then(() => done())
                      }
                    })
                  }
                })
              })
          )
      )
  }, 60000)

  it('should close connection used for routing table refreshing', async () => {
    if (!boltStub.supported) {
      return
    }

    // server is both router and writer
    const server = await boltStub.start(
      './test/resources/boltstub/v3/discover_servers_and_read.script',
      9001
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

    const acquiredConnections = []
    const releasedConnections = []
    setUpPoolToMemorizeAllAcquiredAndReleasedConnections(
      driver,
      acquiredConnections,
      releasedConnections
    )

    const session = driver.session()
    await session.run('MATCH (n) RETURN n.name')

    // two connections should have been acquired: one for rediscovery and one for the query
    expect(acquiredConnections.length).toEqual(2)
    // same two connections should have been released
    expect(releasedConnections.length).toEqual(2)
    // verify that acquired connections are those that we released
    for (let i = 0; i < acquiredConnections.length; i++) {
      expect(acquiredConnections[i]).toBe(releasedConnections[i])
    }

    await session.close()
    await driver.close()
    await server.exit()
  }, 60000)

  it(
    'should throw error when no records',
    () =>
      testForProtocolError(
        './test/resources/boltstub/v3/acquire_endpoints_no_records.script'
      ),
    60000
  )

  it(
    'should throw error when no TTL entry',
    () =>
      testForProtocolError(
        './test/resources/boltstub/v3/acquire_endpoints_no_ttl_field.script'
      ),
    60000
  )

  it(
    'should throw error when no servers entry',
    () =>
      testForProtocolError(
        './test/resources/boltstub/v3/acquire_endpoints_no_servers_field.script'
      ),
    60000
  )

  it(
    'should throw error when unparsable TTL entry',
    () =>
      testForProtocolError(
        './test/resources/boltstub/v3/acquire_endpoints_unparsable_ttl.script'
      ),
    60000
  )

  it(
    'should throw error when multiple records',
    () =>
      testForProtocolError(
        './test/resources/boltstub/v3/acquire_endpoints_multiple_records.script'
      ),
    60000
  )

  it(
    'should throw error on unparsable record',
    () =>
      testForProtocolError(
        './test/resources/boltstub/v3/acquire_endpoints_unparsable_servers.script'
      ),
    60000
  )

  it('should pass bookmark from transaction to transaction', async () => {
    if (!boltStub.supported) {
      return
    }

    const router = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_three_servers_set_2.script',
      9001
    )
    const writer = await boltStub.start(
      './test/resources/boltstub/v3/write_read_tx_with_bookmarks.script',
      9010
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

    const session = driver.session({ bookmarks: ['neo4j:bookmark:v1:tx42'] })
    const writeTx = session.beginTransaction()
    await writeTx.run("CREATE (n {name:'Bob'})")
    await writeTx.commit()
    expect(session.lastBookmark()).toEqual(['neo4j:bookmark:v1:tx4242'])

    const readTx = session.beginTransaction()
    const result = await readTx.run('MATCH (n) RETURN n.name AS name')
    const records = result.records
    expect(records.length).toEqual(1)
    expect(records[0].get('name')).toEqual('Bob')

    await readTx.commit()
    expect(session.lastBookmark()).toEqual(['neo4j:bookmark:v1:tx424242'])

    await session.close()
    await driver.close()
    await router.exit()
    await writer.exit()
  }, 60000)

  it(
    'should connect to cluster when disableLosslessIntegers is on',
    () =>
      testDiscoveryAndReadQueryInAutoCommitTx(
        './test/resources/boltstub/v3/acquire_endpoints.script',
        { disableLosslessIntegers: true }
      ),
    60000
  )

  describe('should report whether transaction config is supported', () => {
    async function verifySupportsTransactionConfig (version, expected) {
      if (!boltStub.supported) {
        return
      }

      const server = await boltStub.start(
        `./test/resources/boltstub/${version}/supports_protocol_version.script`,
        9001
      )

      const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

      await expectAsync(driver.supportsTransactionConfig()).toBeResolvedTo(
        expected
      )

      await driver.close()
      await server.exit()
    }

    async function verifySupportsTransactionConfigWithResolver (
      version,
      expected
    ) {
      if (!boltStub.supported) {
        return
      }

      const server = await boltStub.start(
        `./test/resources/boltstub/${version}/supports_protocol_version.script`,
        9001
      )

      const driver = boltStub.newDriver('neo4j://127.0.0.1:8000', {
        resolver: address => [
          'neo4j://127.0.0.1:9010',
          'neo4j://127.0.0.1:9005',
          'neo4j://127.0.0.1:9001'
        ]
      })

      await expectAsync(driver.supportsTransactionConfig()).toBeResolvedTo(
        expected
      )

      await driver.close()
      await server.exit()
    }

    it('v3', () => verifySupportsTransactionConfig('v3', true), 60000)
    it('v4', () => verifySupportsTransactionConfig('v4', true), 60000)
    it('v4.2', () => verifySupportsTransactionConfig('v4.2', true), 60000)
    it(
      'v3 with resolver',
      () => verifySupportsTransactionConfigWithResolver('v3', true),
      60000
    )
    it(
      'v4 with resolver',
      () => verifySupportsTransactionConfigWithResolver('v4', true),
      60000
    )
    it(
      'v4.2 with resolver',
      () => verifySupportsTransactionConfigWithResolver('v4.2', true),
      60000
    )
    it('on error', async () => {
      const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

      await expectAsync(driver.supportsTransactionConfig()).toBeRejectedWith(
        jasmine.objectContaining({
          code: SESSION_EXPIRED
        })
      )

      await driver.close()
    }, 60000)
  })

  async function testDiscoveryAndReadQueryInAutoCommitTx (
    routerScript,
    driverConfig
  ) {
    if (!boltStub.supported) {
      return
    }

    const router = await boltStub.start(routerScript, 9001)
    const reader = await boltStub.start(
      './test/resources/boltstub/v3/read.script',
      9005
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001', driverConfig)

    const session = driver.session({ defaultAccessMode: READ })
    const result = await session.run('MATCH (n) RETURN n.name')
    expect(result.records.map(record => record.get(0))).toEqual([
      'Bob',
      'Alice',
      'Tina'
    ])

    await session.close()
    await driver.close()
    await router.exit()
    await reader.exit()
  }

  async function testForProtocolError (scriptFile) {
    if (!boltStub.supported) {
      return
    }

    const server = await boltStub.start(scriptFile, 9001)
    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')
    const session = driver.session()

    await expectAsync(session.run('MATCH (n) RETURN n.name')).toBeRejectedWith(
      jasmine.objectContaining({ code: neo4j.error.SERVICE_UNAVAILABLE })
    )

    await session.close()
    await driver.close()
    await server.exit()
  }

  function setUpPoolToMemorizeAllAcquiredAndReleasedConnections (
    driver,
    acquiredConnections,
    releasedConnections
  ) {
    // make connection pool remember all acquired connections
    const connectionPool = getConnectionPool(driver)

    const originalAcquire = connectionPool.acquire.bind(connectionPool)
    const memorizingAcquire = (...args) => {
      return originalAcquire(...args).then(connection => {
        acquiredConnections.push(connection)
        return connection
      })
    }
    connectionPool.acquire = memorizingAcquire

    // make connection pool remember all released connections
    const originalRelease = connectionPool._release
    const rememberingRelease = (poolState, key, resource) => {
      originalRelease(poolState, key, resource)
      releasedConnections.push(resource)
    }
    connectionPool._release = rememberingRelease
  }

  function hasAddressInConnectionPool (driver, address) {
    return getConnectionPool(driver).has(ServerAddress.fromUrl(address))
  }

  function assertHasRouters (driver, expectedRouters, database) {
    expect(
      getRoutingTable(driver, database).routers.map(s => s.asHostPort())
    ).toEqual(expectedRouters)
  }

  function assertHasReaders (driver, expectedReaders, database) {
    expect(
      getRoutingTable(driver, database).readers.map(s => s.asHostPort())
    ).toEqual(expectedReaders)
  }

  function assertHasWriters (driver, expectedWriters, database) {
    expect(
      getRoutingTable(driver, database).writers.map(s => s.asHostPort())
    ).toEqual(expectedWriters)
  }

  function getConnectionPool (driver) {
    const connectionProvider = driver._getOrCreateConnectionProvider()
    return connectionProvider._connectionPool
  }

  function getRoutingTable (driver, database = null) {
    const connectionProvider = driver._getOrCreateConnectionProvider()
    return connectionProvider._routingTableRegistry.get(database, {})
  }

  function numberOfOpenConnections (driver) {
    return Object.keys(driver._connectionProvider._openConnections).length
  }
})

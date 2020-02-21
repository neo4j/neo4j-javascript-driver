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

import neo4j from '../../../src'
import { READ, WRITE } from '../../../src/driver'
import boltStub from '../bolt-stub'
import RoutingTable from '../../../src/internal/routing-table'
import { SERVICE_UNAVAILABLE, SESSION_EXPIRED } from '../../../src/error'
import lolex from 'lolex'
import ServerAddress from '../../../src/internal/server-address'
import { SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION } from 'constants'

describe('#stub-routing routing driver with stub server', () => {
  let originalTimeout

  beforeAll(() => {
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000
  })

  afterAll(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout
  })

  it('should discover servers', async () => {
    if (!boltStub.supported) {
      return
    }
    // Given
    const server = await boltStub.start(
      './test/resources/boltstub/v3/discover_servers_and_read.script',
      9001
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

    // When
    const session = driver.session()
    await session.run('MATCH (n) RETURN n.name')
    await session.close()

    // Then
    expect(hasAddressInConnectionPool(driver, '127.0.0.1:9001')).toBeTruthy()
    assertHasRouters(driver, [
      '127.0.0.1:9001',
      '127.0.0.1:9002',
      '127.0.0.1:9003'
    ])
    assertHasReaders(driver, ['127.0.0.1:9002', '127.0.0.1:9003'])
    assertHasWriters(driver, ['127.0.0.1:9001'])

    await driver.close()
    await server.exit()
  })

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
      '[684d:1111:222:3333:4444:5555:6:77]:9002',
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
      '[684d:1111:222:3333:4444:5555:6:77]:9002',
      '[::1]:9003'
    ])

    await driver.close()
    await server.exit()
  })

  it('should purge connections to stale servers after routing table refresh', async () => {
    if (!boltStub.supported) {
      return
    }

    const router = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9042
    )
    const reader = await boltStub.start(
      './test/resources/boltstub/v3/read.script',
      9005
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9042')
    const session = driver.session({ defaultAccessMode: READ })
    await session.run('MATCH (n) RETURN n.name')
    await session.close()

    expect(hasAddressInConnectionPool(driver, '127.0.0.1:9042')).toBeFalsy()
    expect(hasAddressInConnectionPool(driver, '127.0.0.1:9005')).toBeTruthy()

    await driver.close()
    await router.exit()
    await reader.exit()
  })

  it('should discover servers using subscribe', done => {
    if (!boltStub.supported) {
      done()
      return
    }
    // Given
    boltStub
      .start(
        './test/resources/boltstub/v3/discover_servers_and_read.script',
        9001
      )
      .then(server => {
        const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')
        // When
        const session = driver.session()
        session.run('MATCH (n) RETURN n.name').subscribe({
          onCompleted: () => {
            // Then
            assertHasRouters(driver, [
              '127.0.0.1:9001',
              '127.0.0.1:9002',
              '127.0.0.1:9003'
            ])
            assertHasReaders(driver, ['127.0.0.1:9002', '127.0.0.1:9003'])
            assertHasWriters(driver, ['127.0.0.1:9001'])

            driver
              .close()
              .then(() => server.exit())
              .then(() => done())
          }
        })
      })
  })

  it('should handle empty response from server', async () => {
    if (!boltStub.supported) {
      return
    }
    // Given
    const server = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_no_records.script',
      9001
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

    // When
    const session = driver.session({ defaultAccessMode: neo4j.READ })

    await expectAsync(session.run('MATCH (n) RETURN n.name')).toBeRejectedWith(
      jasmine.objectContaining({
        code: neo4j.error.SERVICE_UNAVAILABLE
      })
    )

    await session.close()
    await driver.close()
    await server.exit()
  })

  it('should acquire read server', async () => {
    if (!boltStub.supported) {
      return
    }
    // Given
    const seedServer = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9001
    )
    const readServer = await boltStub.start(
      './test/resources/boltstub/v3/read.script',
      9005
    )
    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

    // When
    const session = driver.session({ defaultAccessMode: READ })
    const res = await session.run('MATCH (n) RETURN n.name')
    await session.close()

    // Then
    expect(hasAddressInConnectionPool(driver, '127.0.0.1:9001')).toBeTruthy()
    expect(hasAddressInConnectionPool(driver, '127.0.0.1:9005')).toBeTruthy()

    expect(res.records[0].get('n.name')).toEqual('Bob')
    expect(res.records[1].get('n.name')).toEqual('Alice')
    expect(res.records[2].get('n.name')).toEqual('Tina')

    await driver.close()
    await seedServer.exit()
    await readServer.exit()
  })

  it('should pick first available route-server', async () => {
    if (!boltStub.supported) {
      return
    }
    // Given
    const seedServer = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_short_ttl.script',
      9999
    )
    const nextRouter = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9003
    )
    const readServer1 = await boltStub.start(
      './test/resources/boltstub/v3/read.script',
      9004
    )
    const readServer2 = await boltStub.start(
      './test/resources/boltstub/v3/read.script',
      9006
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9999')
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
    await nextRouter.exit()
    await readServer1.exit()
    await readServer2.exit()
  })

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
  })

  it('should handle missing read server', async () => {
    if (!boltStub.supported) {
      return
    }
    // Given
    const seedServer = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9001
    )
    const readServer = await boltStub.start(
      './test/resources/boltstub/v3/read_dead.script',
      9005
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')
    // When
    const session = driver.session({ defaultAccessMode: READ })

    await expectAsync(session.run('MATCH (n) RETURN n.name')).toBeRejectedWith(
      jasmine.objectContaining({
        code: neo4j.error.SESSION_EXPIRED
      })
    )

    await driver.close()
    await seedServer.exit()
    await readServer.exit()
  })

  it('should acquire write server', async () => {
    if (!boltStub.supported) {
      return
    }
    // Given
    const seedServer = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9001
    )
    const writeServer = await boltStub.start(
      './test/resources/boltstub/v3/write.script',
      9007
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')
    // When
    const session = driver.session({ defaultAccessMode: WRITE })

    // Then
    await session.run("CREATE (n {name:'Bob'})")

    await driver.close()
    await seedServer.exit()
    await writeServer.exit()
  })

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
  })

  it('should handle missing write server', async () => {
    if (!boltStub.supported) {
      return
    }
    // Given
    const seedServer = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9001
    )
    const writeServer = await boltStub.start(
      './test/resources/boltstub/v3/write_dead.script',
      9007
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

    // When & Then
    const session = driver.session({ defaultAccessMode: WRITE })
    await expectAsync(session.run('CREATE ()')).toBeRejectedWith(
      jasmine.objectContaining({
        code: neo4j.error.SESSION_EXPIRED
      })
    )

    await driver.close()
    await seedServer.exit()
    await writeServer.exit()
  })

  it('should remember endpoints', async () => {
    if (!boltStub.supported) {
      return
    }
    // Given
    const seedServer = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9001
    )
    const readServer = await boltStub.start(
      './test/resources/boltstub/v3/read.script',
      9005
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')
    // When
    const session = driver.session({ defaultAccessMode: READ })
    await session.run('MATCH (n) RETURN n.name')
    // Then
    assertHasRouters(driver, [
      '127.0.0.1:9001',
      '127.0.0.1:9002',
      '127.0.0.1:9003'
    ])
    assertHasReaders(driver, ['127.0.0.1:9005', '127.0.0.1:9006'])
    assertHasWriters(driver, ['127.0.0.1:9007', '127.0.0.1:9008'])

    await driver.close()
    await seedServer.exit()
    await readServer.exit()
  })

  it('should forget endpoints on failure', async () => {
    if (!boltStub.supported) {
      return
    }
    // Given
    const seedServer = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9001
    )
    const readServer = await boltStub.start(
      './test/resources/boltstub/v3/read_dead.script',
      9005
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

    // When
    const session = driver.session({ defaultAccessMode: READ })
    await expectAsync(session.run('MATCH (n) RETURN n.name')).toBeRejected()
    await session.close()

    // Then
    expect(hasAddressInConnectionPool(driver, '127.0.0.1:9001')).toBeTruthy()
    expect(hasAddressInConnectionPool(driver, '127.0.0.1:9005')).toBeFalsy()
    assertHasRouters(driver, [
      '127.0.0.1:9001',
      '127.0.0.1:9002',
      '127.0.0.1:9003'
    ])
    assertHasReaders(driver, ['127.0.0.1:9006'])
    assertHasWriters(driver, ['127.0.0.1:9007', '127.0.0.1:9008'])

    await driver.close()
    await seedServer.exit()
    await readServer.exit()
  })

  it('should forget endpoints on session acquisition failure', async () => {
    if (!boltStub.supported) {
      return
    }
    // Given
    const seedServer = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9001
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

    // When
    const session = driver.session({ defaultAccessMode: READ })
    await expectAsync(session.run('MATCH (n) RETURN n.name')).toBeRejected()
    await session.close()

    // Then
    expect(hasAddressInConnectionPool(driver, '127.0.0.1:9001')).toBeTruthy()
    expect(hasAddressInConnectionPool(driver, '127.0.0.1:9005')).toBeFalsy()
    assertHasRouters(driver, [
      '127.0.0.1:9001',
      '127.0.0.1:9002',
      '127.0.0.1:9003'
    ])
    assertHasReaders(driver, ['127.0.0.1:9006'])
    assertHasWriters(driver, ['127.0.0.1:9007', '127.0.0.1:9008'])

    await driver.close()
    await seedServer.exit()
  })

  it('should rediscover if necessary', async () => {
    if (!boltStub.supported) {
      return
    }
    // Given
    const seedServer = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_rediscover.script',
      9001
    )
    const readServer = await boltStub.start(
      './test/resources/boltstub/v3/read.script',
      9005
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

    // When
    const session1 = driver.session({ defaultAccessMode: READ })
    await expectAsync(session1.run('MATCH (n) RETURN n.name')).toBeRejected()

    const session2 = driver.session({ defaultAccessMode: READ })
    await expectAsync(session2.run('MATCH (n) RETURN n.name')).toBeResolved()

    await driver.close()
    await seedServer.exit()
    await readServer.exit()
  })

  it('should handle server not able to do routing', async () => {
    if (!boltStub.supported) {
      return
    }

    // Given
    const server = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_not_supported.script',
      9001
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

    // When & Then
    const session = driver.session()
    await expectAsync(session.run('MATCH (n) RETURN n.name')).toBeRejectedWith(
      jasmine.objectContaining({
        code: neo4j.error.SERVICE_UNAVAILABLE,
        message: jasmine.stringMatching(/Could not perform discovery/)
      })
    )
    assertNoRoutingTable(driver)

    await session.close()
    await driver.close()
    await server.exit()
  })

  it('should handle leader switch while writing', async () => {
    if (!boltStub.supported) {
      return
    }
    // Given
    const seedServer = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9001
    )
    const readServer = await boltStub.start(
      './test/resources/boltstub/v3/write_not_a_leader.script',
      9007
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

    // When
    const session = driver.session()
    await expectAsync(session.run('CREATE ()')).toBeRejectedWith(
      jasmine.objectContaining({ code: neo4j.error.SESSION_EXPIRED })
    )
    // the server at 9007 should have been removed
    assertHasWriters(driver, ['127.0.0.1:9008'])

    await session.close()
    await driver.close()
    await seedServer.exit()
    await readServer.exit()
  })

  it('should handle leader switch while writing on transaction', async () => {
    if (!boltStub.supported) {
      return
    }
    // Given
    const seedServer = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9001
    )
    const readServer = await boltStub.start(
      './test/resources/boltstub/v3/write_tx_not_a_leader.script',
      9007
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')
    // When
    const session = driver.session()
    const tx = session.beginTransaction()
    tx.run('CREATE ()')

    // Then
    await expectAsync(tx.commit()).toBeRejectedWith(
      jasmine.objectContaining({ code: neo4j.error.SESSION_EXPIRED })
    )
    // the server at 9007 should have been removed
    assertHasWriters(driver, ['127.0.0.1:9008'])

    await session.close()
    await driver.close()
    await seedServer.exit()
    await readServer.exit()
  })

  it('should fail if missing write server', async () => {
    if (!boltStub.supported) {
      return
    }
    // Given
    const seedServer = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_no_writers.script',
      9001
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')
    // When
    const session = driver.session({ defaultAccessMode: WRITE })

    // Then
    await expectAsync(session.run('MATCH (n) RETURN n.name')).toBeRejectedWith(
      jasmine.objectContaining({ code: neo4j.error.SESSION_EXPIRED })
    )

    await driver.close()
    await seedServer.exit()
  })

  it('should try next router when current router fails to return a routing table', async () => {
    if (!boltStub.supported) {
      return
    }

    const server1 = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_zero_ttl.script',
      9999
    )
    const server2 = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_dead.script',
      9091
    )
    const server3 = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_dead.script',
      9092
    )
    const server4 = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_dead.script',
      9093
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9999')

    const session1 = driver.session()
    const result1 = await session1.run('MATCH (n) RETURN n')
    expect(result1.summary.server.address).toEqual('127.0.0.1:9999')
    await session1.close()

    assertHasRouters(driver, [
      '127.0.0.1:9091',
      '127.0.0.1:9092',
      '127.0.0.1:9093',
      '127.0.0.1:9999'
    ])
    const memorizingRoutingTable = setUpMemorizingRoutingTable(driver)

    const session2 = driver.session()
    const result2 = await session2.run('MATCH (n) RETURN n')
    expect(result2.summary.server.address).toEqual('127.0.0.1:9999')
    await session2.close()

    // returned routers failed to respond and should have been forgotten
    memorizingRoutingTable.assertForgotRouters([
      '127.0.0.1:9091',
      '127.0.0.1:9092',
      '127.0.0.1:9093'
    ])
    assertHasRouters(driver, ['127.0.0.1:9999'])

    await driver.close()
    await server1.exit()
    await server2.exit()
    await server3.exit()
    await server4.exit()
  })

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
  })

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
  })

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
  })

  it('should forget routers when fails to connect', async () => {
    if (!boltStub.supported) {
      return
    }

    const server = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_zero_ttl.script',
      9999
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9999')

    const session1 = driver.session()
    const result1 = await session1.run('MATCH (n) RETURN n')
    expect(result1.summary.server.address).toEqual('127.0.0.1:9999')
    await session1.close()

    assertHasRouters(driver, [
      '127.0.0.1:9091',
      '127.0.0.1:9092',
      '127.0.0.1:9093',
      '127.0.0.1:9999'
    ])
    const memorizingRoutingTable = setUpMemorizingRoutingTable(driver)

    const session2 = driver.session()
    const result2 = await session2.run('MATCH (n) RETURN n')
    expect(result2.summary.server.address).toEqual('127.0.0.1:9999')
    await session2.close()

    memorizingRoutingTable.assertForgotRouters([
      '127.0.0.1:9091',
      '127.0.0.1:9092',
      '127.0.0.1:9093'
    ])
    assertHasRouters(driver, ['127.0.0.1:9999'])

    await driver.close()
    await server.exit()
  })

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
  })

  it('should throw error when no records', () =>
    testForProtocolError(
      './test/resources/boltstub/v3/acquire_endpoints_no_records.script'
    ))

  it('should throw error when no TTL entry', () =>
    testForProtocolError(
      './test/resources/boltstub/v3/acquire_endpoints_no_ttl_field.script'
    ))

  it('should throw error when no servers entry', () =>
    testForProtocolError(
      './test/resources/boltstub/v3/acquire_endpoints_no_servers_field.script'
    ))

  it('should throw error when unparsable TTL entry', () =>
    testForProtocolError(
      './test/resources/boltstub/v3/acquire_endpoints_unparsable_ttl.script'
    ))

  it('should throw error when multiple records', () =>
    testForProtocolError(
      './test/resources/boltstub/v3/acquire_endpoints_multiple_records.script'
    ))

  it('should throw error on unparsable record', () =>
    testForProtocolError(
      './test/resources/boltstub/v3/acquire_endpoints_unparsable_servers.script'
    ))

  it('should throw error when no routers', () =>
    testForProtocolError(
      './test/resources/boltstub/v3/acquire_endpoints_no_routers.script'
    ))

  it('should throw error when no readers', () =>
    testForProtocolError(
      './test/resources/boltstub/v3/acquire_endpoints_no_readers.script'
    ))

  it('should accept routing table with 1 router, 1 reader and 1 writer', () =>
    testRoutingTableAcceptance(
      {
        routers: ['127.0.0.1:9091'],
        readers: ['127.0.0.1:9092'],
        writers: ['127.0.0.1:9999']
      },
      9999
    ))

  it('should accept routing table with 2 routers, 1 reader and 1 writer', () =>
    testRoutingTableAcceptance(
      {
        routers: ['127.0.0.1:9091', '127.0.0.1:9092'],
        readers: ['127.0.0.1:9092'],
        writers: ['127.0.0.1:9999']
      },
      9999
    ))

  it('should accept routing table with 1 router, 2 readers and 1 writer', () =>
    testRoutingTableAcceptance(
      {
        routers: ['127.0.0.1:9091'],
        readers: ['127.0.0.1:9092', '127.0.0.1:9093'],
        writers: ['127.0.0.1:9999']
      },
      9999
    ))

  it('should accept routing table with 2 routers, 2 readers and 1 writer', () =>
    testRoutingTableAcceptance(
      {
        routers: ['127.0.0.1:9091', '127.0.0.1:9092'],
        readers: ['127.0.0.1:9093', '127.0.0.1:9094'],
        writers: ['127.0.0.1:9999']
      },
      9999
    ))

  it('should accept routing table with 1 router, 1 reader and 2 writers', () =>
    testRoutingTableAcceptance(
      {
        routers: ['127.0.0.1:9091'],
        readers: ['127.0.0.1:9092'],
        writers: ['127.0.0.1:9999', '127.0.0.1:9093']
      },
      9999
    ))

  it('should accept routing table with 2 routers, 1 reader and 2 writers', () =>
    testRoutingTableAcceptance(
      {
        routers: ['127.0.0.1:9091', '127.0.0.1:9092'],
        readers: ['127.0.0.1:9093'],
        writers: ['127.0.0.1:9999', '127.0.0.1:9094']
      },
      9999
    ))

  it('should accept routing table with 1 router, 2 readers and 2 writers', () =>
    testRoutingTableAcceptance(
      {
        routers: ['127.0.0.1:9091'],
        readers: ['127.0.0.1:9092', '127.0.0.1:9093'],
        writers: ['127.0.0.1:9999', '127.0.0.1:9094']
      },
      9999
    ))

  it('should accept routing table with 2 routers, 2 readers and 2 writers', () =>
    testRoutingTableAcceptance(
      {
        routers: ['127.0.0.1:9091', '127.0.0.1:9092'],
        readers: ['127.0.0.1:9093', '127.0.0.1:9094'],
        writers: ['127.0.0.1:9999', '127.0.0.1:9095']
      },
      9999
    ))

  it('should send and receive bookmark', async () => {
    if (!boltStub.supported) {
      return
    }

    const router = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9001
    )
    const writer = await boltStub.start(
      './test/resources/boltstub/v3/write_tx_with_bookmarks.script',
      9007
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

    // When
    const session = driver.session({ bookmarks: ['neo4j:bookmark:v1:tx42'] })
    const tx = session.beginTransaction()
    await tx.run("CREATE (n {name:'Bob'})")
    await tx.commit()

    // Then
    expect(session.lastBookmark()).toEqual(['neo4j:bookmark:v1:tx4242'])

    await session.close()
    await driver.close()
    await router.exit()
    await writer.exit()
  })

  it('should send initial bookmark without access mode', () =>
    testWriteSessionWithAccessModeAndBookmark(null, 'neo4j:bookmark:v1:tx42'))

  it('should use write session mode and initial bookmark', () =>
    testWriteSessionWithAccessModeAndBookmark(WRITE, 'neo4j:bookmark:v1:tx42'))

  it('should use read session mode and initial bookmark', async () => {
    if (!boltStub.supported) {
      return
    }

    const router = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9001
    )
    const writer = await boltStub.start(
      './test/resources/boltstub/v3/read_tx_with_bookmarks.script',
      9005
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

    const session = driver.session({
      defaultAccessMode: READ,
      bookmarks: ['neo4j:bookmark:v1:tx42']
    })
    const tx = session.beginTransaction()
    const result = await tx.run('MATCH (n) RETURN n.name AS name')
    const records = result.records
    expect(records.length).toEqual(2)
    expect(records[0].get('name')).toEqual('Bob')
    expect(records[1].get('name')).toEqual('Alice')

    await tx.commit()
    expect(session.lastBookmark()).toEqual(['neo4j:bookmark:v1:tx4242'])

    await session.close()
    await driver.close()
    await router.exit()
    await writer.exit()
  })

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
  })

  it('should retry read transaction until success', async () => {
    if (!boltStub.supported) {
      return
    }

    const router = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9001
    )
    const brokenReader = await boltStub.start(
      './test/resources/boltstub/v3/read_tx_dead.script',
      9005
    )
    const reader = await boltStub.start(
      './test/resources/boltstub/v3/read_tx.script',
      9006
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')
    const session = driver.session()

    let invocations = 0
    const result = await session.readTransaction(tx => {
      invocations++
      return tx.run('MATCH (n) RETURN n.name')
    })

    expect(result.records.length).toEqual(3)
    expect(invocations).toEqual(2)

    await session.close()
    await driver.close()
    await router.exit()
    await brokenReader.exit()
    await reader.exit()
  })

  it('should retry write transaction until success', async () => {
    if (!boltStub.supported) {
      return
    }

    const router = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9001
    )
    const brokenWriter = await boltStub.start(
      './test/resources/boltstub/v3/write_tx_dead.script',
      9007
    )
    const writer = await boltStub.start(
      './test/resources/boltstub/v3/write_tx.script',
      9008
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')
    const session = driver.session()

    let invocations = 0
    const result = await session.writeTransaction(tx => {
      invocations++
      return tx.run("CREATE (n {name:'Bob'})")
    })

    expect(result.records.length).toEqual(0)
    expect(invocations).toEqual(2)

    await session.close()
    await driver.close()
    await router.exit()
    await brokenWriter.exit()
    await writer.exit()
  })

  it('should retry read transaction until failure', async () => {
    if (!boltStub.supported) {
      return
    }

    const router = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9001
    )
    const brokenReader1 = await boltStub.start(
      './test/resources/boltstub/v3/read_tx_dead.script',
      9005
    )
    const brokenReader2 = await boltStub.start(
      './test/resources/boltstub/v3/read_tx_dead.script',
      9006
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')
    const session = driver.session()

    let clock
    let invocations = 0
    await expectAsync(
      session.readTransaction(tx => {
        invocations++
        if (invocations === 2) {
          // make retries stop after two invocations
          clock = moveTime30SecondsForward()
        }
        return tx.run('MATCH (n) RETURN n.name')
      })
    ).toBeRejectedWith(
      jasmine.objectContaining({
        code: neo4j.error.SESSION_EXPIRED
      })
    )

    removeTimeMocking(clock) // uninstall lolex mocking to make test complete, boltkit uses timers

    expect(invocations).toEqual(2)

    await session.close()
    await driver.close()
    await router.exit()
    await brokenReader1.exit()
    await brokenReader2.exit()
  })

  it('should retry write transaction until failure', async () => {
    if (!boltStub.supported) {
      return
    }

    const router = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9001
    )
    const brokenWriter1 = await boltStub.start(
      './test/resources/boltstub/v3/write_tx_dead.script',
      9007
    )
    const brokenWriter2 = await boltStub.start(
      './test/resources/boltstub/v3/write_tx_dead.script',
      9008
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')
    const session = driver.session()

    let clock = null
    let invocations = 0
    await expectAsync(
      session.writeTransaction(tx => {
        invocations++
        if (invocations === 2) {
          // make retries stop after two invocations
          clock = moveTime30SecondsForward()
        }
        return tx.run("CREATE (n {name:'Bob'})")
      })
    ).toBeRejectedWith(
      jasmine.objectContaining({
        code: neo4j.error.SESSION_EXPIRED
      })
    )

    removeTimeMocking(clock) // uninstall lolex mocking to make test complete, boltStub uses timers

    expect(invocations).toEqual(2)

    await session.close()
    await driver.close()
    await router.exit()
    await brokenWriter1.exit()
    await brokenWriter2.exit()
  })

  it('should retry read transaction and perform rediscovery until success', async () => {
    if (!boltStub.supported) {
      return
    }

    const router1 = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9010
    )
    const brokenReader1 = await boltStub.start(
      './test/resources/boltstub/v3/read_tx_dead.script',
      9005
    )
    const brokenReader2 = await boltStub.start(
      './test/resources/boltstub/v3/read_tx_dead.script',
      9006
    )
    const router2 = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_three_servers_set_3.script',
      9001
    )
    const reader = await boltStub.start(
      './test/resources/boltstub/v3/read_tx.script',
      9002
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9010')
    const session = driver.session()

    let invocations = 0
    const result = await session.readTransaction(tx => {
      invocations++
      return tx.run('MATCH (n) RETURN n.name')
    })

    expect(result.records.length).toEqual(3)
    expect(invocations).toEqual(3)

    await session.close()
    await driver.close()
    await Promise.all(
      [router1, brokenReader1, brokenReader2, router2, reader].map(s =>
        s.exit()
      )
    )
  })

  it('should retry write transaction and perform rediscovery until success', async () => {
    if (!boltStub.supported) {
      return
    }

    const router1 = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9010
    )
    const brokenWriter1 = await boltStub.start(
      './test/resources/boltstub/v3/write_tx_dead.script',
      9007
    )
    const brokenWriter2 = await boltStub.start(
      './test/resources/boltstub/v3/write_tx_dead.script',
      9008
    )
    const router2 = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_three_servers_set_3.script',
      9002
    )
    const writer = await boltStub.start(
      './test/resources/boltstub/v3/write_tx.script',
      9009
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9010')
    const session = driver.session()

    let invocations = 0
    const result = await session.writeTransaction(tx => {
      invocations++
      return tx.run("CREATE (n {name:'Bob'})")
    })

    expect(result.records.length).toEqual(0)
    expect(invocations).toEqual(3)

    await session.close()
    await driver.close()
    await Promise.all(
      [router1, brokenWriter1, brokenWriter2, router2, writer].map(s =>
        s.exit()
      )
    )
  })

  it('should use seed router for rediscovery when all other routers are dead', async () => {
    if (!boltStub.supported) {
      return
    }

    // use scripts that exit eagerly when they are executed to simulate failed servers
    const router1 = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_and_exit.script',
      9010
    )
    const tmpReader = await boltStub.start(
      './test/resources/boltstub/v3/read_and_exit.script',
      9005
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9010')

    // run a dummy query to force routing table initialization
    var session = driver.session({ defaultAccessMode: READ })
    const result1 = await session.run('MATCH (n) RETURN n.name')
    expect(result1.records.length).toEqual(3)
    await session.close()
    // stop existing router and reader
    await router1.exit()
    await tmpReader.exit()

    // start new router on the same port with different script that contains itself as reader
    const router2 = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_self_as_reader.script',
      9010
    )

    session = driver.session({ defaultAccessMode: READ })
    const result2 = await session.readTransaction(tx =>
      tx.run('MATCH (n) RETURN n.name AS name')
    )
    const records = result2.records
    expect(records.length).toEqual(2)
    expect(records[0].get('name')).toEqual('Bob')
    expect(records[1].get('name')).toEqual('Alice')

    await session.close()
    await driver.close()
    await router2.exit()
  })

  it('should use resolved seed router addresses for rediscovery when all other routers are dead', async () => {
    if (!boltStub.supported) {
      return
    }

    const router1 = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_and_exit.script',
      9011
    )
    // start new router on a different port to emulate host name resolution
    // this router uses different script that contains itself as reader
    const router2 = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_self_as_reader.script',
      9009
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9010')
    // make seed address resolve to 3 different addresses (only last one has backing stub server):
    setupFakeHostNameResolution(driver, '127.0.0.1:9010', [
      '127.0.0.1:9011',
      '127.0.0.1:9012',
      '127.0.0.1:9009'
    ])
    const session = driver.session()

    const result = await session.readTransaction(tx =>
      tx.run('MATCH (n) RETURN n.name AS name')
    )

    const records = result.records
    expect(records.length).toEqual(2)
    expect(records[0].get('name')).toEqual('Bob')
    expect(records[1].get('name')).toEqual('Alice')

    await session.close()
    await driver.close()
    await router1.exit()
    await router2.exit()
  })

  it('should send routing context to server', async () => {
    if (!boltStub.supported) {
      return
    }

    const router = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_with_context.script',
      9001
    )

    const driver = boltStub.newDriver(
      'neo4j://127.0.0.1:9001/?policy=my_policy&region=china'
    )
    const session = driver.session()
    const result = await session.run('MATCH (n) RETURN n.name AS name')
    const names = result.records.map(record => record.get('name'))
    expect(names).toEqual(['Alice', 'Bob'])

    await session.close()
    await driver.close()
    await router.exit()
  })

  it('should treat routing table with single router as valid', async () => {
    if (!boltStub.supported) {
      return
    }

    const router = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_one_router.script',
      9010
    )
    const reader1 = await boltStub.start(
      './test/resources/boltstub/v3/read.script',
      9003
    )
    const reader2 = await boltStub.start(
      './test/resources/boltstub/v3/read.script',
      9004
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9010')
    const session = driver.session({ defaultAccessMode: READ })

    const result1 = await session.run('MATCH (n) RETURN n.name')
    expect(result1.records.length).toEqual(3)
    expect(result1.summary.server.address).toEqual('127.0.0.1:9003')

    const result2 = await session.run('MATCH (n) RETURN n.name')
    expect(result2.records.length).toEqual(3)
    expect(result2.summary.server.address).toEqual('127.0.0.1:9004')

    await session.close()
    await driver.close()
    await router.exit()
    await reader1.exit()
    await reader2.exit()
  })

  it('should use routing table without writers for reads', async () => {
    if (!boltStub.supported) {
      return
    }

    const router = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_no_writers.script',
      9001
    )
    const reader = await boltStub.start(
      './test/resources/boltstub/v3/read.script',
      9005
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

    const session = driver.session({ defaultAccessMode: READ })
    const result = await session.run('MATCH (n) RETURN n.name')
    await session.close()
    expect(result.records.map(record => record.get(0))).toEqual([
      'Bob',
      'Alice',
      'Tina'
    ])

    await driver.close()
    await router.exit()
    await reader.exit()
  })

  it('should serve reads but fail writes when no writers available', async () => {
    if (!boltStub.supported) {
      return
    }

    const router1 = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_no_writers.script',
      9001
    )
    const router2 = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_no_writers.script',
      9002
    )
    const reader = await boltStub.start(
      './test/resources/boltstub/v3/read_tx.script',
      9005
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

    const readSession = driver.session()
    const result = await readSession.readTransaction(tx =>
      tx.run('MATCH (n) RETURN n.name')
    )
    await readSession.close()
    expect(result.records.map(record => record.get(0))).toEqual([
      'Bob',
      'Alice',
      'Tina'
    ])

    const writeSession = driver.session({ defaultAccessMode: WRITE })
    await expectAsync(
      writeSession.run("CREATE (n {name:'Bob'})")
    ).toBeRejectedWith(
      jasmine.objectContaining({ code: neo4j.error.SESSION_EXPIRED })
    )

    await driver.close()
    await router1.exit()
    await router2.exit()
    await reader.exit()
  })

  it('should accept routing table without writers and then rediscover', async () => {
    if (!boltStub.supported) {
      return
    }

    // first router does not have itself in the resulting routing table so connection
    // towards it will be closed after rediscovery
    const router1 = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_no_writers.script',
      9001
    )
    const reader = await boltStub.start(
      './test/resources/boltstub/v3/read_tx.script',
      9005
    )
    const writer = await boltStub.start(
      './test/resources/boltstub/v3/write.script',
      9007
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

    const readSession = driver.session()

    const result1 = await readSession.readTransaction(tx =>
      tx.run('MATCH (n) RETURN n.name')
    )
    await readSession.close()
    expect(result1.records.map(record => record.get(0))).toEqual([
      'Bob',
      'Alice',
      'Tina'
    ])

    // start another router which knows about writes, use same address as the initial router
    const router2 = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9002
    )
    const writeSession = driver.session({ defaultAccessMode: WRITE })
    const result2 = await writeSession.run("CREATE (n {name:'Bob'})")
    await writeSession.close()
    expect(result2.records).toEqual([])

    await driver.close()
    await Promise.all([router1, router2, reader, writer].map(s => s.exit()))
  })

  it('should use resolved seed router for discovery after accepting a table without writers', async () => {
    if (!boltStub.supported) {
      return
    }

    const seedRouter = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_no_writers.script',
      9001
    )
    const resolvedSeedRouter = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9020
    )
    const reader = await boltStub.start(
      './test/resources/boltstub/v3/read.script',
      9005
    )
    const writer = await boltStub.start(
      './test/resources/boltstub/v3/write.script',
      9007
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

    const readSession = driver.session({ defaultAccessMode: READ })
    const result1 = await readSession.run('MATCH (n) RETURN n.name')
    await readSession.close()
    expect(result1.records.map(record => record.get(0))).toEqual([
      'Bob',
      'Alice',
      'Tina'
    ])

    setupFakeHostNameResolution(driver, '127.0.0.1:9001', ['127.0.0.1:9020'])

    const writeSession = driver.session({ defaultAccessMode: WRITE })
    const result2 = await writeSession.run("CREATE (n {name:'Bob'})")
    await writeSession.close()
    expect(result2.records).toEqual([])

    await driver.close()
    await Promise.all(
      [seedRouter, resolvedSeedRouter, reader, writer].map(s => s.exit())
    )
  })

  it('should fail rediscovery on auth error', async () => {
    if (!boltStub.supported) {
      return
    }

    const router = await boltStub.start(
      './test/resources/boltstub/v3/no_auth.script',
      9010
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9010')
    const session = driver.session()
    await expectAsync(session.run('RETURN 1')).toBeRejectedWith(
      jasmine.objectContaining({
        code: 'Neo.ClientError.Security.Unauthorized',
        message: 'Some server auth error message'
      })
    )

    await session.close()
    await driver.close()
    await router.exit()
  })

  it('should send multiple bookmarks', async () => {
    if (!boltStub.supported) {
      return
    }

    const router = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9010
    )
    const writer = await boltStub.start(
      './test/resources/boltstub/v3/write_tx_with_multiple_bookmarks.script',
      9007
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9010')

    const bookmarks = [
      'neo4j:bookmark:v1:tx5',
      'neo4j:bookmark:v1:tx29',
      'neo4j:bookmark:v1:tx94',
      'neo4j:bookmark:v1:tx56',
      'neo4j:bookmark:v1:tx16',
      'neo4j:bookmark:v1:tx68'
    ]
    const session = driver.session({ defaultAccessMode: WRITE, bookmarks })
    const tx = session.beginTransaction()

    await tx.run("CREATE (n {name:'Bob'})")
    await tx.commit()
    expect(session.lastBookmark()).toEqual(['neo4j:bookmark:v1:tx95'])

    await session.close()
    await driver.close()
    await router.exit()
    await writer.exit()
  })

  it('should forget writer on database unavailable error', () =>
    testAddressPurgeOnDatabaseError(
      './test/resources/boltstub/v3/write_database_unavailable.script',
      "CREATE (n {name:'Bob'})",
      WRITE
    ))

  it('should forget reader on database unavailable error', () =>
    testAddressPurgeOnDatabaseError(
      './test/resources/boltstub/v3/read_database_unavailable.script',
      'RETURN 1',
      READ
    ))

  it('should use resolver function that returns array during first discovery', () =>
    testResolverFunctionDuringFirstDiscovery(['127.0.0.1:9010']))

  it('should use resolver function that returns promise during first discovery', () =>
    testResolverFunctionDuringFirstDiscovery(
      Promise.resolve(['127.0.0.1:9010'])
    ))

  it('should fail first discovery when configured resolver function throws', () =>
    testResolverFunctionFailureDuringFirstDiscovery(
      () => {
        throw new Error('Broken resolver')
      },
      null,
      'Broken resolver'
    ))

  it('should fail first discovery when configured resolver function returns no addresses', () =>
    testResolverFunctionFailureDuringFirstDiscovery(
      () => [],
      SERVICE_UNAVAILABLE,
      'No routing servers available'
    ))

  it('should fail first discovery when configured resolver function returns a string instead of array of addresses', () =>
    testResolverFunctionFailureDuringFirstDiscovery(
      () => 'Hello',
      null,
      'Configured resolver function should either return an array of addresses'
    ))

  it('should use resolver function during rediscovery when existing routers fail', async () => {
    if (!boltStub.supported) {
      return
    }

    const router1 = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_two_servers_set_1.script',
      9001
    )
    const router2 = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9042
    )
    const reader = await boltStub.start(
      './test/resources/boltstub/v3/read_tx.script',
      9005
    )

    const resolverFunction = address => {
      if (address === '127.0.0.1:9000') {
        return ['127.0.0.1:9010', '127.0.0.1:9001', '127.0.0.1:9042']
      }
      throw new Error(`Unexpected address ${address}`)
    }

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9000', {
      resolver: resolverFunction
    })

    const session = driver.session({ defaultAccessMode: READ })
    // run a query that should trigger discovery against 9001 and then read from it
    const result1 = await session.run('MATCH (n) RETURN n.name AS name')
    expect(result1.records.map(record => record.get(0))).toEqual([
      'Alice',
      'Bob',
      'Eve'
    ])

    // 9001 should now exit and read transaction should fail to read from all existing readers
    // it should then rediscover using addresses from resolver, only 9042 of them works and can respond with table containing reader 9005
    const result2 = await session.readTransaction(tx =>
      tx.run('MATCH (n) RETURN n.name')
    )
    expect(result2.records.map(record => record.get(0))).toEqual([
      'Bob',
      'Alice',
      'Tina'
    ])

    assertHasRouters(driver, [
      '127.0.0.1:9001',
      '127.0.0.1:9002',
      '127.0.0.1:9003'
    ])
    assertHasReaders(driver, ['127.0.0.1:9005', '127.0.0.1:9006'])
    assertHasWriters(driver, ['127.0.0.1:9007', '127.0.0.1:9008'])

    await session.close()
    await driver.close()
    await router1.exit()
    await router2.exit()
    await reader.exit()
  })

  it('should connect to cluster when disableLosslessIntegers is on', () =>
    testDiscoveryAndReadQueryInAutoCommitTx(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      { disableLosslessIntegers: true }
    ))

  it('should send read access mode on query metadata', async () => {
    if (!boltStub.supported) {
      return
    }
    // Given
    const seedServer = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9001
    )
    const readServer = await boltStub.start(
      './test/resources/boltstub/v3/read.script',
      9005
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')
    // When
    const session = driver.session({ defaultAccessMode: READ })
    const res = await session.run('MATCH (n) RETURN n.name')
    await session.close()

    // Then
    expect(res.records[0].get('n.name')).toEqual('Bob')
    expect(res.records[1].get('n.name')).toEqual('Alice')
    expect(res.records[2].get('n.name')).toEqual('Tina')

    await driver.close()
    await seedServer.exit()
    await readServer.exit()
  })

  it('should send read access mode on query metadata with read transaction', async () => {
    if (!boltStub.supported) {
      return
    }
    // Given
    const seedServer = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9001
    )
    const readServer = await boltStub.start(
      './test/resources/boltstub/v3/read_tx.script',
      9005
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')
    // When
    const session = driver.session({ defaultAccessMode: READ })
    const res = await session.readTransaction(tx =>
      tx.run('MATCH (n) RETURN n.name')
    )
    await session.close()

    // Then
    expect(res.records[0].get('n.name')).toEqual('Bob')
    expect(res.records[1].get('n.name')).toEqual('Alice')
    expect(res.records[2].get('n.name')).toEqual('Tina')

    await driver.close()
    await seedServer.exit()
    await readServer.exit()
  })

  it('should not send write access mode on query metadata', async () => {
    if (!boltStub.supported) {
      return
    }
    // Given
    const seedServer = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9001
    )
    const writeServer = await boltStub.start(
      './test/resources/boltstub/v3/write.script',
      9007
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')
    // When
    const session = driver.session({ defaultAccessMode: WRITE })
    await session.run("CREATE (n {name:'Bob'})")

    await session.close()
    await driver.close()
    await seedServer.exit()
    await writeServer.exit()
  })

  it('should not send write access mode on query metadata with write transaction', async () => {
    if (!boltStub.supported) {
      return
    }
    // Given
    const seedServer = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9001
    )
    const writeServer = await boltStub.start(
      './test/resources/boltstub/v3/write_tx.script',
      9007
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')
    // When
    const session = driver.session({ defaultAccessMode: WRITE })
    await session.writeTransaction(tx => tx.run("CREATE (n {name:'Bob'})"))

    await session.close()
    await driver.close()
    await seedServer.exit()
    await writeServer.exit()
  })

  it('should revert to initial router if the only known router returns invalid routing table', async () => {
    if (!boltStub.supported) {
      return
    }

    // the first seed to get the routing table
    // the returned routing table includes a non-reachable read-server and points to only one router
    // which will return an invalid routing table
    const router1 = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_three_servers_set_2.script',
      9001
    )
    // returns an empty routing table
    const router2 = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_no_servers.script',
      9004
    )
    // returns a normal routing table
    const router3 = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints_three_servers_set_1.script',
      9003
    )
    // ordinary read server
    const reader = await boltStub.start(
      './test/resources/boltstub/v3/read_tx.script',
      9002
    )

    const driver = boltStub.newDriver('neo4j://my.virtual.host:8080', {
      resolver: address => ['127.0.0.1:9001', '127.0.0.1:9003']
    })

    const session = driver.session({ defaultAccessMode: READ })
    await session.readTransaction(tx => tx.run('MATCH (n) RETURN n.name'))

    await session.close()
    await driver.close()
    await Promise.all([router1, router2, router3, reader].map(s => s.exit()))
  })

  describe('multi-Database', () => {
    async function verifyDiscoverAndRead (script, database) {
      if (!boltStub.supported) {
        return
      }

      // Given
      const server = await boltStub.start(
        `./test/resources/boltstub/v4/acquire_endpoints_${database ||
          'default_database'}.script`,
        9001
      )
      const readServer = await boltStub.start(
        `./test/resources/boltstub/v4/${script}.script`,
        9005
      )

      const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')
      // When
      const session = driver.session({
        database: database,
        defaultAccessMode: READ
      })
      await session.run('MATCH (n) RETURN n.name')
      await session.close()
      // Then
      expect(hasAddressInConnectionPool(driver, '127.0.0.1:9001')).toBeTruthy()
      expect(hasAddressInConnectionPool(driver, '127.0.0.1:9005')).toBeTruthy()
      assertHasRouters(
        driver,
        ['127.0.0.1:9001', '127.0.0.1:9002', '127.0.0.1:9003'],
        database
      )
      assertHasReaders(driver, ['127.0.0.1:9005', '127.0.0.1:9006'], database)
      assertHasWriters(driver, ['127.0.0.1:9007', '127.0.0.1:9008'], database)

      await driver.close()
      await server.exit()
      await readServer.exit()
    }

    async function verifyDiscoverAndWrite (script, database) {
      if (!boltStub.supported) {
        return
      }

      // Given
      const server = await boltStub.start(
        `./test/resources/boltstub/v4/acquire_endpoints_${database ||
          'default_database'}.script`,
        9001
      )
      const writeServer = await boltStub.start(
        `./test/resources/boltstub/v4/${script}.script`,
        9007
      )

      const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')
      // When
      const session = driver.session({ database: database })
      await session.run("CREATE (n {name:'Bob'})")
      await session.close()
      // Then
      expect(hasAddressInConnectionPool(driver, '127.0.0.1:9001')).toBeTruthy()
      expect(hasAddressInConnectionPool(driver, '127.0.0.1:9007')).toBeTruthy()
      assertHasRouters(
        driver,
        ['127.0.0.1:9001', '127.0.0.1:9002', '127.0.0.1:9003'],
        database
      )
      assertHasReaders(driver, ['127.0.0.1:9005', '127.0.0.1:9006'], database)
      assertHasWriters(driver, ['127.0.0.1:9007', '127.0.0.1:9008'], database)

      await driver.close()
      await server.exit()
      await writeServer.exit()
    }

    it('should discover servers for default database and read', () =>
      verifyDiscoverAndRead('read', ''))

    it('should discover servers for aDatabase and read', () =>
      verifyDiscoverAndRead('read_from_aDatabase', 'aDatabase'))

    it('should discover servers for default database and write', () =>
      verifyDiscoverAndWrite('write', ''))

    it('should discover servers for aDatabase and write', () =>
      verifyDiscoverAndWrite('write_to_aDatabase', 'aDatabase'))

    it('should fail discovery if database not found', async () => {
      if (!boltStub.supported) {
        return
      }

      // Given
      const server = await boltStub.start(
        './test/resources/boltstub/v4/acquire_endpoints_db_not_found.script',
        9001
      )

      const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')
      // When
      const session = driver.session({ database: 'aDatabase' })

      await expectAsync(session.run('CREATE ()')).toBeRejectedWith(
        jasmine.objectContaining({
          code: 'Neo.ClientError.Database.DatabaseNotFound',
          message: 'database not found'
        })
      )

      await session.close()
      await driver.close()
      await server.exit()
    })

    it('should try next server for empty routing table response', async () => {
      if (!boltStub.supported) {
        return
      }

      // Given
      const router1 = await boltStub.start(
        './test/resources/boltstub/v4/acquire_endpoints_aDatabase_no_servers.script',
        9001
      )
      const router2 = await boltStub.start(
        './test/resources/boltstub/v4/acquire_endpoints_aDatabase.script',
        9002
      )
      const reader1 = await boltStub.start(
        './test/resources/boltstub/v4/read_from_aDatabase.script',
        9005
      )

      const driver = boltStub.newDriver('neo4j://127.0.0.1:9000', {
        resolver: address => [
          'neo4j://127.0.0.1:9001',
          'neo4j://127.0.0.1:9002'
        ]
      })

      // When
      const session = driver.session({
        database: 'aDatabase',
        defaultAccessMode: READ
      })
      const result = await session.run('MATCH (n) RETURN n.name')
      expect(result.records.map(record => record.get(0))).toEqual([
        'Bob',
        'Alice',
        'Tina'
      ])

      await session.close()
      await driver.close()
      await router1.exit()
      await router2.exit()
      await reader1.exit()
    })

    it('should use provided bookmarks for the discovery', async () => {
      if (!boltStub.supported) {
        return
      }

      // Given
      const server = await boltStub.start(
        './test/resources/boltstub/v4/acquire_endpoints_aDatabase_with_bookmark.script',
        9001
      )
      const readServer = await boltStub.start(
        './test/resources/boltstub/v4/read_from_aDatabase_with_bookmark.script',
        9005
      )

      const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

      // When
      const session = driver.session({
        database: 'aDatabase',
        defaultAccessMode: READ,
        bookmarks: ['system:1111', 'aDatabase:5555']
      })
      const result = await session.run('MATCH (n) RETURN n.name')

      // Then
      expect(result.records.length).toBe(3)
      expect(session.lastBookmark()).toEqual(['aDatabase:6666'])

      await session.close()
      await driver.close()
      await server.exit()
      await readServer.exit()
    })

    it('should ignore provided bookmarks for the discovery', async () => {
      if (!boltStub.supported) {
        return
      }

      // Given
      const server = await boltStub.start(
        './test/resources/boltstub/v3/acquire_endpoints.script',
        9001
      )
      const readServer = await boltStub.start(
        './test/resources/boltstub/v3/read_with_bookmark.script',
        9005
      )

      const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

      // When
      const session = driver.session({
        defaultAccessMode: READ,
        bookmarks: ['system:1111', 'aDatabase:5555']
      })
      const result = await session.run('MATCH (n) RETURN n.name')

      // Then
      expect(result.records.length).toBe(3)
      expect(session.lastBookmark()).toEqual(['aDatabase:6666'])

      await session.close()
      await driver.close()
      await server.exit()
      await readServer.exit()
    })
  })

  describe('should report whether multi db is supported', () => {
    async function verifySupportsMultiDb (version, expected) {
      if (!boltStub.supported) {
        return
      }

      const server = await boltStub.start(
        `./test/resources/boltstub/${version}/supports_protocol_version.script`,
        9001
      )

      const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

      await expectAsync(driver.supportsMultiDb()).toBeResolvedTo(expected)

      await driver.close()
      await server.exit()
    }

    async function verifySupportsMultiDbWithResolver (version, expected) {
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

      await expectAsync(driver.supportsMultiDb()).toBeResolvedTo(expected)

      await driver.close()
      await server.exit()
    }

    it('v1', () => verifySupportsMultiDb('v1', false))
    it('v2', () => verifySupportsMultiDb('v2', false))
    it('v3', () => verifySupportsMultiDb('v3', false))
    it('v4', () => verifySupportsMultiDb('v4', true))
    it('v1 with resolver', () => verifySupportsMultiDbWithResolver('v1', false))
    it('v2 with resolver', () => verifySupportsMultiDbWithResolver('v2', false))
    it('v3 with resolver', () => verifySupportsMultiDbWithResolver('v3', false))
    it('v4 with resolver', () => verifySupportsMultiDbWithResolver('v4', true))
    it('on error', async () => {
      const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

      await expectAsync(driver.supportsMultiDb()).toBeRejectedWith(
        jasmine.objectContaining({
          code: SESSION_EXPIRED
        })
      )

      await driver.close()
    })
  })

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

    it('v1', () => verifySupportsTransactionConfig('v1', false))
    it('v2', () => verifySupportsTransactionConfig('v2', false))
    it('v3', () => verifySupportsTransactionConfig('v3', true))
    it('v4', () => verifySupportsTransactionConfig('v4', true))
    it('v1 with resolver', () =>
      verifySupportsTransactionConfigWithResolver('v1', false))
    it('v2 with resolver', () =>
      verifySupportsTransactionConfigWithResolver('v2', false))
    it('v3 with resolver', () =>
      verifySupportsTransactionConfigWithResolver('v3', true))
    it('v4 with resolver', () =>
      verifySupportsTransactionConfigWithResolver('v4', true))
    it('on error', async () => {
      const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

      await expectAsync(driver.supportsTransactionConfig()).toBeRejectedWith(
        jasmine.objectContaining({
          code: SESSION_EXPIRED
        })
      )

      await driver.close()
    })
  })

  async function testAddressPurgeOnDatabaseError (script, query, accessMode) {
    if (!boltStub.supported) {
      return
    }

    const router = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9010
    )

    const serverPort = accessMode === READ ? 9005 : 9007
    const serverAddress = '127.0.0.1:' + serverPort
    const server = await boltStub.start(script, serverPort)

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9010')

    const session = driver.session({ defaultAccessMode: accessMode })
    await expectAsync(session.run(query)).toBeRejectedWith(
      jasmine.objectContaining({
        code: 'Neo.TransientError.General.DatabaseUnavailable',
        message: 'Database is busy doing store copy'
      })
    )

    expect(hasAddressInConnectionPool(driver, serverAddress)).toBeFalsy()
    expect(hasRouterInRoutingTable(driver, serverAddress)).toBeFalsy()
    expect(hasReaderInRoutingTable(driver, serverAddress)).toBeFalsy()
    expect(hasWriterInRoutingTable(driver, serverAddress)).toBeFalsy()

    await session.close()
    await driver.close()
    await router.exit()
    await server.exit()
  }

  function moveTime30SecondsForward () {
    const currentTime = Date.now()
    const clock = lolex.install()
    clock.setSystemTime(currentTime + 30 * 1000 + 1)
    return clock
  }

  function removeTimeMocking (clock) {
    if (clock) {
      clock.uninstall()
    }
  }

  async function testWriteSessionWithAccessModeAndBookmark (
    accessMode,
    bookmark
  ) {
    if (!boltStub.supported) {
      return
    }

    const router = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9001
    )
    const writer = await boltStub.start(
      './test/resources/boltstub/v3/write_tx_with_bookmarks.script',
      9007
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:9001')

    // When
    const session = driver.session({
      defaultAccessMode: accessMode,
      bookmarks: [bookmark]
    })
    const tx = session.beginTransaction()
    await tx.run("CREATE (n {name:'Bob'})")
    await tx.commit()

    // Then
    expect(session.lastBookmark()).toEqual(['neo4j:bookmark:v1:tx4242'])

    await session.close()
    await driver.close()
    await router.exit()
    await writer.exit()
  }

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

  async function testRoutingTableAcceptance (clusterMembers, port) {
    if (!boltStub.supported) {
      return
    }

    const { routers, readers, writers } = clusterMembers
    const params = {
      routers: joinStrings(routers),
      readers: joinStrings(readers),
      writers: joinStrings(writers)
    }
    const server = await boltStub.startWithTemplate(
      './test/resources/boltstub/v3/acquire_endpoints_template.script',
      params,
      port
    )

    const driver = boltStub.newDriver('neo4j://127.0.0.1:' + port)

    const session = driver.session()
    const result = await session.run('MATCH (n) RETURN n.name')
    expect(result.summary.server.address).toEqual('127.0.0.1:' + port)

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
    const rememberingRelease = (key, resource) => {
      originalRelease(key, resource)
      releasedConnections.push(resource)
    }
    connectionPool._release = rememberingRelease
  }

  function hasAddressInConnectionPool (driver, address) {
    return getConnectionPool(driver).has(ServerAddress.fromUrl(address))
  }

  function hasRouterInRoutingTable (driver, expectedRouter, database) {
    return (
      getRoutingTable(driver, database).routers.indexOf(
        ServerAddress.fromUrl(expectedRouter)
      ) > -1
    )
  }

  function hasReaderInRoutingTable (driver, expectedReader, database) {
    return (
      getRoutingTable(driver, database).readers.indexOf(
        ServerAddress.fromUrl(expectedReader)
      ) > -1
    )
  }

  function hasWriterInRoutingTable (driver, expectedWriter, database) {
    return (
      getRoutingTable(driver, database).writers.indexOf(
        ServerAddress.fromUrl(expectedWriter)
      ) > -1
    )
  }

  function assertNoRoutingTable (driver, database) {
    expect(getRoutingTable(driver, database)).toBeFalsy()
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

  function setUpMemorizingRoutingTable (driver, database) {
    const memorizingRoutingTable = new MemorizingRoutingTable(
      getRoutingTable(driver, database)
    )
    setRoutingTable(driver, memorizingRoutingTable)
    return memorizingRoutingTable
  }

  function setupFakeHostNameResolution (driver, seedRouter, resolvedAddresses) {
    const connectionProvider = driver._getOrCreateConnectionProvider()
    connectionProvider._hostNameResolver._resolverFunction = function (address) {
      if (address === seedRouter) {
        return Promise.resolve(resolvedAddresses)
      }
      return Promise.reject(
        new Error('Unexpected seed router address ' + address)
      )
    }
  }

  function getConnectionPool (driver) {
    const connectionProvider = driver._getOrCreateConnectionProvider()
    return connectionProvider._connectionPool
  }

  function getRoutingTable (driver, database) {
    const connectionProvider = driver._getOrCreateConnectionProvider()
    return connectionProvider._routingTables[database || '']
  }

  function setRoutingTable (driver, newRoutingTable) {
    const connectionProvider = driver._getOrCreateConnectionProvider()
    connectionProvider._routingTables[
      newRoutingTable.database
    ] = newRoutingTable
  }

  function joinStrings (array) {
    return '[' + array.map(s => '"' + s + '"').join(',') + ']'
  }

  function numberOfOpenConnections (driver) {
    return Object.keys(driver._connectionProvider._openConnections).length
  }

  async function testResolverFunctionDuringFirstDiscovery (resolutionResult) {
    if (!boltStub.supported) {
      return
    }

    const router = await boltStub.start(
      './test/resources/boltstub/v3/acquire_endpoints.script',
      9010
    )
    const reader = await boltStub.start(
      './test/resources/boltstub/v3/read.script',
      9005
    )

    const resolverFunction = address => {
      if (address === 'neo4j.com:7687') {
        return resolutionResult
      }
      throw new Error(`Unexpected address ${address}`)
    }

    const driver = boltStub.newDriver('neo4j://neo4j.com', {
      resolver: resolverFunction
    })

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

  async function testResolverFunctionFailureDuringFirstDiscovery (
    failureFunction,
    expectedCode,
    expectedMessage
  ) {
    if (!boltStub.supported) {
      return
    }

    const expectedError = {}
    if (expectedCode) {
      expectedError.code = expectedCode
    }
    if (expectedMessage) {
      expectedError.message = jasmine.stringMatching(expectedMessage)
    }

    const resolverFunction = address => {
      if (address === 'neo4j.com:8989') {
        return failureFunction()
      }
      throw new Error('Unexpected address')
    }

    const driver = await boltStub.newDriver('neo4j://neo4j.com:8989', {
      resolver: resolverFunction
    })
    const session = driver.session()

    await expectAsync(session.run('RETURN 1')).toBeRejectedWith(
      jasmine.objectContaining(expectedError)
    )

    await session.close()
    await driver.close()
  }

  class MemorizingRoutingTable extends RoutingTable {
    constructor (initialTable) {
      super({
        database: initialTable.database,
        routers: initialTable.routers,
        readers: initialTable.readers,
        writers: initialTable.writers,
        expirationTime: initialTable.expirationTime
      })
      this._forgottenRouters = []
    }

    forgetRouter (address) {
      super.forgetRouter(address)
      this._forgottenRouters.push(address)
    }

    assertForgotRouters (expectedRouters) {
      expect(this._forgottenRouters.map(s => s.asHostPort())).toEqual(
        expectedRouters
      )
    }
  }
})

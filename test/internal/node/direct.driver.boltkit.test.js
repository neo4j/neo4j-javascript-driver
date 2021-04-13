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
import { newError, error } from 'neo4j-driver-core'

const { SERVICE_UNAVAILABLE } = error

xdescribe('#stub-direct direct driver with stub server', () => {
  describe('should run query', () => {
    async function verifyShouldRunQuery (version) {
      if (!boltStub.supported) {
        return
      }

      // Given
      const server = await boltStub.start(
        `./test/resources/boltstub/${version}/return_x.script`,
        9001
      )

      const driver = boltStub.newDriver('bolt://127.0.0.1:9001')
      // When
      const session = driver.session()
      // Then
      const res = await session.run('RETURN $x', { x: 1 })
      expect(res.records[0].get('x').toInt()).toEqual(1)

      await session.close()
      await driver.close()
      await server.exit()
    }

    it('v3', () => verifyShouldRunQuery('v3'), 60000)

    it('v4', () => verifyShouldRunQuery('v4'), 60000)

    it('v4.2', () => verifyShouldRunQuery('v4.2'), 60000)
  })

  it('should use custom user agent', async () => {
    if (!boltStub.supported) {
      return
    }
    const server = await boltStub.start(
      './test/resources/boltstub/v4/hello_custom_user_agent.script',
      9001
    )
    const driver = boltStub.newDriver('bolt://127.0.0.1:9001', {
      userAgent: 'custom user agent'
    })
    const session = driver.session()
    await session.run('MATCH (n) RETURN n.name')
    await driver.close()
    await server.exit()
  }, 60000)

  describe('should not send any routing with hello to disable server routing', () => {
    async function verify (version) {
      if (!boltStub.supported) {
        return
      }

      const router = await boltStub.start(
        `./test/resources/boltstub/${version}/hello_routing_disabled.script`,
        9001
      )

      const driver = boltStub.newDriver('bolt://127.0.0.1:9001')
      const session = driver.session()
      const result = await session.run('MATCH (n) RETURN n.name')

      await session.close()
      await driver.close()
      await router.exit()
    }

    it('v4.1', () => verify('v4.1'), 60000)

    it('v4.2', () => verify('v4.2'), 60000)
  })

  describe('should send and receive bookmark for read transaction', () => {
    async function verifyBookmarkForReadTxc (version) {
      if (!boltStub.supported) {
        return
      }

      const server = await boltStub.start(
        `./test/resources/boltstub/${version}/read_tx_with_bookmarks.script`,
        9001
      )

      const driver = boltStub.newDriver('bolt://127.0.0.1:9001')
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
      await server.exit()
    }

    it('v3', () => verifyBookmarkForReadTxc('v3'), 60000)

    it('v4', () => verifyBookmarkForReadTxc('v4'), 60000)

    it('v4.2', () => verifyBookmarkForReadTxc('v4.2'), 60000)
  })

  describe('should send and receive bookmark for write transaction', () => {
    async function verifyBookmarkForWriteTxc (version) {
      if (!boltStub.supported) {
        return
      }

      const server = await boltStub.start(
        `./test/resources/boltstub/${version}/write_tx_with_bookmarks.script`,
        9001
      )

      const driver = boltStub.newDriver('bolt://127.0.0.1:9001')
      const session = driver.session({
        defaultAccessMode: WRITE,
        bookmarks: ['neo4j:bookmark:v1:tx42']
      })
      const tx = session.beginTransaction()
      const result = await tx.run("CREATE (n {name:'Bob'})")
      const records = result.records
      expect(records.length).toEqual(0)

      await tx.commit()
      expect(session.lastBookmark()).toEqual(['neo4j:bookmark:v1:tx4242'])

      await session.close()
      await driver.close()
      await server.exit()
    }

    it('v3', () => verifyBookmarkForWriteTxc('v3'), 60000)

    it('v4', () => verifyBookmarkForWriteTxc('v4'), 60000)

    it('v4.2', () => verifyBookmarkForWriteTxc('v4.2'), 60000)
  })

  describe('should send and receive bookmark between write and read transactions', () => {
    async function verifyBookmark (version) {
      if (!boltStub.supported) {
        return
      }

      const server = await boltStub.start(
        `./test/resources/boltstub/${version}/write_read_tx_with_bookmarks.script`,
        9001
      )

      const driver = boltStub.newDriver('bolt://127.0.0.1:9001')
      const session = driver.session({
        defaultAccessMode: WRITE,
        bookmarks: ['neo4j:bookmark:v1:tx42']
      })
      const writeTx = session.beginTransaction()
      const result1 = await writeTx.run("CREATE (n {name:'Bob'})")
      const records1 = result1.records
      expect(records1.length).toEqual(0)

      await writeTx.commit()
      expect(session.lastBookmark()).toEqual(['neo4j:bookmark:v1:tx4242'])

      const readTx = session.beginTransaction()
      const result2 = await readTx.run('MATCH (n) RETURN n.name AS name')
      const records2 = result2.records
      expect(records2.length).toEqual(1)
      expect(records2[0].get('name')).toEqual('Bob')

      await readTx.commit()
      expect(session.lastBookmark()).toEqual(['neo4j:bookmark:v1:tx424242'])

      await session.close()
      await driver.close()
      await server.exit()
    }

    it('v3', () => verifyBookmark('v3'), 60000)

    it('v4', () => verifyBookmark('v4'), 60000)

    it('v4.2', () => verifyBookmark('v4.2'), 60000)
  })

  describe('should throw service unavailable when server dies', () => {
    async function verifyServiceUnavailable (version) {
      if (!boltStub.supported) {
        return
      }

      const server = await boltStub.start(
        `./test/resources/boltstub/${version}/read_dead.script`,
        9001
      )

      const driver = boltStub.newDriver('bolt://127.0.0.1:9001')
      const session = driver.session({ defaultAccessMode: READ })
      await expectAsync(
        session.run('MATCH (n) RETURN n.name')
      ).toBeRejectedWith(
        jasmine.objectContaining({
          code: neo4j.error.SERVICE_UNAVAILABLE
        })
      )

      await session.close()
      await driver.close()
      await server.exit()
    }

    it('v3', () => verifyServiceUnavailable('v3'), 60000)

    it('v4', () => verifyServiceUnavailable('v4'), 60000)

    it('v4.2', () => verifyServiceUnavailable('v4.2'), 60000)
  })

  describe('should close connection when RESET fails', () => {
    async function verifyCloseConnection (version) {
      if (!boltStub.supported) {
        return
      }

      const server = await boltStub.start(
        `./test/resources/boltstub/${version}/reset_error.script`,
        9001
      )

      const driver = boltStub.newDriver('bolt://127.0.0.1:9001')
      const session = driver.session()

      const result = await session.run('RETURN 42 AS answer')
      const records = result.records
      expect(records.length).toEqual(1)
      expect(records[0].get(0).toNumber()).toEqual(42)

      await session.close()
      expect(connectionPool(driver, '127.0.0.1:9001').length).toEqual(0)

      await driver.close()
      await server.exit()
    }

    it('v3', () => verifyCloseConnection('v3'), 60000)

    it('v4', () => verifyCloseConnection('v4'), 60000)

    it('v4.2', () => verifyCloseConnection('v4.2'), 60000)
  })

  describe('should send RESET on error', () => {
    async function verifyReset (version) {
      if (!boltStub.supported) {
        return
      }

      const server = await boltStub.start(
        `./test/resources/boltstub/${version}/query_with_error.script`,
        9001
      )

      const driver = boltStub.newDriver('bolt://127.0.0.1:9001')
      const session = driver.session()

      await expectAsync(session.run('RETURN 10 / 0')).toBeRejectedWith(
        jasmine.objectContaining({
          code: 'Neo.ClientError.Statement.ArithmeticError',
          message: '/ by zero'
        })
      )

      await session.close()
      await driver.close()
      await server.exit()
    }

    it('v3', () => verifyReset('v3'), 60000)

    it('v4', () => verifyReset('v4'), 60000)

    it('v4.2', () => verifyReset('v4.2'), 60000)
  })

  describe('should include database connection id in logs', () => {
    async function verifyConnectionId (version) {
      if (!boltStub.supported) {
        return
      }

      const server = await boltStub.start(
        `./test/resources/boltstub/${version}/hello_run_exit.script`,
        9001
      )

      const messages = []
      const logging = {
        level: 'debug',
        logger: (level, message) => messages.push(message)
      }

      const driver = boltStub.newDriver('bolt://127.0.0.1:9001', {
        logging: logging
      })
      const session = driver.session()

      const result = await session.run('MATCH (n) RETURN n.name')

      const names = result.records.map(record => record.get(0))
      expect(names).toEqual(['Foo', 'Bar'])

      await session.close()
      await driver.close()
      await server.exit()

      // logged messages should contain connection_id supplied by the database
      const containsDbConnectionIdMessage = messages.find(message =>
        message.match(/Connection \[[0-9]+]\[bolt-123456789]/)
      )
      if (!containsDbConnectionIdMessage) {
        console.log(messages)
      }
      expect(containsDbConnectionIdMessage).toBeTruthy()
    }

    it('v3', () => verifyConnectionId('v3'), 60000)

    it('v4', () => verifyConnectionId('v4'), 60000)

    it('v4.2', () => verifyConnectionId('v4.2'), 60000)
  })

  describe('should close connection if it dies sitting idle in connection pool', () => {
    async function verifyConnectionCleanup (version) {
      if (!boltStub.supported) {
        return
      }

      const server = await boltStub.start(
        `./test/resources/boltstub/${version}/read.script`,
        9001
      )

      const driver = boltStub.newDriver('bolt://127.0.0.1:9001')
      const session = driver.session({ defaultAccessMode: READ })

      const result = await session.run('MATCH (n) RETURN n.name')
      const records = result.records
      expect(records.length).toEqual(3)
      expect(records[0].get(0)).toBe('Bob')
      expect(records[1].get(0)).toBe('Alice')
      expect(records[2].get(0)).toBe('Tina')

      const connectionKey = Object.keys(openConnections(driver))[0]
      expect(connectionKey).toBeTruthy()

      const connection = openConnections(driver, connectionKey)
      await session.close()

      // generate a fake fatal error
      connection._handleFatalError(
        newError('connection reset', SERVICE_UNAVAILABLE)
      )

      // expect that the connection to be removed from the pool
      expect(connectionPool(driver, '127.0.0.1:9001').length).toEqual(0)
      expect(activeResources(driver, '127.0.0.1:9001')).toBeFalsy()
      // expect that the connection to be unregistered from the open connections registry
      expect(openConnections(driver, connectionKey)).toBeFalsy()

      await driver.close()
      await server.exit()
    }

    it('v3', () => verifyConnectionCleanup('v3'), 60000)

    it('v4', () => verifyConnectionCleanup('v4'), 60000)

    it('v4.2', () => verifyConnectionCleanup('v4.2'), 60000)
  })

  describe('should fail if commit fails due to broken connection', () => {
    async function verifyFailureOnCommit (version) {
      if (!boltStub.supported) {
        return
      }

      const server = await boltStub.start(
        `./test/resources/boltstub/${version}/connection_error_on_commit.script`,
        9001
      )

      const driver = boltStub.newDriver('bolt://127.0.0.1:9001')
      const session = driver.session()

      const writeTx = session.beginTransaction()
      await writeTx.run("CREATE (n {name: 'Bob'})")

      await expectAsync(writeTx.commit()).toBeRejectedWith(
        jasmine.objectContaining({
          code: neo4j.error.SERVICE_UNAVAILABLE
        })
      )

      await session.close()
      await driver.close()
      await server.exit()
    }

    it('v3', () => verifyFailureOnCommit('v3'), 60000)
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

      const driver = boltStub.newDriver('bolt://127.0.0.1:9001')

      await expectAsync(driver.supportsMultiDb()).toBeResolvedTo(expected)

      await driver.close()
      await server.exit()
    }

    it('v3', () => verifySupportsMultiDb('v3', false), 60000)
    it('v4', () => verifySupportsMultiDb('v4', true), 60000)
    it('v4.2', () => verifySupportsMultiDb('v4.2', true), 60000)
    it('on error', async () => {
      const driver = boltStub.newDriver('bolt://127.0.0.1:9001')

      await expectAsync(driver.supportsMultiDb()).toBeRejectedWith(
        jasmine.objectContaining({
          code: SERVICE_UNAVAILABLE
        })
      )

      await driver.close()
    }, 60000)
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

      const driver = boltStub.newDriver('bolt://127.0.0.1:9001')

      await expectAsync(driver.supportsTransactionConfig()).toBeResolvedTo(
        expected
      )

      await driver.close()
      await server.exit()
    }

    it('v3', () => verifySupportsTransactionConfig('v3', true), 60000)
    it('v4', () => verifySupportsTransactionConfig('v4', true), 60000)
    it('v4.2', () => verifySupportsTransactionConfig('v4.2', true), 60000)
    it('on error', async () => {
      const driver = boltStub.newDriver('bolt://127.0.0.1:9001')

      await expectAsync(driver.supportsTransactionConfig()).toBeRejectedWith(
        jasmine.objectContaining({
          code: SERVICE_UNAVAILABLE
        })
      )

      await driver.close()
    }, 60000)
  })

  describe('should allow to change fetch size', () => {
    async function verifyFailureOnCommit (version) {
      if (!boltStub.supported) {
        return
      }

      const server = await boltStub.start(
        `./test/resources/boltstub/${version}/read_in_batch.script`,
        9001
      )

      const driver = boltStub.newDriver('bolt://127.0.0.1:9001', {
        fetchSize: 2
      })
      const session = driver.session({ defaultAccessMode: READ })

      const result = await session.run('MATCH (n) RETURN n.name')
      const records = result.records
      expect(records.length).toEqual(3)
      expect(records[0].get(0)).toBe('Bob')
      expect(records[1].get(0)).toBe('Alice')
      expect(records[2].get(0)).toBe('Tina')

      const connectionKey = Object.keys(openConnections(driver))[0]
      expect(connectionKey).toBeTruthy()

      const connection = openConnections(driver, connectionKey)
      await session.close()

      // generate a fake fatal error
      connection._handleFatalError(
        newError('connection reset', SERVICE_UNAVAILABLE)
      )

      // expect that the connection to be removed from the pool
      expect(connectionPool(driver, '127.0.0.1:9001').length).toEqual(0)
      expect(activeResources(driver, '127.0.0.1:9001')).toBeFalsy()
      // expect that the connection to be unregistered from the open connections registry
      expect(openConnections(driver, connectionKey)).toBeFalsy()

      await driver.close()
      await server.exit()
    }

    it('v4', () => verifyFailureOnCommit('v4'), 60000)
    it('v4.2', () => verifyFailureOnCommit('v4.2'), 60000)
  })

  describe('should stream in many batches', () => {
    async function verifyFailureOnCommit (version) {
      if (!boltStub.supported) {
        return
      }

      const server = await boltStub.start(
        `./test/resources/boltstub/${version}/read_in_batch.script`,
        9001
      )

      const driver = boltStub.newDriver('bolt://127.0.0.1:9001')
      const session = driver.session({ defaultAccessMode: READ, fetchSize: 2 })

      const result = await session.run('MATCH (n) RETURN n.name')
      const records = result.records
      expect(records.length).toEqual(3)
      expect(records[0].get(0)).toBe('Bob')
      expect(records[1].get(0)).toBe('Alice')
      expect(records[2].get(0)).toBe('Tina')

      const connectionKey = Object.keys(openConnections(driver))[0]
      expect(connectionKey).toBeTruthy()

      const connection = openConnections(driver, connectionKey)
      await session.close()

      // generate a fake fatal error
      connection._handleFatalError(
        newError('connection reset', SERVICE_UNAVAILABLE)
      )

      // expect that the connection to be removed from the pool
      expect(connectionPool(driver, '127.0.0.1:9001').length).toEqual(0)
      expect(activeResources(driver, '127.0.0.1:9001')).toBeFalsy()
      // expect that the connection to be unregistered from the open connections registry
      expect(openConnections(driver, connectionKey)).toBeFalsy()

      await driver.close()
      await server.exit()
    }

    it('v4', () => verifyFailureOnCommit('v4'), 60000)
    it('v4.2', () => verifyFailureOnCommit('v4.2'), 60000)
  })

  describe('should ignore fetchSize setting', () => {
    async function verifyFailureOnCommit (version) {
      if (!boltStub.supported) {
        return
      }

      const server = await boltStub.start(
        `./test/resources/boltstub/${version}/read.script`,
        9001
      )

      const driver = boltStub.newDriver('bolt://127.0.0.1:9001')
      const session = driver.session({ defaultAccessMode: READ, fetchSize: 2 })

      const result = await session.run('MATCH (n) RETURN n.name')
      const records = result.records
      expect(records.length).toEqual(3)
      expect(records[0].get(0)).toBe('Bob')
      expect(records[1].get(0)).toBe('Alice')
      expect(records[2].get(0)).toBe('Tina')

      const connectionKey = Object.keys(openConnections(driver))[0]
      expect(connectionKey).toBeTruthy()

      const connection = openConnections(driver, connectionKey)
      await session.close()

      // generate a fake fatal error
      connection._handleFatalError(
        newError('connection reset', SERVICE_UNAVAILABLE)
      )

      // expect that the connection to be removed from the pool
      expect(connectionPool(driver, '127.0.0.1:9001').length).toEqual(0)
      expect(activeResources(driver, '127.0.0.1:9001')).toBeFalsy()
      // expect that the connection to be unregistered from the open connections registry
      expect(openConnections(driver, connectionKey)).toBeFalsy()

      await driver.close()
      await server.exit()
    }

    it('v3', () => verifyFailureOnCommit('v3'), 60000)
  })

  describe('should cancel stream with result summary method', () => {
    async function verifyFailureOnCommit (version) {
      if (!boltStub.supported) {
        return
      }

      const server = await boltStub.start(
        `./test/resources/boltstub/${version}/read_discard.script`,
        9001
      )

      const driver = boltStub.newDriver('bolt://127.0.0.1:9001')
      const session = driver.session({ defaultAccessMode: READ, fetchSize: 2 })

      const result = session.run('MATCH (n) RETURN n.name')
      await result.summary()
      const records = (await result).records
      expect(records.length).toEqual(2)
      expect(records[0].get(0)).toBe('Bob')
      expect(records[1].get(0)).toBe('Alice')

      const connectionKey = Object.keys(openConnections(driver))[0]
      expect(connectionKey).toBeTruthy()

      const connection = openConnections(driver, connectionKey)
      await session.close()

      // generate a fake fatal error
      connection._handleFatalError(
        newError('connection reset', SERVICE_UNAVAILABLE)
      )

      // expect that the connection to be removed from the pool
      expect(connectionPool(driver, '127.0.0.1:9001').length).toEqual(0)
      expect(activeResources(driver, '127.0.0.1:9001')).toBeFalsy()
      // expect that the connection to be unregistered from the open connections registry
      expect(openConnections(driver, connectionKey)).toBeFalsy()

      await driver.close()
      await server.exit()
    }

    it('v4', () => verifyFailureOnCommit('v4'), 60000)
    it('v4.2', () => verifyFailureOnCommit('v4.2'), 60000)
  })

  describe('should cancel stream with tx commit', () => {
    async function verifyFailureOnCommit (version) {
      if (!boltStub.supported) {
        return
      }

      const server = await boltStub.start(
        `./test/resources/boltstub/${version}/read_tx_discard.script`,
        9001
      )

      const driver = boltStub.newDriver('bolt://127.0.0.1:9001')
      const session = driver.session({ defaultAccessMode: READ, fetchSize: 2 })
      const tx = session.beginTransaction()

      const result = tx.run('MATCH (n) RETURN n.name')
      await tx.commit()

      // Client will receive a partial result
      const records = (await result).records
      expect(records.length).toEqual(2)
      expect(records[0].get(0)).toBe('Bob')
      expect(records[1].get(0)).toBe('Alice')

      const connectionKey = Object.keys(openConnections(driver))[0]
      expect(connectionKey).toBeTruthy()

      const connection = openConnections(driver, connectionKey)
      await session.close()

      // generate a fake fatal error
      connection._handleFatalError(
        newError('connection reset', SERVICE_UNAVAILABLE)
      )

      // expect that the connection to be removed from the pool
      expect(connectionPool(driver, '127.0.0.1:9001').length).toEqual(0)
      expect(activeResources(driver, '127.0.0.1:9001')).toBeFalsy()
      // expect that the connection to be unregistered from the open connections registry
      expect(openConnections(driver, connectionKey)).toBeFalsy()

      await driver.close()
      await server.exit()
    }

    it('v4', () => verifyFailureOnCommit('v4'), 60000)
    it('v4.2', () => verifyFailureOnCommit('v4.2'), 60000)
  })

  function connectionPool (driver, key) {
    return driver._connectionProvider._connectionPool._pools[key]
  }

  function openConnections (driver, key) {
    const connections = driver._connectionProvider._openConnections
    if (key) {
      return connections[key]
    }
    return connections
  }

  function activeResources (driver, key) {
    const resources =
      driver._connectionProvider._connectionPool._activeResourceCounts
    if (key) {
      return resources[key]
    }
    return resources
  }
})

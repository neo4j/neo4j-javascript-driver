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

import { READ } from '../../../src/driver'
import boltStub from '../bolt-stub'
import { newError, error } from 'neo4j-driver-core'

const { SERVICE_UNAVAILABLE } = error

describe('#stub-direct direct driver with stub server', () => {
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

  describe('should report whether user impersonation is supported', () => {
    async function verifySupportsUserImpersonation (version, expected) {
      if (!boltStub.supported) {
        return
      }

      const server = await boltStub.start(
        `./test/resources/boltstub/${version}/supports_protocol_version.script`,
        9001
      )

      const driver = boltStub.newDriver('bolt://127.0.0.1:9001')

      await expectAsync(driver.supportsUserImpersonation()).toBeResolvedTo(
        expected
      )

      await driver.close()
      await server.exit()
    }

    it('v3', () => verifySupportsUserImpersonation('v3', false), 60000)
    it('v4', () => verifySupportsUserImpersonation('v4', false), 60000)
    it('v4.2', () => verifySupportsUserImpersonation('v4.2', false), 60000)
    it('on error', async () => {
      const driver = boltStub.newDriver('bolt://127.0.0.1:9001')

      await expectAsync(driver.supportsUserImpersonation()).toBeRejectedWith(
        jasmine.objectContaining({
          code: SERVICE_UNAVAILABLE
        })
      )

      await driver.close()
    }, 60000)
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

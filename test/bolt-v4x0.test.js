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

import neo4j from '../src'
import sharedNeo4j from './internal/shared-neo4j'

describe('#integration Bolt V4.0 API', () => {
  let driver
  let session
  let protocolVersion

  beforeEach(async () => {
    driver = neo4j.driver(
      `bolt://${sharedNeo4j.hostname}`,
      sharedNeo4j.authToken
    )
    session = driver.session()

    protocolVersion = await sharedNeo4j.cleanupAndGetProtocolVersion(driver)
  })

  afterEach(async () => {
    await session.close()
    await driver.close()
  })

  describe('multi-database', () => {
    describe('earlier versions', () => {
      it('should fail run if not supported', done => {
        if (databaseSupportsBoltV4()) {
          done()
          return
        }

        const session = driver.session({ database: 'adb' })

        session
          .run('RETURN 1')
          .then(() => done.fail('Failure expected'))
          .catch(error => {
            expectBoltV4NotSupportedError(error)
            done()
          })
      }, 20000)

      it('should fail beginTransaction if not supported', done => {
        if (databaseSupportsBoltV4()) {
          done()
          return
        }

        const session = driver.session({ database: 'adb' })
        const tx = session.beginTransaction()

        tx.run('RETURN 1')
          .then(() => done.fail('Failure expected'))
          .catch(error => {
            expectBoltV4NotSupportedError(error)
            done()
          })
      }, 20000)

      it('should fail readTransaction if not supported', done => {
        if (databaseSupportsBoltV4()) {
          done()
          return
        }

        const session = driver.session({ database: 'adb' })

        session
          .readTransaction(tx => tx.run('RETURN 1'))
          .then(() => done.fail('Failure expected'))
          .catch(error => {
            expectBoltV4NotSupportedError(error)
            done()
          })
      }, 20000)

      it('should fail writeTransaction if not supported', done => {
        if (databaseSupportsBoltV4()) {
          done()
          return
        }

        const session = driver.session({ database: 'adb' })

        session
          .writeTransaction(tx => tx.run('RETURN 1'))
          .then(() => done.fail('Failure expected'))
          .catch(error => {
            expectBoltV4NotSupportedError(error)
            done()
          })
      }, 20000)

      it('should return database.name as null in result summary', async () => {
        if (databaseSupportsBoltV4()) {
          return
        }

        const session = driver.session()
        const result = await session.readTransaction(tx => tx.run('RETURN 1'))

        expect(result.summary.database).toBeTruthy()
        expect(result.summary.database.name).toBeNull()
      }, 20000)
    })

    it('should fail if connecting to a non-existing database', async () => {
      if (!databaseSupportsBoltV4()) {
        return
      }

      const neoSession = driver.session({ database: 'testdb' })

      try {
        await neoSession.run('RETURN 1')

        fail('failure expected')
      } catch (error) {
        expect(error.code).toContain('DatabaseNotFound')
      } finally {
        await neoSession.close()
      }
    }, 20000)

    describe('default database', function () {
      it('should return database name in summary', async () => {
        await testDatabaseNameInSummary(null)
      }, 20000)
    })

    describe('neo4j database', () => {
      it('should return database name in summary', async () => {
        await testDatabaseNameInSummary('neo4j')
      }, 20000)

      it('should be able to create a node', async () => {
        if (!databaseSupportsBoltV4()) {
          return
        }

        const neoSession = driver.session({ database: 'neo4j' })

        try {
          const result = await session.run(
            'CREATE (n { name: $name }) RETURN n.name',
            { name: 'neo4j' }
          )

          expect(result.records.length).toBe(1)
          expect(result.records[0].get('n.name')).toBe('neo4j')
        } finally {
          await neoSession.close()
        }
      }, 20000)

      it('should be able to connect single instance using neo4j scheme', async () => {
        if (!databaseSupportsBoltV4()) {
          return
        }

        const neoDriver = neo4j.driver(
          'neo4j://localhost',
          sharedNeo4j.authToken
        )
        const neoSession = driver.session({ database: 'neo4j' })

        try {
          const result = await session.run(
            'CREATE (n { name: $name }) RETURN n.name',
            { name: 'neo4j' }
          )

          expect(result.records.length).toBe(1)
          expect(result.records[0].get('n.name')).toBe('neo4j')
        } finally {
          await neoSession.close()
          await neoDriver.close()
        }
      }, 20000)
    })
  })

  async function testDatabaseNameInSummary (database) {
    if (!databaseSupportsBoltV4()) {
      return
    }

    const neoSession = database
      ? driver.session({ database })
      : driver.session()

    try {
      const result = await neoSession.run('CREATE (n { id: $id }) RETURN n', {
        id: 5
      })

      expect(result.summary.database).toBeTruthy()
      expect(result.summary.database.name).toBe(database || 'neo4j')
    } finally {
      await neoSession.close()
    }
  }

  function expectBoltV4NotSupportedError (error) {
    expect(
      error.message.indexOf(
        'Driver is connected to the database that does not support multiple databases'
      )
    ).toBeGreaterThan(-1)
  }

  function databaseSupportsBoltV4 () {
    return protocolVersion >= 4.0
  }
})

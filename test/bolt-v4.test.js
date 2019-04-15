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

import neo4j from '../src'
import sharedNeo4j from './internal/shared-neo4j'
import { ServerVersion, VERSION_4_0_0 } from '../src/internal/server-version'

describe('Bolt V4 API', () => {
  let driver
  let session
  let serverVersion
  let originalTimeout

  beforeEach(done => {
    driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken)
    session = driver.session()
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000

    session.run('MATCH (n) DETACH DELETE n').then(result => {
      serverVersion = ServerVersion.fromString(result.summary.server.version)
      done()
    })
  })

  afterEach(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout
    session.close()
    driver.close()
  })

  describe('multi-database', () => {
    describe('earlier versions', () => {
      it('should fail run if not supported', done => {
        if (databaseSupportsBoltV4()) {
          done()
          return
        }

        const session = driver.session({ db: 'adb' })

        session
          .run('RETURN 1')
          .then(() => done.fail('Failure expected'))
          .catch(error => {
            expectBoltV4NotSupportedError(error)
            session.close()
            done()
          })
      })

      it('should fail beginTransaction if not supported', done => {
        if (databaseSupportsBoltV4()) {
          done()
          return
        }

        const session = driver.session({ db: 'adb' })
        const tx = session.beginTransaction()

        tx.run('RETURN 1')
          .then(() => done.fail('Failure expected'))
          .catch(error => {
            expectBoltV4NotSupportedError(error)
            session.close()
            done()
          })
      })

      it('should fail readTransaction if not supported', done => {
        if (databaseSupportsBoltV4()) {
          done()
          return
        }

        const session = driver.session({ db: 'adb' })

        session
          .readTransaction(tx => tx.run('RETURN 1'))
          .then(() => done.fail('Failure expected'))
          .catch(error => {
            expectBoltV4NotSupportedError(error)
            session.close()
            done()
          })
      })

      it('should fail writeTransaction if not supported', done => {
        if (databaseSupportsBoltV4()) {
          done()
          return
        }

        const session = driver.session({ db: 'adb' })

        session
          .writeTransaction(tx => tx.run('RETURN 1'))
          .then(() => done.fail('Failure expected'))
          .catch(error => {
            expectBoltV4NotSupportedError(error)
            session.close()
            done()
          })
      })
    })

    it('should fail if connecting to a non-existing database', done => {
      if (!databaseSupportsBoltV4()) {
        done()
        return
      }

      const neoSession = driver.session({ db: 'testdb' })

      neoSession
        .run('RETURN 1')
        .then(result => {
          done.fail('Failure expected')
        })
        .catch(error => {
          expect(error.code).toContain('DatabaseNotFound')
          done()
        })
        .finally(() => neoSession.close())
    })

    describe('neo4j database', () => {
      it('should be able to create a node', done => {
        if (!databaseSupportsBoltV4()) {
          done()
          return
        }

        const neoSession = driver.session({ db: 'neo4j' })

        neoSession
          .run('CREATE (n { db: $db }) RETURN n.db', { db: 'neo4j' })
          .then(result => {
            expect(result.records.length).toBe(1)
            expect(result.records[0].get('n.db')).toBe('neo4j')
            done()
          })
          .catch(error => {
            done.fail(error)
          })
          .finally(() => neoSession.close())
      })
    })
  })

  function expectBoltV4NotSupportedError (error) {
    expect(
      error.message.indexOf(
        'Driver is connected to the database that does not support multiple databases'
      )
    ).toBeGreaterThan(-1)
  }

  function databaseSupportsBoltV4 () {
    return serverVersion.compareTo(VERSION_4_0_0) >= 0
  }
})

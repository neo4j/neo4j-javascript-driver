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

import neo4j from '../../../src'
import { READ, WRITE } from '../../../src/driver'
import boltStub from '../bolt-stub'
import { newError, SERVICE_UNAVAILABLE } from '../../../src/error'

describe('direct driver with stub server', () => {
  let originalTimeout

  beforeAll(() => {
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000
  })

  afterAll(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout
  })

  describe('should run query', () => {
    function verifyShouldRunQuery (version, done) {
      if (!boltStub.supported) {
        done()
        return
      }

      // Given
      const server = boltStub.start(
        `./test/resources/boltstub/${version}/return_x.script`,
        9001
      )

      boltStub.run(() => {
        const driver = boltStub.newDriver('bolt://127.0.0.1:9001')
        // When
        const session = driver.session()
        // Then
        session.run('RETURN $x', { x: 1 }).then(res => {
          expect(res.records[0].get('x').toInt()).toEqual(1)
          session.close()
          driver.close()
          server.exit(code => {
            expect(code).toEqual(0)
            done()
          })
        })
      })
    }

    it('v2', done => {
      verifyShouldRunQuery('v2', done)
    })

    it('v3', done => {
      verifyShouldRunQuery('v3', done)
    })

    it('v4', done => {
      verifyShouldRunQuery('v4', done)
    })
  })

  describe('should send and receive bookmark for read transaction', () => {
    function verifyBookmarkForReadTxc (version, done) {
      if (!boltStub.supported) {
        done()
        return
      }

      const server = boltStub.start(
        `./test/resources/boltstub/${version}/read_tx_with_bookmarks.script`,
        9001
      )

      boltStub.run(() => {
        const driver = boltStub.newDriver('bolt://127.0.0.1:9001')
        const session = driver.session({
          defaultAccessMode: READ,
          bookmarks: ['neo4j:bookmark:v1:tx42']
        })
        const tx = session.beginTransaction()
        tx.run('MATCH (n) RETURN n.name AS name').then(result => {
          const records = result.records
          expect(records.length).toEqual(2)
          expect(records[0].get('name')).toEqual('Bob')
          expect(records[1].get('name')).toEqual('Alice')

          tx.commit().then(() => {
            expect(session.lastBookmark()).toEqual('neo4j:bookmark:v1:tx4242')

            session.close(() => {
              driver.close()
              server.exit(code => {
                expect(code).toEqual(0)
                done()
              })
            })
          })
        })
      })
    }

    it('v2', done => {
      verifyBookmarkForReadTxc('v2', done)
    })

    it('v3', done => {
      verifyBookmarkForReadTxc('v3', done)
    })

    it('v4', done => {
      verifyBookmarkForReadTxc('v4', done)
    })
  })

  describe('should send and receive bookmark for write transaction', () => {
    function verifyBookmarkForWriteTxc (version, done) {
      if (!boltStub.supported) {
        done()
        return
      }

      const server = boltStub.start(
        `./test/resources/boltstub/${version}/write_tx_with_bookmarks.script`,
        9001
      )

      boltStub.run(() => {
        const driver = boltStub.newDriver('bolt://127.0.0.1:9001')
        const session = driver.session({
          defaultAccessMode: WRITE,
          bookmarks: ['neo4j:bookmark:v1:tx42']
        })
        const tx = session.beginTransaction()
        tx.run("CREATE (n {name:'Bob'})").then(result => {
          const records = result.records
          expect(records.length).toEqual(0)

          tx.commit().then(() => {
            expect(session.lastBookmark()).toEqual('neo4j:bookmark:v1:tx4242')

            session.close(() => {
              driver.close()
              server.exit(code => {
                expect(code).toEqual(0)
                done()
              })
            })
          })
        })
      })
    }

    it('v2', done => {
      verifyBookmarkForWriteTxc('v2', done)
    })

    it('v3', done => {
      verifyBookmarkForWriteTxc('v3', done)
    })

    it('v4', done => {
      verifyBookmarkForWriteTxc('v4', done)
    })
  })

  describe('should send and receive bookmark between write and read transactions', () => {
    function verifyBookmark (version, done) {
      if (!boltStub.supported) {
        done()
        return
      }

      const server = boltStub.start(
        `./test/resources/boltstub/${version}/write_read_tx_with_bookmarks.script`,
        9001
      )

      boltStub.run(() => {
        const driver = boltStub.newDriver('bolt://127.0.0.1:9001')
        const session = driver.session({
          defaultAccessMode: WRITE,
          bookmarks: ['neo4j:bookmark:v1:tx42']
        })
        const writeTx = session.beginTransaction()
        writeTx.run("CREATE (n {name:'Bob'})").then(result => {
          const records = result.records
          expect(records.length).toEqual(0)

          writeTx.commit().then(() => {
            expect(session.lastBookmark()).toEqual('neo4j:bookmark:v1:tx4242')

            const readTx = session.beginTransaction()
            readTx.run('MATCH (n) RETURN n.name AS name').then(result => {
              const records = result.records
              expect(records.length).toEqual(1)
              expect(records[0].get('name')).toEqual('Bob')

              readTx.commit().then(() => {
                expect(session.lastBookmark()).toEqual(
                  'neo4j:bookmark:v1:tx424242'
                )

                session.close(() => {
                  driver.close()
                  server.exit(code => {
                    expect(code).toEqual(0)
                    done()
                  })
                })
              })
            })
          })
        })
      })
    }

    it('v2', done => {
      verifyBookmark('v2', done)
    })

    it('v3', done => {
      verifyBookmark('v3', done)
    })

    it('v4', done => {
      verifyBookmark('v4', done)
    })
  })

  describe('should throw service unavailable when server dies', () => {
    function verifyServiceUnavailable (version, done) {
      if (!boltStub.supported) {
        done()
        return
      }

      const server = boltStub.start(
        `./test/resources/boltstub/${version}/read_dead.script`,
        9001
      )

      boltStub.run(() => {
        const driver = boltStub.newDriver('bolt://127.0.0.1:9001')
        const session = driver.session({ defaultAccessMode: READ })
        session.run('MATCH (n) RETURN n.name').catch(error => {
          expect(error.code).toEqual(neo4j.error.SERVICE_UNAVAILABLE)

          driver.close()
          server.exit(code => {
            expect(code).toEqual(0)
            done()
          })
        })
      })
    }

    it('v2', done => {
      verifyServiceUnavailable('v2', done)
    })

    it('v3', done => {
      verifyServiceUnavailable('v3', done)
    })

    it('v4', done => {
      verifyServiceUnavailable('v4', done)
    })
  })

  describe('should close connection when RESET fails', () => {
    function verifyCloseConnection (version, done) {
      if (!boltStub.supported) {
        done()
        return
      }

      const server = boltStub.start(
        `./test/resources/boltstub/${version}/reset_error.script`,
        9001
      )

      boltStub.run(() => {
        const driver = boltStub.newDriver('bolt://127.0.0.1:9001')
        const session = driver.session()

        session
          .run('RETURN 42 AS answer')
          .then(result => {
            const records = result.records
            expect(records.length).toEqual(1)
            expect(records[0].get(0).toNumber()).toEqual(42)
            session.close(() => {
              expect(driver._pool._pools['127.0.0.1:9001'].length).toEqual(0)
              driver.close()
              server.exit(code => {
                expect(code).toEqual(0)
                done()
              })
            })
          })
          .catch(error => done.fail(error))
      })
    }

    it('v2', done => {
      verifyCloseConnection('v2', done)
    })

    it('v3', done => {
      verifyCloseConnection('v3', done)
    })

    it('v4', done => {
      verifyCloseConnection('v4', done)
    })
  })

  describe('should send RESET on error', () => {
    function verifyReset (version, done) {
      if (!boltStub.supported) {
        done()
        return
      }

      const server = boltStub.start(
        `./test/resources/boltstub/${version}/query_with_error.script`,
        9001
      )

      boltStub.run(() => {
        const driver = boltStub.newDriver('bolt://127.0.0.1:9001')
        const session = driver.session()

        session
          .run('RETURN 10 / 0')
          .then(result => {
            done.fail(
              'Should fail but received a result: ' + JSON.stringify(result)
            )
          })
          .catch(error => {
            expect(error.code).toEqual(
              'Neo.ClientError.Statement.ArithmeticError'
            )
            expect(error.message).toEqual('/ by zero')

            session.close(() => {
              driver.close()
              server.exit(code => {
                expect(code).toEqual(0)
                done()
              })
            })
          })
      })
    }

    it('v2', done => {
      verifyReset('v2', done)
    })

    it('v3', done => {
      verifyReset('v3', done)
    })

    it('v4', done => {
      verifyReset('v4', done)
    })
  })

  describe('should include database connection id in logs', () => {
    function verifyConnectionId (version, done) {
      if (!boltStub.supported) {
        done()
        return
      }

      const server = boltStub.start(
        `./test/resources/boltstub/${version}/hello_run_exit.script`,
        9001
      )

      boltStub.run(() => {
        const messages = []
        const logging = {
          level: 'debug',
          logger: (level, message) => messages.push(message)
        }

        const driver = boltStub.newDriver('bolt://127.0.0.1:9001', {
          logging: logging
        })
        const session = driver.session()

        session
          .run('MATCH (n) RETURN n.name')
          .then(result => {
            const names = result.records.map(record => record.get(0))
            expect(names).toEqual(['Foo', 'Bar'])
            session.close(() => {
              driver.close()
              server.exit(code => {
                expect(code).toEqual(0)

                // logged messages should contain connection_id supplied by the database
                const containsDbConnectionIdMessage = messages.find(message =>
                  message.match(/Connection \[[0-9]+]\[bolt-123456789]/)
                )
                if (!containsDbConnectionIdMessage) {
                  console.log(messages)
                }
                expect(containsDbConnectionIdMessage).toBeTruthy()

                done()
              })
            })
          })
          .catch(error => done.fail(error))
      })
    }

    it('v3', done => {
      verifyConnectionId('v3', done)
    })

    it('v4', done => {
      verifyConnectionId('v4', done)
    })
  })

  describe('should close connection if it dies sitting idle in connection pool', () => {
    function verifyConnectionCleanup (version, done) {
      if (!boltStub.supported) {
        done()
        return
      }

      const server = boltStub.start(
        `./test/resources/boltstub/${version}/read.script`,
        9001
      )

      boltStub.run(() => {
        const driver = boltStub.newDriver('bolt://127.0.0.1:9001')
        const session = driver.session({ defaultAccessMode: READ })

        session
          .run('MATCH (n) RETURN n.name')
          .then(result => {
            const records = result.records
            expect(records.length).toEqual(3)
            expect(records[0].get(0)).toBe('Bob')
            expect(records[1].get(0)).toBe('Alice')
            expect(records[2].get(0)).toBe('Tina')

            const connectionKey = Object.keys(driver._openConnections)[0]
            expect(connectionKey).toBeTruthy()

            const connection = driver._openConnections[connectionKey]
            session.close(() => {
              // generate a fake fatal error
              connection._handleFatalError(
                newError('connection reset', SERVICE_UNAVAILABLE)
              )

              // expect that the connection to be removed from the pool
              expect(driver._pool._pools['127.0.0.1:9001'].length).toEqual(0)
              expect(
                driver._pool._activeResourceCounts['127.0.0.1:9001']
              ).toBeFalsy()
              // expect that the connection to be unregistered from the open connections registry
              expect(driver._openConnections[connectionKey]).toBeFalsy()
              driver.close()
              server.exit(code => {
                expect(code).toEqual(0)
                done()
              })
            })
          })
          .catch(error => done.fail(error))
      })
    }

    it('v2', done => {
      verifyConnectionCleanup('v2', done)
    })

    it('v3', done => {
      verifyConnectionCleanup('v3', done)
    })

    it('v4', done => {
      verifyConnectionCleanup('v4', done)
    })
  })

  describe('should fail if commit fails due to broken connection', () => {
    function verifyFailureOnCommit (version, done) {
      if (!boltStub.supported) {
        done()
        return
      }

      const server = boltStub.start(
        `./test/resources/boltstub/${version}/connection_error_on_commit.script`,
        9001
      )

      boltStub.run(() => {
        const driver = boltStub.newDriver('bolt://127.0.0.1:9001')
        const session = driver.session()

        const writeTx = session.beginTransaction()

        writeTx
          .run("CREATE (n {name: 'Bob'})")
          .then(() =>
            writeTx.commit().then(
              result => fail('expected an error'),
              error => {
                expect(error.code).toBe(SERVICE_UNAVAILABLE)
              }
            )
          )
          .then(() =>
            session.close(() => {
              driver.close()

              server.exit(code => {
                expect(code).toEqual(0)
                done()
              })
            })
          )
          .catch(error => done.fail(error))
      })
    }

    it('v2', done => {
      verifyFailureOnCommit('v2', done)
    })

    it('v3', done => {
      verifyFailureOnCommit('v3', done)
    })
  })
})

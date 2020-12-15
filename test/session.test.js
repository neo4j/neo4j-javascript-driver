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

import neo4j from '../src'
import { queryType } from '../src/result-summary'
import Session from '../src/session'
import { READ } from '../src/driver'
import SingleConnectionProvider from '../src/internal/connection-provider-single'
import FakeConnection from './internal/fake-connection'
import sharedNeo4j from './internal/shared-neo4j'
import _ from 'lodash'
import { isString } from '../src/internal/util'
import testUtils from './internal/test-utils'
import { newError, PROTOCOL_ERROR, SESSION_EXPIRED } from '../src/error'
import ServerAddress from '../src/internal/server-address'

describe('#integration session', () => {
  let driver
  let session
  // eslint-disable-next-line no-unused-vars
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
    await driver.close()
  })

  it('close should return promise', done => {
    const connection = new FakeConnection()
    const session = newSessionWithConnection(connection)

    session.close().then(() => done())
  }, 70000)

  it('close should return promise even when already closed ', done => {
    const connection = new FakeConnection()
    const session = newSessionWithConnection(connection)

    session.close().then(() => {
      session.close().then(() => {
        session.close().then(() => {
          done()
        })
      })
    })
  }, 70000)

  it('close should be idempotent ', done => {
    const connection = new FakeConnection()
    const session = newSessionWithConnection(connection)

    session.close().then(() => {
      expect(connection.isReleasedOnce()).toBeTruthy()

      session.close().then(() => {
        expect(connection.isReleasedOnce()).toBeTruthy()

        session.close().then(() => {
          expect(connection.isReleasedOnce()).toBeTruthy()
          done()
        })
      })
    })
  }, 70000)

  it('should close transaction executor', done => {
    const session = newSessionWithConnection(new FakeConnection())

    let closeCalledTimes = 0
    const transactionExecutor = session._transactionExecutor
    const originalClose = transactionExecutor.close
    transactionExecutor.close = () => {
      closeCalledTimes++
      originalClose.call(transactionExecutor)
    }

    session.close().then(() => {
      expect(closeCalledTimes).toEqual(1)
      done()
    })
  }, 70000)

  it('should be possible to close driver after closing session with failed tx ', done => {
    const driver = neo4j.driver(
      `bolt://${sharedNeo4j.hostname}`,
      sharedNeo4j.authToken
    )
    const session = driver.session()
    const tx = session.beginTransaction()
    tx.run('INVALID QUERY').catch(() => {
      tx.rollback().then(() => {
        session
          .close()
          .then(() => driver.close())
          .then(() => done())
      })
    })
  }, 70000)

  it('should expose basic run/subscribe ', done => {
    // Given

    // When & Then
    const records = []
    session.run('RETURN 1.0 AS a').subscribe({
      onNext: record => {
        records.push(record)
      },
      onCompleted: () => {
        expect(records.length).toBe(1)
        expect(records[0].get('a')).toBe(1)
        done()
      }
    })
  }, 70000)

  it('should keep context in subscribe methods ', done => {
    // Given
    function MyObserver () {
      this.local = 'hello'
      const privateLocal = 'hello'
      this.onNext = function () {
        expect(privateLocal).toBe('hello')
        expect(this.local).toBe('hello')
      }
      this.onCompleted = function () {
        expect(privateLocal).toBe('hello')
        expect(this.local).toBe('hello')
        done()
      }
    }

    // When & Then
    session.run('RETURN 1.0 AS a').subscribe(new MyObserver())
  }, 70000)

  it('should call observers onError on error ', done => {
    // When & Then
    session.run('RETURN 1 AS').subscribe({
      onError: error => {
        expect(error.code).toEqual('Neo.ClientError.Statement.SyntaxError')
        done()
      }
    })
  }, 70000)

  it('should accept a query object ', done => {
    // Given
    const query = {
      text: 'RETURN 1 = $param AS a',
      parameters: { param: 1 }
    }

    // When & Then
    const records = []
    session.run(query).subscribe({
      onNext: record => {
        records.push(record)
      },
      onCompleted: () => {
        expect(records.length).toBe(1)
        expect(records[0].get('a')).toBe(true)
        done()
      }
    })
  }, 70000)

  it('should expose run/then/then/then ', done => {
    // When & Then
    session
      .run('RETURN 1.0 AS a')
      .then(result => {
        expect(result.records.length).toBe(1)
        expect(result.records[0].get('a')).toBe(1)
        return result
      })
      .then(result => {
        expect(result.records.length).toBe(1)
        expect(result.records[0].get('a')).toBe(1)
      })
      .then(done)
  }, 70000)

  it('should expose basic run/catch ', done => {
    // When & Then
    session.run('RETURN 1 AS').catch(error => {
      expect(error.code).toEqual('Neo.ClientError.Statement.SyntaxError')
      done()
    })
  }, 70000)

  it('should expose summarize method for basic metadata ', done => {
    // Given
    const query = 'CREATE (n:Label {prop: $prop}) RETURN n'
    const params = { prop: 'string' }
    // When & Then
    session.run(query, params).then(result => {
      const sum = result.summary
      expect(sum.query.text).toBe(query)
      expect(sum.query.parameters).toBe(params)
      expect(sum.counters.containsUpdates()).toBe(true)
      expect(sum.counters.updates().nodesCreated).toBe(1)
      expect(sum.queryType).toBe(queryType.READ_WRITE)
      done()
    })
  }, 70000)

  it('should expose server info on successful query', done => {
    // Given
    const query = 'RETURN 1'

    // When & Then
    session.run(query).then(result => {
      const sum = result.summary
      expect(sum.server).toBeDefined()
      expect(sum.server.address).toEqual(`${sharedNeo4j.hostname}:7687`)
      expect(sum.server.version).toBeDefined()
      done()
    })
  }, 70000)

  it('should expose execution time information', done => {
    // Given
    const query = 'UNWIND range(1,10000) AS n RETURN n AS number'
    // When & Then

    session.run(query).then(result => {
      const sum = result.summary
      expect(result.records.length).toBe(10000)
      expect(sum.resultAvailableAfter.toInt()).not.toBeLessThan(0)
      expect(sum.resultConsumedAfter.toInt()).not.toBeLessThan(0)
      done()
    })
  }, 70000)

  it('should expose empty parameter map on call with no parameters', done => {
    // Given
    const query = "CREATE (n:Label {prop:'string'}) RETURN n"
    // When & Then
    session.run(query).then(result => {
      const sum = result.summary
      expect(sum.query.parameters).toEqual({})
      done()
    })
  }, 70000)

  it('should expose plan ', done => {
    // Given
    const query = 'EXPLAIN CREATE (n:Label {prop: $prop}) RETURN n'
    const params = { prop: 'string' }
    // When & Then
    session.run(query, params).then(result => {
      const sum = result.summary
      expect(sum.hasPlan()).toBe(true)
      expect(sum.hasProfile()).toBe(false)
      expect(sum.plan.operatorType).toBeDefined()
      expect(isString(sum.plan.arguments.runtime)).toBeTruthy()
      expect(sum.plan.identifiers[0]).toBe('n')
      expect(sum.plan.children[0].operatorType).toBeDefined()
      done()
    })
  }, 70000)

  it('should expose profile ', done => {
    // Given
    const query = 'PROFILE MATCH (n:Label {prop: $prop}) RETURN n'
    const params = { prop: 'string' }
    // When & Then
    session.run(query, params).then(result => {
      const sum = result.summary
      expect(sum.hasPlan()).toBe(true) // When there's a profile, there's a plan
      expect(sum.hasProfile()).toBe(true)
      expect(sum.profile.operatorType).toBeDefined()
      expect(isString(sum.profile.arguments.runtime)).toBeTruthy()
      expect(sum.profile.identifiers[0]).toBe('n')
      expect(sum.profile.children[0].operatorType).toBeDefined()
      expect(sum.profile.rows).toBe(0)
      done()
    })
  }, 70000)

  it('should expose cypher notifications ', done => {
    // Given
    const query = 'EXPLAIN MATCH (n:ThisLabelDoesNotExist) RETURN n'
    // When & Then
    session.run(query).then(result => {
      const sum = result.summary
      expect(sum.notifications.length).toBeGreaterThan(0)
      expect(sum.notifications[0].code).toBe(
        'Neo.ClientNotification.Statement.UnknownLabelWarning'
      )
      expect(sum.notifications[0].title).toContain('label')
      expect(sum.notifications[0].position.column).toBeGreaterThan(0)
      done()
    })
  }, 70000)

  it('should fail when using the session with an open transaction', done => {
    // When
    session.beginTransaction()

    // Then
    session.run('RETURN 42').catch(error => {
      expect(error.message).toBe(
        'Queries cannot be run directly on a ' +
          'session with an open transaction; either run from within the ' +
          'transaction or use a different session.'
      )
      done()
    })
  }, 70000)

  it('should fail when opening multiple transactions', () => {
    // When
    session.beginTransaction()

    // Then
    expect(() => session.beginTransaction()).toThrowError(
      /You cannot begin a transaction on a session with an open transaction/
    )
  }, 70000)

  it('should return lots of data', done => {
    session
      .run("UNWIND range(1,10000) AS x CREATE (:ATTRACTION {prop: 'prop'})")
      .then(() => {
        session.run('MATCH (n) RETURN n').subscribe({
          onNext: record => {
            const node = record.get('n')
            expect(node.labels[0]).toEqual('ATTRACTION')
            expect(node.properties.prop).toEqual('prop')
          },
          onCompleted: () => {
            session.close().then(() => done())
          },
          onError: error => {
            console.log(error)
          }
        })
      })
  }, 70000)

  it('should be able to close a long running query ', done => {
    // given a long running query
    session
      .run('unwind range(1,1000000) as x create (n {prop:x}) delete n')
      .catch(error => {
        // long running query should fail
        expect(error).toBeDefined()

        // and it should be possible to start another session and run a query
        const anotherSession = driver.session()
        anotherSession
          .run('RETURN 1.0 as a')
          .then(result => {
            expect(result.records.length).toBe(1)
            expect(result.records[0].get('a')).toBe(1)
            done()
          })
          .catch(error => {
            console.log(
              'Query failed after a long running query was terminated',
              error
            )
          })
      })

    // wait some time than close the session with a long running query
    setTimeout(() => {
      session.close()
    }, 1000)
  }, 70000)

  /* flaky
  it('should fail nicely on unpackable values ', done => {
    // Given
    const unpackable = () => {
      throw Error()
    }

    const query = 'RETURN $param'
    const params = { param: unpackable }
    // When & Then
    session.run(query, params).catch(ignore => {
      done()
    })
  })
  */

  it('should fail nicely for illegal query', () => {
    expect(() => session.run()).toThrowError(TypeError)
    expect(() => session.run(null)).toThrowError(TypeError)
    expect(() => session.run({})).toThrowError(TypeError)
    expect(() => session.run(42)).toThrowError(TypeError)
    expect(() => session.run([])).toThrowError(TypeError)
    expect(() => session.run('')).toThrowError(TypeError)
    expect(() => session.run(['CREATE ()'])).toThrowError(TypeError)

    expect(() => session.run({ query: 'CREATE ()' })).toThrowError(TypeError)
    expect(() => session.run({ cypher: 'CREATE ()' })).toThrowError(TypeError)
  }, 70000)

  it('should fail nicely for illegal bookmark', () => {
    expect(() => session.beginTransaction(42)).toThrowError(TypeError)
    expect(() => session.beginTransaction(42)).toThrowError(TypeError)
    expect(() => session.beginTransaction([42.0, 42.0])).toThrowError(TypeError)
    expect(() =>
      session.beginTransaction(() => ['bookmark:1', 'bookmark:2', 'bookmark:3'])
    ).toThrowError(TypeError)
  }, 70000)

  it(
    'should allow creation of a ' + neo4j.session.READ + ' session',
    done => {
      const readSession = driver.session({
        defaultAccessMode: neo4j.session.READ
      })
      readSession
        .run('RETURN 1')
        .then(() => readSession.close())
        .then(() => done())
    },
    70000
  )

  it(
    'should allow creation of a ' + neo4j.session.WRITE + ' session',
    done => {
      const writeSession = driver.session({
        defaultAccessMode: neo4j.session.WRITE
      })
      writeSession
        .run('CREATE ()')
        .then(() => writeSession.close())
        .then(() => done())
    },
    70000
  )

  it('should fail for illegal session mode', () => {
    expect(() =>
      driver.session({ defaultAccessMode: 'ILLEGAL_MODE' })
    ).toThrow()
  }, 70000)

  it('should release connection to the pool after run', done => {
    withQueryInTmpSession(driver, () => {
      const idleConnectionsBefore = idleConnectionCount(driver)

      session.run('RETURN 1').then(() => {
        const idleConnectionsAfter = idleConnectionCount(driver)
        expect(idleConnectionsBefore).toEqual(idleConnectionsAfter)
        done()
      })
    })
  }, 70000)

  it('should release connection to the pool after run failure', done => {
    withQueryInTmpSession(driver, () => {
      const idleConnectionsBefore = idleConnectionCount(driver)

      session.run('RETURN 10 / 0').catch(() => {
        const idleConnectionsAfter = idleConnectionCount(driver)
        expect(idleConnectionsBefore).toEqual(idleConnectionsAfter)
        done()
      })
    })
  }, 70000)

  it('should release connection to the pool when result is consumed', done => {
    withQueryInTmpSession(driver, () => {
      const idleConnectionsBefore = idleConnectionCount(driver)

      session.run('UNWIND range(0, 10) AS x RETURN x + 1').subscribe({
        onNext: () => {
          // one less idle connection, one connection is used for the current query
          expect(idleConnectionCount(driver)).toBe(idleConnectionsBefore - 1)
        },
        onError: error => {
          console.log(error)
        },
        onCompleted: () => {
          expect(idleConnectionCount(driver)).toBe(idleConnectionsBefore)
          done()
        }
      })
    })
  }, 70000)

  it('should release connection to the pool when result fails', done => {
    withQueryInTmpSession(driver, () => {
      const idleConnectionsBefore = idleConnectionCount(driver)

      session.run('UNWIND range(10, 0, -1) AS x RETURN 10 / x').subscribe({
        onNext: () => {
          // one less idle connection, one connection is used for the current query
          expect(idleConnectionCount(driver)).toBe(idleConnectionsBefore - 1)
        },
        onError: ignoredError => {
          expect(idleConnectionCount(driver)).toBe(idleConnectionsBefore)
          done()
        },
        onCompleted: () => {}
      })
    })
  }, 70000)

  it('should release connection to the pool when transaction commits', done => {
    withQueryInTmpSession(driver, () => {
      const idleConnectionsBefore = idleConnectionCount(driver)

      const tx = session.beginTransaction()
      tx.run('UNWIND range(0, 10) AS x RETURN x + 1').subscribe({
        onNext: () => {
          // one less idle connection, one connection is used for the current transaction
          expect(idleConnectionCount(driver)).toBe(idleConnectionsBefore - 1)
        },
        onError: error => {
          console.log(error)
        },
        onCompleted: () => {
          // one less idle connection, one connection is used for the current transaction
          expect(idleConnectionCount(driver)).toBe(idleConnectionsBefore - 1)
          tx.commit().then(() => {
            expect(idleConnectionCount(driver)).toBe(idleConnectionsBefore)
            done()
          })
        }
      })
    })
  }, 70000)

  it('should release connection to the pool when transaction rolls back', done => {
    withQueryInTmpSession(driver, () => {
      const idleConnectionsBefore = idleConnectionCount(driver)

      const tx = session.beginTransaction()
      tx.run('UNWIND range(0, 10) AS x RETURN x + 1').subscribe({
        onNext: () => {
          // one less idle connection, one connection is used for the current transaction
          expect(idleConnectionCount(driver)).toBe(idleConnectionsBefore - 1)
        },
        onError: error => {
          console.log(error)
        },
        onCompleted: () => {
          // one less idle connection, one connection is used for the current transaction
          expect(idleConnectionCount(driver)).toBe(idleConnectionsBefore - 1)
          tx.rollback().then(() => {
            expect(idleConnectionCount(driver)).toBe(idleConnectionsBefore)
            done()
          })
        }
      })
    })
  }, 70000)

  it('should update last bookmark after every read tx commit', done => {
    // new session without initial bookmark
    session = driver.session()
    expect(session.lastBookmark()).toEqual([])

    const tx = session.beginTransaction()
    tx.run('RETURN 42 as answer').then(result => {
      const records = result.records
      expect(records.length).toEqual(1)
      expect(records[0].get('answer').toNumber()).toEqual(42)

      tx.commit().then(() => {
        verifyBookmark(session.lastBookmark())
        done()
      })
    })
  }, 70000)

  it('should update last bookmark after every write tx commit', done => {
    const bookmarkBefore = session.lastBookmark()

    const tx = session.beginTransaction()
    tx.run('CREATE ()').then(() => {
      tx.commit().then(() => {
        const bookmarkAfter = session.lastBookmark()
        expect(bookmarkAfter).toBeDefined()
        expect(bookmarkAfter).not.toBeNull()
        expect(bookmarkAfter).not.toEqual(bookmarkBefore)

        done()
      })
    })
  }, 70000)

  it('should not lose last bookmark after run', done => {
    const tx = session.beginTransaction()
    tx.run('CREATE ()').then(() => {
      tx.commit().then(() => {
        const bookmarkBefore = session.lastBookmark()
        verifyBookmark(bookmarkBefore)

        session.run('CREATE ()').then(() => {
          verifyBookmark(session.lastBookmark())
          done()
        })
      })
    })
  }, 70000)

  it('should commit read transaction', done => {
    // new session without initial bookmark
    session = driver.session()
    expect(session.lastBookmark()).toEqual([])

    const resultPromise = session.readTransaction(tx =>
      tx.run('RETURN 42 AS answer')
    )

    resultPromise.then(result => {
      expect(result.records.length).toEqual(1)
      expect(result.records[0].get('answer').toNumber()).toEqual(42)
      verifyBookmark(session.lastBookmark())
      done()
    })
  }, 70000)

  it('should commit write transaction', done => {
    const bookmarkBefore = session.lastBookmark()
    const resultPromise = session.writeTransaction(tx =>
      tx.run('CREATE (n:Node {id: 42}) RETURN n.id AS answer')
    )

    resultPromise.then(result => {
      expect(result.records.length).toEqual(1)
      expect(result.records[0].get('answer').toNumber()).toEqual(42)
      expect(result.summary.counters.updates().nodesCreated).toEqual(1)

      const bookmarkAfter = session.lastBookmark()
      verifyBookmark(bookmarkAfter)
      expect(bookmarkAfter).not.toEqual(bookmarkBefore)

      countNodes('Node', 'id', 42).then(count => {
        expect(count).toEqual(1)
        done()
      })
    })
  }, 70000)

  it('should not commit already committed read transaction', done => {
    const resultPromise = session.readTransaction(tx => {
      return new Promise((resolve, reject) => {
        tx.run('RETURN 42 AS answer')
          .then(result => {
            tx.commit()
              .then(() => {
                resolve({ result: result, bookmark: session.lastBookmark() })
              })
              .catch(error => reject(error))
          })
          .catch(error => reject(error))
      })
    })

    resultPromise.then(outcome => {
      const bookmark = outcome.bookmark
      const result = outcome.result

      verifyBookmark(bookmark)
      expect(session.lastBookmark()).toEqual(bookmark) // expect bookmark to not change

      expect(result.records.length).toEqual(1)
      expect(result.records[0].get('answer').toNumber()).toEqual(42)

      done()
    })
  }, 70000)

  it('should not commit already committed write transaction', done => {
    const resultPromise = session.writeTransaction(tx => {
      return new Promise((resolve, reject) => {
        tx.run('CREATE (n:Node {id: 42}) RETURN n.id AS answer')
          .then(result => {
            tx.commit()
              .then(() => {
                resolve({ result: result, bookmark: session.lastBookmark() })
              })
              .catch(error => reject(error))
          })
          .catch(error => reject(error))
      })
    })

    resultPromise.then(outcome => {
      const bookmark = outcome.bookmark
      const result = outcome.result

      verifyBookmark(bookmark)
      expect(session.lastBookmark()).toEqual(bookmark) // expect bookmark to not change

      expect(result.records.length).toEqual(1)
      expect(result.records[0].get('answer').toNumber()).toEqual(42)
      expect(result.summary.counters.updates().nodesCreated).toEqual(1)

      countNodes('Node', 'id', 42).then(count => {
        expect(count).toEqual(1)
        done()
      })
    })
  }, 70000)

  it('should not commit rolled back read transaction', done => {
    const bookmarkBefore = session.lastBookmark()
    const resultPromise = session.readTransaction(tx => {
      return new Promise((resolve, reject) => {
        tx.run('RETURN 42 AS answer')
          .then(result => {
            tx.rollback()
              .then(() => {
                resolve(result)
              })
              .catch(error => reject(error))
          })
          .catch(error => reject(error))
      })
    })

    resultPromise.then(result => {
      expect(result.records.length).toEqual(1)
      expect(result.records[0].get('answer').toNumber()).toEqual(42)
      expect(session.lastBookmark()).toBe(bookmarkBefore) // expect bookmark to not change

      done()
    })
  }, 70000)

  it('should not commit rolled back write transaction', done => {
    const bookmarkBefore = session.lastBookmark()
    const resultPromise = session.writeTransaction(tx => {
      return new Promise((resolve, reject) => {
        tx.run('CREATE (n:Node {id: 42}) RETURN n.id AS answer')
          .then(result => {
            tx.rollback()
              .then(() => {
                resolve(result)
              })
              .catch(error => reject(error))
          })
          .catch(error => reject(error))
      })
    })

    resultPromise.then(result => {
      expect(result.records.length).toEqual(1)
      expect(result.records[0].get('answer').toNumber()).toEqual(42)
      expect(result.summary.counters.updates().nodesCreated).toEqual(1)
      expect(session.lastBookmark()).toBe(bookmarkBefore) // expect bookmark to not change

      countNodes('Node', 'id', 42).then(count => {
        expect(count).toEqual(0)
        done()
      })
    })
  }, 70000)

  it('should interrupt query waiting on a lock when closed', done => {
    session.run('CREATE ()').then(() => {
      session.close().then(() => {
        const session1 = driver.session()
        const session2 = driver.session()
        const tx1 = session1.beginTransaction()

        tx1.run('MATCH (n) SET n.id = 1 RETURN 42 AS answer').then(result => {
          // node is now locked by tx1
          expect(result.records.length).toEqual(1)
          expect(result.records[0].get(0).toNumber()).toEqual(42)

          // this query should get stuck waiting for the lock
          session2
            .run('MATCH (n) SET n.id = 2 RETURN 42 AS answer')
            .catch(error => {
              expectTransactionTerminatedError(error)
              tx1.commit().then(() => {
                readAllNodeIds().then(ids => {
                  expect(ids).toEqual([1])
                  done()
                })
              })
            })

          setTimeout(() => {
            // close session after a while
            session2.close()
          }, 1000)
        })
      })
    })
  }, 70000)

  it('should interrupt transaction waiting on a lock when closed', done => {
    session.run('CREATE ()').then(() => {
      session.close().then(() => {
        const session1 = driver.session()
        const session2 = driver.session()
        const tx1 = session1.beginTransaction()
        const tx2 = session2.beginTransaction()

        tx1.run('MATCH (n) SET n.id = 1 RETURN 42 AS answer').then(result => {
          // node is now locked by tx1
          expect(result.records.length).toEqual(1)
          expect(result.records[0].get(0).toNumber()).toEqual(42)

          // this query should get stuck waiting for the lock
          tx2.run('MATCH (n) SET n.id = 2 RETURN 42 AS answer').catch(error => {
            expectTransactionTerminatedError(error)
            tx1.commit().then(() => {
              readAllNodeIds().then(ids => {
                expect(ids).toEqual([1])
                done()
              })
            })
          })

          setTimeout(() => {
            // close session after a while
            session2.close()
          }, 1000)
        })
      })
    })
  }, 70000)

  it('should interrupt transaction function waiting on a lock when closed', done => {
    session.run('CREATE ()').then(() => {
      session.close().then(() => {
        const session1 = driver.session()
        const session2 = driver.session()
        const tx1 = session1.beginTransaction()

        tx1.run('MATCH (n) SET n.id = 1 RETURN 42 AS answer').then(result => {
          // node is now locked by tx1
          expect(result.records.length).toEqual(1)
          expect(result.records[0].get(0).toNumber()).toEqual(42)

          session2.writeTransaction(tx2 => {
            // this query should get stuck waiting for the lock
            return tx2
              .run('MATCH (n) SET n.id = 2 RETURN 42 AS answer')
              .catch(error => {
                expectTransactionTerminatedError(error)
                tx1.commit().then(() => {
                  readAllNodeIds().then(ids => {
                    expect(ids).toEqual([1])
                    done()
                  })
                })
              })
          })

          setTimeout(() => {
            // close session after a while
            session2.close()
          }, 1000)
        })
      })
    })
  }, 70000)

  it('should send multiple bookmarks', async () => {
    const nodeCount = 17
    const bookmarks = []
    for (let i = 0; i < nodeCount; i++) {
      const bookmark = await runQueryAndGetBookmark(driver)
      bookmarks.push(bookmark)
    }

    expect(_.uniq(bookmarks).length).toEqual(nodeCount)
    bookmarks.forEach(bookmark => expect(_.isArray(bookmark)).toBeTruthy())

    const session = driver.session({ defaultAccessMode: READ, bookmarks })
    try {
      const result = await session.run('MATCH (n) RETURN count(n)')
      const count = result.records[0].get(0).toInt()
      expect(count).toEqual(nodeCount)
    } finally {
      await session.close()
    }
  }, 70000)

  it('should acquire connection for transaction', done => {
    expect(numberOfAcquiredConnectionsFromPool()).toEqual(0)

    session
      .beginTransaction()
      .run('RETURN 1.0')
      .then(result => {
        expect(result.records[0].get(0)).toEqual(1)
        expect(numberOfAcquiredConnectionsFromPool()).toEqual(1)

        driver
          .session()
          .beginTransaction()
          .run('RETURN 2.0')
          .then(result => {
            expect(result.records[0].get(0)).toEqual(2)
            expect(numberOfAcquiredConnectionsFromPool()).toEqual(2)

            driver
              .session()
              .beginTransaction()
              .run('RETURN 3.0')
              .then(result => {
                expect(result.records[0].get(0)).toEqual(3)
                expect(numberOfAcquiredConnectionsFromPool()).toEqual(3)

                driver
                  .session()
                  .beginTransaction()
                  .run('RETURN 4.0')
                  .then(result => {
                    expect(result.records[0].get(0)).toEqual(4)
                    expect(numberOfAcquiredConnectionsFromPool()).toEqual(4)

                    done()
                  })
              })
          })
      })
  }, 70000)

  it('should acquire connection for query execution', done => {
    session.run('RETURN 42 AS answer').subscribe({
      onNext: record => {
        expect(record.get('answer').toInt()).toEqual(42)
        expect(numberOfAcquiredConnectionsFromPool()).toEqual(1)
      },
      onCompleted: () => {
        session.close().then(() => {
          done()
        })
      },
      onError: error => {
        console.log(error)
      }
    })
  }, 70000)

  it('should acquire separate connections for transaction and query execution in different sessions', done => {
    const otherSession = driver.session()
    expect(otherSession.beginTransaction()).toBeDefined()

    session.run('RETURN 42 AS answer').subscribe({
      onNext: record => {
        expect(record.get('answer').toInt()).toEqual(42)
        expect(numberOfAcquiredConnectionsFromPool()).toEqual(2)
      },
      onCompleted: () => {
        otherSession.close().then(() => session.close().then(() => done()))
      },
      onError: error => {
        console.log(error)
      }
    })
  }, 70000)

  it('should respect connection timeout', done => {
    testConnectionTimeout(false, done)
  }, 70000)

  it('should respect encrypted connection timeout', done => {
    testConnectionTimeout(true, done)
  }, 70000)

  it('should convert iterable to array', done => {
    const iterable = {}
    iterable[Symbol.iterator] = function * () {
      yield '111'
      yield '222'
      yield '333'
    }

    session
      .run('RETURN $array', { array: iterable })
      .then(result => {
        const records = result.records
        expect(records.length).toEqual(1)
        const received = records[0].get(0)
        expect(received).toEqual(['111', '222', '333'])
        done()
      })
      .catch(error => {
        done.fail(error)
      })
  }, 70000)

  /* flaky
  it('should fail to convert illegal iterable to array', done => {
    const iterable = {}
    iterable[Symbol.iterator] = function () {}

    session
      .run('RETURN $array', { array: iterable })
      .then(result => {
        done.fail(
          'Failure expected but query returned ' +
            JSON.stringify(result.records[0].get(0))
        )
      })
      .catch(error => {
        expect(
          error.message.indexOf('Cannot pack given iterable')
        ).not.toBeLessThan(0)
        done()
      })
  })
  */

  it('should fail for invalid query parameters', () => {
    expect(() => session.run('RETURN $value', '42')).toThrowError(TypeError)
    expect(() => session.run('RETURN $value', 42)).toThrowError(TypeError)
    expect(() => session.run('RETURN $value', () => 42)).toThrowError(TypeError)
  }, 70000)

  /* flaky
  it('should fail to pass node as a query parameter', done => {
    testUnsupportedQueryParameter(
      new neo4j.types.Node(neo4j.int(1), ['Person'], { name: 'Bob' }),
      done
    )
  })
  */

  /* flaky
  it('should fail to pass relationship as a query parameter', done => {
    testUnsupportedQueryParameter(
      new neo4j.types.Relationship(
        neo4j.int(1),
        neo4j.int(2),
        neo4j.int(3),
        'KNOWS',
        { since: 42 }
      ),
      done
    )
  })
  */

  /* flaky
  it('should fail to pass path as a query parameter', done => {
    const node1 = new neo4j.types.Node(neo4j.int(1), ['Person'], {
      name: 'Alice'
    })
    const node2 = new neo4j.types.Node(neo4j.int(2), ['Person'], {
      name: 'Bob'
    })
    testUnsupportedQueryParameter(new neo4j.types.Path(node1, node2, []), done)
  })
  */

  it('should retry transaction until success when function throws', done => {
    testTransactionRetryUntilSuccess(() => {
      throw newError('Error that can be retried', SESSION_EXPIRED)
    }, done)
  }, 70000)

  it('should retry transaction until success when function returns rejected promise', done => {
    testTransactionRetryUntilSuccess(
      () =>
        Promise.reject(newError('Error that can be retried', SESSION_EXPIRED)),
      done
    )
  }, 70000)

  it('should not retry transaction when function throws fatal error', done => {
    testTransactionRetryOnFatalError(() => {
      throw newError('Error that is fatal', PROTOCOL_ERROR)
    }, done)
  }, 70000)

  it('should not retry transaction when function returns promise rejected with fatal error', done => {
    testTransactionRetryOnFatalError(
      () =>
        Promise.reject(newError('Error that is fatal', 'ReallyFatalErrorCode')),
      done
    )
  }, 70000)

  function testTransactionRetryUntilSuccess (failureResponseFunction, done) {
    const session = driver.session()

    const failures = 3
    const usedTransactions = []

    const resultPromise = session.writeTransaction(tx => {
      usedTransactions.push(tx)
      if (usedTransactions.length < failures) {
        return failureResponseFunction()
      } else {
        return tx.run('RETURN "424242"')
      }
    })

    resultPromise
      .then(result => {
        expect(result.records[0].get(0)).toEqual('424242')
        expect(usedTransactions.length).toEqual(3)
        usedTransactions.forEach(tx => expect(tx.isOpen()).toBeFalsy())
      })
      .then(() => session.close())
      .then(() => done())
      .catch(error => {
        done.fail(error)
      })
  }

  function testTransactionRetryOnFatalError (failureResponseFunction, done) {
    const session = driver.session()

    const usedTransactions = []

    const resultPromise = session.writeTransaction(tx => {
      usedTransactions.push(tx)
      return failureResponseFunction()
    })

    resultPromise
      .then(result =>
        session
          .close()
          .then(() =>
            done.fail('Retries should not succeed: ' + JSON.stringify(result))
          )
      )
      .catch(error => {
        expect(error).toBeDefined()
        expect(error).not.toBeNull()
        expect(usedTransactions.length).toEqual(1)
        expect(usedTransactions[0].isOpen()).toBeFalsy()
      })
      .then(() => session.close())
      .then(() => done())
  }

  function countNodes (label, propertyKey, propertyValue) {
    return new Promise((resolve, reject) => {
      session
        .run(
          `MATCH (n: ${label} {${propertyKey}: ${propertyValue}}) RETURN count(n) AS count`
        )
        .then(result => {
          resolve(result.records[0].get('count').toNumber())
        })
        .catch(error => reject(error))
    })
  }

  function withQueryInTmpSession (driver, callback) {
    const tmpSession = driver.session()
    return tmpSession
      .run('RETURN 1')
      .then(() => tmpSession.close())
      .then(() => callback())
  }

  function newSessionWithConnection (connection) {
    const connectionProvider = new SingleConnectionProvider(
      Promise.resolve(connection)
    )
    const session = new Session({ mode: READ, connectionProvider })
    session.beginTransaction() // force session to acquire new connection
    return session
  }

  function idleConnectionCount (driver) {
    const connectionProvider = driver._connectionProvider
    const address = connectionProvider._address
    const connectionPool = connectionProvider._connectionPool
    const idleConnections = connectionPool._pools[address]
    return idleConnections.length
  }

  function verifyBookmark (bookmark) {
    expect(bookmark).toBeDefined()
    expect(bookmark).not.toBeNull()
  }

  function expectTransactionTerminatedError (error) {
    const message = error.message.toLowerCase()
    expect(message.indexOf('transaction')).not.toBeLessThan(0)
    expect(message.indexOf('terminated')).not.toBeLessThan(0)
  }

  function readAllNodeIds () {
    return new Promise((resolve, reject) => {
      const session = driver.session()
      session
        .run('MATCH (n) RETURN n.id')
        .then(result => {
          const ids = result.records.map(record => record.get(0).toNumber())
          resolve(ids)
        })
        .then(() => session.close())
        .catch(error => {
          reject(error)
        })
    })
  }

  function runQueryAndGetBookmark (driver) {
    const session = driver.session()
    const tx = session.beginTransaction()

    return new Promise((resolve, reject) => {
      tx.run('CREATE ()')
        .then(() => {
          tx.commit()
            .then(() => {
              const bookmark = session.lastBookmark()
              session.close().then(() => {
                resolve(bookmark)
              })
            })
            .catch(error => reject(error))
        })
        .catch(error => reject(error))
    })
  }

  function numberOfAcquiredConnectionsFromPool () {
    const pool = driver._connectionProvider._connectionPool
    return pool.activeResourceCount(
      ServerAddress.fromUrl(`${sharedNeo4j.hostname}:7687`)
    )
  }

  function testConnectionTimeout (encrypted, done) {
    if (testUtils.isClient() && encrypted) {
      // skip encrypted test in browser because it runs all tests in a HTTP page
      done()
      return
    }

    const boltUri = 'bolt://10.0.0.0' // use non-routable IP address which never responds
    const config = { encrypted: encrypted, connectionTimeout: 1000 }

    const localDriver = neo4j.driver(boltUri, sharedNeo4j.authToken, config)
    const session = localDriver.session()
    session
      .run('RETURN 1')
      .then(() => localDriver.close())
      .then(() => done.fail('Query did not fail'))
      .catch(error => {
        expect(error.code).toEqual(neo4j.error.SERVICE_UNAVAILABLE)

        // in some environments non-routable address results in immediate 'connection refused' error and connect
        // timeout is not fired; skip message assertion for such cases, it is important for connect attempt to not hang
        if (error.message.indexOf('Failed to establish connection') === 0) {
          expect(error.message).toEqual(
            'Failed to establish connection in 1000ms'
          )
        }
      })
      .then(() => localDriver.close())
      .then(() => done())
  }

  function testUnsupportedQueryParameter (value, done) {
    session
      .run('RETURN $value', { value: value })
      .then(() => {
        done.fail(
          `Should not be possible to send ${value.constructor.name} ${value} as a query parameter`
        )
      })
      .catch(error => {
        expect(error.name).toEqual('Neo4jError')
        expect(error.code).toEqual(neo4j.error.PROTOCOL_ERROR)
        done()
      })
  }
})

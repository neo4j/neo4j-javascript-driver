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
import { ServerVersion } from '../src/internal/server-version'
import TxConfig from '../src/internal/tx-config'

describe('#integration transaction', () => {
  let driver
  let session
  // eslint-disable-next-line no-unused-vars
  let serverVersion
  let originalTimeout

  beforeEach(async () => {
    // make jasmine timeout high enough to test unreachable bookmarks
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 40000

    driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken)
    session = driver.session()

    const result = await session.run('MATCH (n) DETACH DELETE n')
    serverVersion = ServerVersion.fromString(result.summary.server.version)
  })

  afterEach(async () => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout
    await session.close()
    await driver.close()
  })

  it('should commit simple case', done => {
    const tx = session.beginTransaction()
    tx.run('CREATE (:TXNode1)')
      .then(() => {
        tx.run('CREATE (:TXNode2)')
          .then(() => {
            tx.commit()
              .then(() => {
                session
                  .run(
                    'MATCH (t1:TXNode1), (t2:TXNode2) RETURN count(t1), count(t2)'
                  )
                  .then(result => {
                    expect(result.records.length).toBe(1)
                    expect(result.records[0].get('count(t1)').toInt()).toBe(1)
                    expect(result.records[0].get('count(t2)').toInt()).toBe(1)
                    done()
                  })
                  .catch(console.log)
              })
              .catch(console.log)
          })
          .catch(console.log)
      })
      .catch(console.log)
  })

  it('should populate resultAvailableAfter for transaction#run', done => {
    const tx = session.beginTransaction()
    tx.run('CREATE (:TXNode1)')
      .then(result => {
        tx.commit()
          .then(() => {
            expect(result.summary.resultAvailableAfter).toBeDefined()
            expect(
              result.summary.resultAvailableAfter.toInt()
            ).not.toBeLessThan(0)
            done()
          })
          .catch(console.log)
      })
      .catch(console.log)
  })

  it('should handle interactive session', done => {
    const tx = session.beginTransaction()
    tx.run("RETURN 'foo' AS res")
      .then(result => {
        tx.run('CREATE ({name: {param}})', {
          param: result.records[0].get('res')
        })
          .then(() => {
            tx.commit()
              .then(() => {
                session
                  .run("MATCH (a {name:'foo'}) RETURN count(a)")
                  .then(result => {
                    expect(result.records.length).toBe(1)
                    expect(result.records[0].get('count(a)').toInt()).toBe(1)
                    done()
                  })
              })
              .catch(console.log)
          })
          .catch(console.log)
      })
      .catch(console.log)
  })

  it('should handle failures with subscribe', done => {
    const tx = session.beginTransaction()
    tx.run('THIS IS NOT CYPHER').catch(error => {
      expect(error.code).toEqual('Neo.ClientError.Statement.SyntaxError')
      done()
    })
  })

  it('should handle failures with catch', done => {
    const tx = session.beginTransaction()
    tx.run('THIS IS NOT CYPHER').subscribe({
      onError: error => {
        expect(error.code).toEqual('Neo.ClientError.Statement.SyntaxError')
        done()
      }
    })
  })

  it('should handle failures on commit', async () => {
    // When
    const tx = session.beginTransaction()
    await tx.run('CREATE (:TXNode1)')
    await expectAsync(tx.run('THIS IS NOT CYPHER')).toBeRejectedWith(
      jasmine.objectContaining({
        code: 'Neo.ClientError.Statement.SyntaxError'
      })
    )

    await expectAsync(tx.run('CREATE (:TXNode2)')).toBeRejectedWith(
      jasmine.objectContaining({
        message: jasmine.stringMatching(
          /Cannot run statement in this transaction, because .* error/
        )
      })
    )
    await expectAsync(tx.commit()).toBeRejectedWith(
      jasmine.objectContaining({
        message: jasmine.stringMatching(
          /Cannot commit this transaction, because .* error/
        )
      })
    )
  })

  it('should fail when committing on a failed query', async () => {
    const tx = session.beginTransaction()
    await tx.run('CREATE (:TXNode1)')
    await expectAsync(tx.run('THIS IS NOT CYPHER')).toBeRejectedWith(
      jasmine.objectContaining({
        code: 'Neo.ClientError.Statement.SyntaxError'
      })
    )
    await expectAsync(tx.commit()).toBeRejectedWith(
      jasmine.objectContaining({
        message: jasmine.stringMatching(
          /Cannot commit this transaction, because .* error/
        )
      })
    )
  })

  it('should handle when committing when another statement fails', async () => {
    // When
    const tx = session.beginTransaction()

    await expectAsync(tx.run('CREATE (:TXNode1)')).toBeResolved()
    await expectAsync(tx.run('THIS IS NOT CYHER')).toBeRejectedWith(
      jasmine.objectContaining({
        message: jasmine.stringMatching(/Invalid input/)
      })
    )
    await expectAsync(tx.commit()).toBeRejectedWith(
      jasmine.objectContaining({
        message: jasmine.stringMatching(/Cannot commit this transaction/)
      })
    )
  })

  it('should handle rollbacks', done => {
    const tx = session.beginTransaction()
    tx.run('CREATE (:TXNode1)')
      .then(() => {
        tx.run('CREATE (:TXNode2)')
          .then(() => {
            tx.rollback()
              .then(() => {
                session
                  .run(
                    'MATCH (t1:TXNode1), (t2:TXNode2) RETURN count(t1), count(t2)'
                  )
                  .then(result => {
                    expect(result.records.length).toBe(1)
                    expect(result.records[0].get('count(t1)').toInt()).toBe(0)
                    expect(result.records[0].get('count(t2)').toInt()).toBe(0)
                    done()
                  })
                  .catch(console.log)
              })
              .catch(console.log)
          })
          .catch(console.log)
      })
      .catch(console.log)
  })

  it('should fail when committing on a rolled back query', async () => {
    const tx = session.beginTransaction()
    await tx.run('CREATE (:TXNode1)')
    await tx.rollback()

    await expectAsync(tx.commit()).toBeRejectedWith(
      jasmine.objectContaining({
        message: jasmine.stringMatching(
          /Cannot commit this transaction, because .* rolled back/
        )
      })
    )
  })

  it('should fail when running on a rolled back transaction', async () => {
    const tx = session.beginTransaction()
    await tx.run('CREATE (:TXNode1)')
    await tx.rollback()

    await expectAsync(tx.run('RETURN 42')).toBeRejectedWith(
      jasmine.objectContaining({
        message: jasmine.stringMatching(
          /Cannot run statement in this transaction, because .* rolled back/
        )
      })
    )
  })

  it('should fail running when a previous statement failed', async () => {
    const tx = session.beginTransaction()

    await expectAsync(tx.run('THIS IS NOT CYPHER')).toBeRejectedWith(
      jasmine.stringMatching(/Invalid input/)
    )

    await expectAsync(tx.run('RETURN 42')).toBeRejectedWith(
      jasmine.objectContaining({
        message: jasmine.stringMatching(
          /Cannot run statement in this transaction, because .* an error/
        )
      })
    )
    await tx.rollback()
  })

  it('should fail when trying to roll back a rolled back transaction', async () => {
    const tx = session.beginTransaction()
    await tx.run('CREATE (:TXNode1)')
    await tx.rollback()

    await expectAsync(tx.rollback()).toBeRejectedWith(
      jasmine.objectContaining({
        message: jasmine.stringMatching(
          /Cannot rollback this transaction, because .* rolled back/
        )
      })
    )
  })

  it('should provide bookmark on commit', done => {
    // new session without initial bookmark
    session = driver.session()
    expect(session.lastBookmark()).toEqual([])

    const tx = session.beginTransaction()
    tx.run('CREATE (:TXNode1)')
      .then(() => {
        tx.run('CREATE (:TXNode2)')
          .then(() => {
            tx.commit().then(() => {
              expectValidLastBookmark(session)
              done()
            })
          })
          .catch(console.log)
      })
      .catch(console.log)
  })

  it('should have bookmark when tx is rolled back', done => {
    // new session without initial bookmark
    session = driver.session()
    expect(session.lastBookmark()).toEqual([])

    const tx1 = session.beginTransaction()
    tx1.run('CREATE ()').then(() => {
      tx1.commit().then(() => {
        expectValidLastBookmark(session)
        const bookmarkBefore = session.lastBookmark()

        const tx2 = session.beginTransaction()
        tx2.run('CREATE ()').then(() => {
          tx2.rollback().then(() => {
            expectValidLastBookmark(session)
            const bookmarkAfter = session.lastBookmark()
            expect(bookmarkAfter).toEqual(bookmarkBefore)

            const tx3 = session.beginTransaction()
            tx3.run('CREATE ()').then(() => {
              tx3.commit().then(() => {
                expectValidLastBookmark(session)
                done()
              })
            })
          })
        })
      })
    })
  })

  it('should have no bookmark when tx fails', done => {
    // new session without initial bookmark
    session = driver.session()
    expect(session.lastBookmark()).toEqual([])

    const tx1 = session.beginTransaction()

    tx1.run('CREATE ()').then(() => {
      tx1.commit().then(() => {
        expectValidLastBookmark(session)
        const bookmarkBefore = session.lastBookmark()

        const tx2 = session.beginTransaction()

        tx2.run('RETURN').catch(error => {
          expectSyntaxError(error)
          const bookmarkAfter = session.lastBookmark()
          expect(bookmarkAfter).toEqual(bookmarkBefore)

          const tx3 = session.beginTransaction()
          tx3.run('CREATE ()').then(() => {
            tx3.commit().then(() => {
              expectValidLastBookmark(session)
              done()
            })
          })
        })
      })
    })
  })

  it('should throw when provided string (bookmark) parameter', () => {
    expect(() => session.beginTransaction('bookmark')).toThrowError(TypeError)
  })

  it('should throw when provided string[] (bookmark) parameter', () => {
    expect(() => session.beginTransaction(['bookmark'])).toThrowError(TypeError)
  })

  it('should fail to run query for unreachable bookmark', done => {
    const tx1 = session.beginTransaction()
    tx1
      .run('CREATE ()')
      .then(result => {
        expect(result.summary.counters.nodesCreated()).toBe(1)

        tx1
          .commit()
          .then(() => {
            expectValidLastBookmark(session)

            const unreachableBookmark = session.lastBookmark() + '0'
            const session2 = driver.session({
              bookmarks: [unreachableBookmark]
            })
            const tx2 = session2.beginTransaction()
            tx2.run('CREATE ()').catch(error => {
              const message = error.message
              expect(message).toContain('not up to the requested version')
              done()
            })
          })
          .catch(console.log)
      })
      .catch(console.log)
  })

  it('should rollback when very first run fails', done => {
    const tx1 = session.beginTransaction()
    tx1.run('RETURN foo').catch(error => {
      expectSyntaxError(error)

      const tx2 = session.beginTransaction()
      tx2.run('RETURN 1').then(result => {
        expect(result.records[0].get(0).toNumber()).toEqual(1)
        tx2.commit().then(done)
      })
    })
  })

  it('should rollback when some run fails', done => {
    const tx1 = session.beginTransaction()
    tx1.run('CREATE (:Person)').then(() => {
      tx1.run('RETURN foo').catch(error => {
        expectSyntaxError(error)

        const tx2 = session.beginTransaction()
        tx2.run('MATCH (n:Person) RETURN count(n)').then(result => {
          expect(result.records[0].get(0).toNumber()).toEqual(0)
          tx2.commit().then(done)
        })
      })
    })
  })

  it('should fail to commit transaction that had run failures', async () => {
    const tx1 = session.beginTransaction()

    await expectAsync(tx1.run('CREATE (:Person)')).toBeResolved()
    await expectAsync(tx1.run('RETURN foo')).toBeRejectedWith(
      jasmine.objectContaining({
        code: 'Neo.ClientError.Statement.SyntaxError'
      })
    )
    await expectAsync(tx1.commit()).toBeRejectedWith(
      jasmine.objectContaining({
        message: jasmine.stringMatching(/Cannot commit this transaction/)
      })
    )

    const tx2 = session.beginTransaction()
    const result = await tx2.run('MATCH (n:Person) RETURN count(n)')
    expect(result.records[0].get(0).toNumber()).toEqual(0)
  })

  it('should expose server info on successful query', done => {
    const statement = 'RETURN 1'

    const tx = session.beginTransaction()
    tx.run(statement)
      .then(result => {
        const sum = result.summary
        expect(sum.server).toBeDefined()
        expect(sum.server.address).toEqual('localhost:7687')
        expect(sum.server.version).toBeDefined()
        tx.commit().then(done)
      })
      .catch(console.log)
  })

  it('should expose server info on successful query using observer', done => {
    // Given
    const statement = 'RETURN 1'

    // When & Then
    const tx = session.beginTransaction()
    tx.run(statement).subscribe({
      onNext: record => {},
      onError: () => {},
      onCompleted: summary => {
        const server = summary.server

        expect(server).toBeDefined()
        expect(server.address).toEqual('localhost:7687')
        expect(server.version).toBeDefined()

        done()
      }
    })
  })

  it('should fail nicely for illegal statement', async () => {
    const tx = session.beginTransaction()

    expect(() => tx.run()).toThrowError(TypeError)
    expect(() => tx.run(null)).toThrowError(TypeError)
    expect(() => tx.run({})).toThrowError(TypeError)
    expect(() => tx.run(42)).toThrowError(TypeError)
    expect(() => tx.run([])).toThrowError(TypeError)
    expect(() => tx.run(['CREATE ()'])).toThrowError(TypeError)

    expect(() => tx.run({ statement: 'CREATE ()' })).toThrowError(TypeError)
    expect(() => tx.run({ cypher: 'CREATE ()' })).toThrowError(TypeError)
  })

  it('should accept a statement object ', done => {
    const tx = session.beginTransaction()
    const statement = { text: 'RETURN 1 AS a' }

    tx.run(statement)
      .then(result => {
        expect(result.records.length).toBe(1)
        expect(result.records[0].get('a').toInt()).toBe(1)
        done()
      })
      .catch(console.log)
  })

  it('should be open when neither committed nor rolled back', () => {
    const tx = session.beginTransaction()
    expect(tx.isOpen()).toBeTruthy()
  })

  it('should not be open after commit', done => {
    const tx = session.beginTransaction()

    tx.run('CREATE ()').then(() => {
      tx.commit().then(() => {
        expect(tx.isOpen()).toBeFalsy()
        done()
      })
    })
  })

  it('should not be open after rollback', done => {
    const tx = session.beginTransaction()

    tx.run('CREATE ()').then(() => {
      tx.rollback().then(() => {
        expect(tx.isOpen()).toBeFalsy()
        done()
      })
    })
  })

  it('should not be open after run error', done => {
    const tx = session.beginTransaction()

    tx.run('RETURN').catch(() => {
      expect(tx.isOpen()).toBeFalsy()
      done()
    })
  })

  it('should respect socket connection timeout', done => {
    testConnectionTimeout(false, done)
  })

  it('should respect TLS socket connection timeout', done => {
    testConnectionTimeout(true, done)
  })

  it('should fail for invalid query parameters', done => {
    const tx = session.beginTransaction()

    expect(() => tx.run('RETURN $value', 'Hello')).toThrowError(TypeError)
    expect(() => tx.run('RETURN $value', 12345)).toThrowError(TypeError)
    expect(() => tx.run('RETURN $value', () => 'Hello')).toThrowError(TypeError)

    tx.rollback().then(() => done())
  })

  it('should allow rollback after failure', done => {
    const tx = session.beginTransaction()
    tx.run('WRONG QUERY')
      .then(() => done.fail('Expected to fail'))
      .catch(error => {
        expectSyntaxError(error)

        tx.rollback()
          .catch(error => done.fail(error))
          .then(() => done())
      })
  })

  it('should return empty promise on commit', async () => {
    const tx = session.beginTransaction()
    const result = await tx.commit()

    expect(result).toBeUndefined()
  })

  it('should return empty promise on rollback', async () => {
    const tx = session.beginTransaction()
    const result = await tx.rollback()

    expect(result).toBeUndefined()
  })

  function expectSyntaxError (error) {
    expect(error.code).toBe('Neo.ClientError.Statement.SyntaxError')
  }

  function expectValidLastBookmark (session) {
    expect(session.lastBookmark()).toBeDefined()
    expect(session.lastBookmark()).not.toBeNull()
  }

  function testConnectionTimeout (encrypted, done) {
    const boltUri = 'bolt://10.0.0.0' // use non-routable IP address which never responds
    const config = { encrypted: encrypted, connectionTimeout: 1000 }

    const localDriver = neo4j.driver(boltUri, sharedNeo4j.authToken, config)
    const session = localDriver.session()
    const tx = session.beginTransaction()
    tx.run('RETURN 1')
      .then(() =>
        tx
          .rollback()
          .then(() => session.close())
          .then(() => done.fail('Query did not fail'))
      )
      .catch(error =>
        tx
          .rollback()
          .then(() => session.close())
          .then(() => {
            expect(error.code).toEqual(neo4j.error.SERVICE_UNAVAILABLE)

            // in some environments non-routable address results in immediate 'connection refused' error and connect
            // timeout is not fired; skip message assertion for such cases, it is important for connect attempt to not hang
            if (error.message.indexOf('Failed to establish connection') === 0) {
              expect(error.message).toEqual(
                'Failed to establish connection in 1000ms'
              )
            }

            done()
          })
      )
  }
})

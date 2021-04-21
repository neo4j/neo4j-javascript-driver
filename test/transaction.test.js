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
import { ServerVersion } from '../src/internal/server-version'
import { READ } from '../src/driver'

describe('#integration transaction', () => {
  let driver
  let session
  // eslint-disable-next-line no-unused-vars
  let serverVersion

  beforeEach(async () => {
    driver = neo4j.driver(
      `bolt://${sharedNeo4j.hostname}`,
      sharedNeo4j.authToken
    )
    session = driver.session()

    const result = await session.run('MATCH (n) DETACH DELETE n')
    serverVersion = ServerVersion.fromString(result.summary.server.version)
  })

  afterEach(async () => {
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
  }, 60000)

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
  }, 60000)

  it('should populate result.summary.server.protocolVersion for transaction#run', done => {
    const tx = session.beginTransaction()
    tx.run('CREATE (:TXNode1)')
      .then(result => {
        tx.commit()
          .then(() => {
            expect(result.summary.server.protocolVersion).toBeDefined()
            expect(result.summary.server.protocolVersion).not.toBeLessThan(0)
            done()
          })
          .catch(done.fail.bind(done))
      })
      .catch(done.fail.bind(done))
  }, 60000)

  it('should handle interactive session', done => {
    const tx = session.beginTransaction()
    tx.run("RETURN 'foo' AS res")
      .then(result => {
        tx.run('CREATE ({name: $param})', {
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
  }, 60000)

  it('should handle failures with subscribe', done => {
    const tx = session.beginTransaction()
    tx.run('THIS IS NOT CYPHER').catch(error => {
      expect(error.code).toEqual('Neo.ClientError.Statement.SyntaxError')
      done()
    })
  }, 60000)

  it('should handle failures with catch', done => {
    const tx = session.beginTransaction()
    tx.run('THIS IS NOT CYPHER').subscribe({
      onError: error => {
        expect(error.code).toEqual('Neo.ClientError.Statement.SyntaxError')
        done()
      }
    })
  }, 60000)

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
          /Cannot run query in this transaction, because .* error/
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
  }, 60000)

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
  }, 60000)

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
  }, 60000)

  it('should throw when provided string (bookmark) parameter', () => {
    expect(() => session.beginTransaction('bookmark')).toThrowError(TypeError)
  }, 60000)

  it('should throw when provided string[] (bookmark) parameter', () => {
    expect(() => session.beginTransaction(['bookmark'])).toThrowError(TypeError)
  }, 60000)

  it('should fail to run query for unreachable bookmark', done => {
    const tx1 = session.beginTransaction()
    tx1
      .run('CREATE ()')
      .then(result => {
        expect(result.summary.counters.updates().nodesCreated).toBe(1)

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
              // Checking message text on  <= 4.0, check code for >= 4.1
              expect(
                error.message.includes('not up to the requested version') ||
                  error.code === 'Neo.ClientError.Transaction.InvalidBookmark'
              ).toBeTruthy()
              done()
            })
          })
          .catch(console.log)
      })
      .catch(console.log)
  }, 60000)

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
  }, 60000)

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
  }, 60000)

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
  }, 60000)

  it('should expose server info on successful query', done => {
    const query = 'RETURN 1'

    const tx = session.beginTransaction()
    tx.run(query)
      .then(result => {
        const sum = result.summary
        expect(sum.server).toBeDefined()
        expect(sum.server.address).toEqual(`${sharedNeo4j.hostname}:7687`)
        expect(sum.server.version).toBeDefined()
        tx.commit().then(done)
      })
      .catch(console.log)
  }, 60000)

  it('should expose server info on successful query using observer', done => {
    // Given
    const query = 'RETURN 1'

    // When & Then
    const tx = session.beginTransaction()
    tx.run(query).subscribe({
      onNext: record => {},
      onError: () => {},
      onCompleted: summary => {
        const server = summary.server

        expect(server).toBeDefined()
        expect(server.address).toEqual(`${sharedNeo4j.hostname}:7687`)
        expect(server.version).toBeDefined()

        done()
      }
    })
  }, 60000)

  it('should fail nicely for illegal query', async () => {
    const tx = session.beginTransaction()

    expect(() => tx.run()).toThrowError(TypeError)
    expect(() => tx.run(null)).toThrowError(TypeError)
    expect(() => tx.run({})).toThrowError(TypeError)
    expect(() => tx.run(42)).toThrowError(TypeError)
    expect(() => tx.run([])).toThrowError(TypeError)
    expect(() => tx.run(['CREATE ()'])).toThrowError(TypeError)

    expect(() => tx.run({ query: 'CREATE ()' })).toThrowError(TypeError)
    expect(() => tx.run({ cypher: 'CREATE ()' })).toThrowError(TypeError)
  }, 60000)

  it('should accept a query object ', done => {
    const tx = session.beginTransaction()
    const query = { text: 'RETURN 1 AS a' }

    tx.run(query)
      .then(result => {
        expect(result.records.length).toBe(1)
        expect(result.records[0].get('a').toInt()).toBe(1)
        done()
      })
      .catch(console.log)
  }, 60000)

  it('should be open when neither committed nor rolled back', () => {
    const tx = session.beginTransaction()
    expect(tx.isOpen()).toBeTruthy()
  }, 60000)

  it('should not be open after commit', done => {
    const tx = session.beginTransaction()

    tx.run('CREATE ()').then(() => {
      tx.commit().then(() => {
        expect(tx.isOpen()).toBeFalsy()
        done()
      })
    })
  }, 60000)

  it('should not be open after rollback', done => {
    const tx = session.beginTransaction()

    tx.run('CREATE ()').then(() => {
      tx.rollback().then(() => {
        expect(tx.isOpen()).toBeFalsy()
        done()
      })
    })
  }, 60000)

  it('should not be open after run error', done => {
    const tx = session.beginTransaction()

    tx.run('RETURN').catch(() => {
      expect(tx.isOpen()).toBeFalsy()
      done()
    })
  }, 60000)

  it('should respect socket connection timeout', done => {
    testConnectionTimeout(false, done)
  }, 60000)

  it('should respect TLS socket connection timeout', done => {
    testConnectionTimeout(true, done)
  }, 60000)

  it('should fail for invalid query parameters', done => {
    const tx = session.beginTransaction()

    expect(() => tx.run('RETURN $value', 'Hello')).toThrowError(TypeError)
    expect(() => tx.run('RETURN $value', 12345)).toThrowError(TypeError)
    expect(() => tx.run('RETURN $value', () => 'Hello')).toThrowError(TypeError)

    tx.rollback().then(() => done())
  }, 60000)

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
  }, 60000)

  it('should return empty promise on commit', async () => {
    const tx = session.beginTransaction()
    const result = await tx.commit()

    expect(result).toBeUndefined()
  }, 60000)

  it('should return empty promise on rollback', async () => {
    const tx = session.beginTransaction()
    const result = await tx.rollback()

    expect(result).toBeUndefined()
  }, 60000)

  it('should reset transaction', async done => {
    const session = driver.session({ defaultAccessMode: READ })
    const tx = session.beginTransaction()
    await tx.run('RETURN 1')

    const closePromise = session.close()
    try {
      await tx.run('Match (n:Person) RETURN n')
    } catch (error) {
      expect(error.message).toBe(
        'You cannot run more transactions on a closed session.'
      )
      await closePromise
      done()
    }
  }, 60000)

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
          .catch(done.fail.bind(done))
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
          .catch(done.fail.bind(done))
      )
  }
})

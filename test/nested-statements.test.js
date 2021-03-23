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
    session = driver.session({ fetchSize: 2 })

    protocolVersion = await sharedNeo4j.cleanupAndGetProtocolVersion(driver)
  })

  afterEach(async () => {
    await driver.close()
  })

  it('should handle nested queries within one transaction', done => {
    const size = 20
    let count = 0
    const tx = session.beginTransaction()
    const results = []
    tx.run('UNWIND range(1, $size) AS x RETURN x', { size: size }).subscribe({
      onNext: record => {
        const x = record.get('x').toInt()
        let index = 0
        const result = tx.run(
          'UNWIND range (1, $x) AS x CREATE (n:Node {id: x}) RETURN n.id',
          { x: x }
        )
        results.push(result)
        result.subscribe({
          onNext (record) {
            const value = record.get('n.id')
            index++
            expect(value.toInt()).toEqual(index)
          },
          onCompleted (summary) {
            expect(index).toEqual(x)
            count += x
          }
        })
      },
      onCompleted: () => {
        Promise.all(results).then(() => {
          tx.commit().then(() => {
            expect(count).toBe(((1 + size) * size) / 2)
            session.close().then(() => done())
          })
        })
      },
      onError: error => {
        console.log(error)
      }
    })
  }, 60000)

  it('should give proper error when nesting queries within one session', done => {
    const size = 20
    const count = 0
    const result = session.run('UNWIND range(1, $size) AS x RETURN x', {
      size: size
    })
    result.subscribe({
      onNext: async record => {
        const x = record.get('x').toInt()
        await expectAsync(
          session.run('CREATE (n:Node {id: $x}) RETURN n.id', { x: x })
        ).toBeRejectedWith(
          jasmine.objectContaining({
            message:
              'Queries cannot be run directly on a session with an open transaction; ' +
              'either run from within the transaction or use a different session.'
          })
        )
      },
      onCompleted: () => {
        session.close().then(() => done())
      },
      onError: error => {
        console.log(error)
      }
    })
  }, 60000)

  it('should handle sequential query runs within one session', done => {
    const size = 20
    let count = 0
    session
      .run('UNWIND range(1, $size) AS x RETURN x', { size: size })
      .then(async result => {
        for (const record of result.records) {
          const x = record.get('x')
          const innerResult = await session.run(
            'CREATE (n:Node {id: $x}) RETURN n.id',
            { x: x }
          )
          expect(innerResult.records.length).toEqual(1)
          expect(innerResult.records[0].get('n.id')).toEqual(x)
          count++
        }
        expect(count).toEqual(size)
        session.close().then(() => done())
      })
  }, 60000)
})

/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [https://neo4j.com]
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
import neo4j, { Driver, QueryResult, int } from '../../'
import Config from './config'

describe('neo4j-driver-lite', () => {
  let driver: Driver

  beforeAll(async () => {
    await Config.startNeo4j()
  }, 20000)

  afterAll(async () => {
    await Config.stopNeo4j()
  }, 20000)

  beforeEach(() => {
    driver = neo4j.driver(
      `${Config.scheme}://${Config.hostname}:${Config.boltPort}`,
      neo4j.auth.basic(Config.username, Config.password)
    )
  })

  afterEach(async () => {
    await driver?.close()
  })

  Config.testNonClusterSafe('should run a query over a session', async () => {
    const result: QueryResult = await driver.session().run('RETURN 2')
    expect(result.records.length).toEqual(1)
    expect(result.records[0].length).toEqual(1)
    result.records[0].forEach(val => expect(val).toEqual(int(2)))
  })

  test('hasReachableServer success', async () => {
    await expect(neo4j.hasReachableServer(`${Config.scheme}://${Config.hostname}:${Config.boltPort}`)).resolves.toBe(true)
  })

  test('hasReachableServer failure', async () => {
    await expect(neo4j.hasReachableServer(`${Config.scheme}://${Config.hostname}:12`)).rejects.toBeInstanceOf(Error)
  })
})

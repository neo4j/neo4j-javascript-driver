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
import neo4j, { Driver, QueryResult, int } from '../../'
import {
  hostname,
  password,
  scheme,
  username,
  testNonClusterSafe
} from './config'

describe('neo4j-driver-lite', () => {
  let driver: Driver

  beforeEach(() => {
    driver = neo4j.driver(
      `${scheme}://${hostname}`,
      neo4j.auth.basic(username, password)
    )
  })

  afterEach(async () => {
    await driver.close()
  })

  testNonClusterSafe('should run a query over a session', async () => {
    const result: QueryResult = await driver.session().run('RETURN 2')
    expect(result.records.length).toEqual(1)
    expect(result.records[0].length).toEqual(1)
    result.records[0].forEach(val => expect(val).toEqual(int(2)))
  })
})

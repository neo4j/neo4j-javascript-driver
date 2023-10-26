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
import neo4j from '../lib/mod.ts'

const env = Deno.env.toObject()

const username = env.TEST_NEO4J_USER || 'neo4j'
const password = env.TEST_NEO4J_PASS || 'password'
const hostname = env.TEST_NEO4J_HOST || 'localhost'
const scheme = env.TEST_NEO4J_SCHEME || 'bolt'
const boltPort = env.TEST_NEO4J_BOLT_PORT || 7687
const uri = `${scheme}://${hostname}:${boltPort}`
const authToken = neo4j.auth.basic(username, password)

// Deno will fail with resource leaks
Deno.test('neo4j.driver should be able to use explicity resource management', async () => {
  await using driver = neo4j.driver(uri, authToken)

  await driver.executeQuery('RETURN 1')
})

// Deno will fail with resource leaks
Deno.test('driver.session should be able to use explicity resource management', async () => {
  await using driver = neo4j.driver(uri, authToken)
  await using session = driver.session()

  await session.executeRead(tx => "RETURN 1")
})

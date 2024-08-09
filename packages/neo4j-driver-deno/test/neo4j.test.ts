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
import neo4j from '../lib/mod.ts'
//@ts-ignore
import { assertEquals } from "https://deno.land/std@0.182.0/testing/asserts.ts";

const env = Deno.env.toObject()

const username = env.TEST_NEO4J_USER || 'neo4j'
const password = env.TEST_NEO4J_PASS || 'password'
const hostname = env.TEST_NEO4J_HOST || 'localhost'
const scheme = env.TEST_NEO4J_SCHEME || 'bolt'
const boltPort = env.TEST_NEO4J_BOLT_PORT || 7687
const uri = `${scheme}://${hostname}:${boltPort}`
const authToken = neo4j.auth.basic(username, password)
const testContainersDisabled = env.TEST_CONTAINERS_DISABLED !== undefined
  ? env.TEST_CONTAINERS_DISABLED.toUpperCase() === 'TRUE'
  : false

// Deno will fail with resource leaks
Deno.test({
  name: 'neo4j.driver should be able to use explicity resource management',
  ignore: !testContainersDisabled,
  async fn() {
    await using driver = neo4j.driver(uri, authToken)

    await driver.executeQuery('RETURN 1')
  }
})

// Deno will fail with resource leaks
Deno.test({
  name: 'driver.session should be able to use explicity resource management',
  ignore: !testContainersDisabled,
  async fn() {
    await using driver = neo4j.driver(uri, authToken)
    await using session = driver.session()

    await session.executeRead(tx => "RETURN 1")

  }
})

// Deno will fail with resource leaks
Deno.test({
  name: 'session.beginTransaction should rollback the transaction if not committed',
  ignore: !testContainersDisabled,
  async fn() {
    await using driver = neo4j.driver(uri, authToken)
    await using session = driver.session()
    const name = "Must Be Conor"

    {
      await using tx = session.beginTransaction()
      await tx.run('CREATE (p:Person { name:$name }) RETURN p', { name }).summary()
    }

    const { records } = await driver.executeQuery('MATCH (p:Person { name:$name }) RETURN p', { name })
    assertEquals(records.length, 0)
  }
})


// Deno will fail with resource leaks
Deno.test({
  name: 'session.beginTransaction should noop if resource committed',
  ignore: !testContainersDisabled,
  async fn() {
    await using driver = neo4j.driver(uri, authToken)
    const name = "Must Be Conor"

    try {
      await using session = driver.session()

      {
        await using tx = session.beginTransaction()
        await tx.run('CREATE (p:Person { name:$name }) RETURN p', { name }).summary()
        await tx.commit()
      }

      const { records } = await driver.executeQuery('MATCH (p:Person { name:$name }) RETURN p', { name })
      assertEquals(records.length, 1)
    } finally {
      // cleaning up
      await driver.executeQuery('MATCH (p:Person { name:$name }) DELETE(p)', { name })
    }

  }
})

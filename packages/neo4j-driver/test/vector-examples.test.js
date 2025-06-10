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

import neo4j from '../src'
import sharedNeo4j from './internal/shared-neo4j'

describe('#integration vector type api suggestion', () => {
  let driverGlobal
  const uri = `bolt://${sharedNeo4j.hostnameWithBoltPort}`

  beforeAll(async () => {
    driverGlobal = neo4j.driver(uri, sharedNeo4j.authToken)
  })

  beforeEach(async () => {
    const driver = driverGlobal
    const session = driver.session()
    await session.run('MATCH (n) DETACH DELETE n')
    await session.close()
  })

  afterAll(async () => {
    await driverGlobal.close()
  })

  it('write and read vectors', async () => {
    const driver = driverGlobal

    const bufferWriter = Uint8Array.from([1, 1])
    await driver.executeQuery('CREATE (p:Product) SET p.vector_from_array = $vector_from_array, p.vector_from_buffer = $vector_from_buffer', {
      vector_from_array: neo4j.vector(Float32Array.from([1, 2, 3, 4])), // Typed arrays can be created from a regular list of Numbers
      vector_from_buffer: neo4j.vector(new Uint8Array(bufferWriter.buffer)) // Or from a bytebuffer
    })
    const res = await driver.executeQuery('MATCH (p:Product) RETURN p.vector_from_array as arrayVector, p.vector_from_buffer as bufferVector')

    const arrayVec = res.records[0].get('arrayVector').typedArray
    const bufferVec = res.records[0].get('bufferVector').typedArray

    expect(arrayVec[0]).toBe(1)
    expect(bufferVec[1]).toBe(1)
  })
})

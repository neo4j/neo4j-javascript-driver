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

import HomeDatabaseCache from '../../src/internal/homedb-cache'

describe('#unit HomeDatabaseCache', () => {
  it('should build homedb cache', () => {
    const cache = new HomeDatabaseCache(10000)
    cache.set('DEFAULT', 'neo4j')
    expect(cache.get('DEFAULT')).toBe('neo4j')
    cache.set('basic:hi', 'neo4j')
    expect(cache.get('basic:hi')).toBe('neo4j')
  })

  it('should cap homeDb size by removing least recently used', async () => {
    const cache = new HomeDatabaseCache(1000)
    for (let i = 0; i < 999; i++) {
      cache.set(i.toString(), 'neo4j')
    }
    await new Promise(resolve => setTimeout(resolve, 100))
    cache.set('5', 'neo4j')
    cache.get('55')
    for (let i = 999; i < 1050; i++) {
      cache.set(i.toString(), 'neo4j')
    }
    expect(cache.get('1')).toEqual(undefined)
    expect(cache.get('61')).toEqual(undefined)
    expect(cache.get('5')).toEqual('neo4j')
    expect(cache.get('55')).toEqual('neo4j')
    expect(cache.get('101')).toEqual('neo4j')
    expect(cache.get('1001')).toEqual('neo4j')
  })
})

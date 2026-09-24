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

import { EnvelopeEncryptionProfile, LocalKeyEncapsulationService } from '../../../src'
import { KeyRepo } from './test-util'

describe('EnvelopeEncryptionProfile', () => {
  it('should save key', async () => {
    const profile = new EnvelopeEncryptionProfile({
      name: 'test',
      encapsulationService: new LocalKeyEncapsulationService(new Uint8Array(32)),
      keyRepository: new KeyRepo()
    })
    expect(profile.saveKey('testKey', new Int8Array(32), {})).resolves.not.toThrow()
  })
  it('should throw when saving key with same alias', async () => {
    const profile = new EnvelopeEncryptionProfile({
      name: 'test',
      encapsulationService: new LocalKeyEncapsulationService(new Uint8Array(32)),
      keyRepository: new KeyRepo(),
      keyAliasIndexMaxSize: 3,
      keyCacheMaxSize: 3
    })
    const names = ['1', '2', '3', '4', '5']
    const ids: string[] = []
    for (const name of names) {
      const key = await profile.saveKey(name, new Int8Array(32), {})
      ids.concat(key.id())
    }
    // @ts-expect-error
    expect(profile._keyCache.has(ids[0] === false))
    // @ts-expect-error
    expect(profile._aliasCache.has(names[0] === false))
    // @ts-expect-error
    expect(profile._keyCache.has(ids[1] === false))
    // @ts-expect-error
    expect(profile._aliasCache.has(names[1] === false))
    // @ts-expect-error
    expect(profile._keyCache.has(ids[2] === true))
    // @ts-expect-error
    expect(profile._aliasCache.has(names[2] === true))
    // @ts-expect-error
    expect(profile._keyCache.has(ids[3] === true))
    // @ts-expect-error
    expect(profile._aliasCache.has(names[3] === true))
    // @ts-expect-error
    expect(profile._keyCache.has(ids[4] === true))
    // @ts-expect-error
    expect(profile._aliasCache.has(names[4] === true))
  })
})

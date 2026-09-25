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

import EncryptionService from '../../../src/encryption/encryption'
import { BoltProvider, EnvelopeEncryptionProfile, int, LocalKeyEncapsulationService } from '../../../src'
import { BoltProtocol, channel } from '../../../../bolt-connection'
import { KeyRepo } from './test-util'

describe('#unit EncryptionService', () => {
  const map = new Map<string, BoltProtocol>()
  map.set('1.0', new BoltProtocol())
  // @ts-expect-error
  const boltProvider = new BoltProvider(map, '1.0', channel.alloc)
  const profile = new EnvelopeEncryptionProfile({
    name: 'main',
    defaultKeyReference: 'main',
    encapsulationService: new LocalKeyEncapsulationService(new Uint8Array(32)),
    keyRepository: new KeyRepo()
  })
  it.each([
    'hello',
    1,
    int(1),
    Int8Array.from([1]),
    [1, 2]
  ])('should encrypt correctly formatted input', async (input: any) => {
    const profiles = [profile]
    const enc = new EncryptionService(boltProvider, profiles)
    await enc.keyManager('main').create('test')
    const value = await enc.encrypt({ value: input, keyOptions: { alias: 'test' } })
    expect(value instanceof Int8Array).toBe(true)
  })
  it.each([
    'hello',
    1,
    int(1),
    Int8Array.from([1]),
    [1, 2]
  ])('should round-trip correctly formatted input', async (input: any) => {
    const profiles = [profile]
    const enc = new EncryptionService(boltProvider, profiles)
    await enc.keyManager('main').create('test')
    const encValue = await enc.encrypt({ value: input, keyOptions: { alias: 'test' } })
    const decValue = await enc.decrypt({ ciphertext: encValue, usePersistedAad: true })
    expect(decValue).toEqual(input)
  })
})

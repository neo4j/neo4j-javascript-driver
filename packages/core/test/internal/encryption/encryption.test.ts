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
import { BoltProvider, DateTime, EnvelopeEncryptionProfile, int, LocalKeyEncapsulationService, Point, ProtocolVersion, uuid, vector } from '../../../src/'
import { BoltProtocol, channel } from '../../../../bolt-connection'
import { KeyRepo } from './test-util'
import UnsupportedType from '../../../src/unsupported-type'

describe('#unit EncryptionService', () => {
  const map = new Map<string, { version: ProtocolVersion, bolt: BoltProtocol }>()
  map.set('1', { version: new ProtocolVersion(1, 0), bolt: new BoltProtocol() })
  // @ts-expect-error
  const boltProvider = new BoltProvider(map, '1', channel.alloc)
  const profile = new EnvelopeEncryptionProfile({
    name: 'main',
    encapsulationService: new LocalKeyEncapsulationService(new Uint8Array(32)),
    keyRepository: new KeyRepo()
  })
  it.each([
    'hello',
    1,
    int(1),
    Int8Array.from([1]),
    [1, 2],
    uuid('8be4df61-93ca-11d2-aa0d-00e098032b8c'),
    vector(Float32Array.from([1, 2, 3])),
    new DateTime(int(1), int(1), int(1), int(1), int(1), int(1), int(1), int(1000)),
    [int(1), int(2)],
    [new Point(7203, 1, 2), new Point(7203, 3, 4)],
    true
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
    [1, 2],
    uuid('8be4df61-93ca-11d2-aa0d-00e098032b8c'),
    vector(Float32Array.from([1, 2, 3])),
    new DateTime(int(1), int(1), int(1), int(1), int(1), int(1), int(1), int(1000)),
    [int(1), int(2)],
    [new Point(int(7203), 1, 2), new Point(int(7203), 3, 4)],
    true
  ])('should round-trip correctly formatted input', async (input: any) => {
    const profiles = [profile]
    const enc = new EncryptionService(boltProvider, profiles)
    await enc.keyManager('main').create('test')
    const encValue = await enc.encrypt({ value: input, keyOptions: { alias: 'test' } })
    const decValue = await enc.decrypt({ ciphertext: encValue, usePersistedAad: true })
    expect(decValue).toEqual(input)
  })

  it('should round-trip list of BigInt', async () => {
    const profiles = [profile]
    const enc = new EncryptionService(boltProvider, profiles)
    const list = [BigInt(1), BigInt(2)]
    await enc.keyManager('main').create('test')
    const encValue = await enc.encrypt({ value: [BigInt(1), BigInt(2)], keyOptions: { alias: 'test' } })
    const decValue: BigInt[] | UnsupportedType = await enc.decrypt<BigInt[]>({ ciphertext: encValue, usePersistedAad: true })
    expect(decValue instanceof UnsupportedType).toBe(false)
    expect(decValue[0] === list[0]).toBe(true)
    expect(decValue[1] === list[1]).toBe(true)
  })

  it.each([
    'hello',
    int(1),
    Int8Array.from([1]),
    true
  ])('Aad should function properly', async (input: any) => {
    const profiles = [profile]
    const enc = new EncryptionService(boltProvider, profiles)
    await enc.keyManager('main').create('test')
    const encValue = await enc.encrypt({ value: 'hello', keyOptions: { alias: 'test' }, aad: input })
    const persistedAAD = await enc.decrypt({ ciphertext: encValue, usePersistedAad: true })
    expect(persistedAAD).toEqual('hello')
    const explicitAAD = await enc.decrypt({ ciphertext: encValue, aad: input })
    expect(explicitAAD).toEqual('hello')
    expect(async () => await enc.decrypt({ ciphertext: encValue })).rejects.toThrow('Propety decryption failed due to internal error, see cause.')
  })
})

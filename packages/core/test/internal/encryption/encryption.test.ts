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
    const value = await enc.encrypt(input, { alias: 'test' })
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
    const encValue = await enc.encrypt(input, { alias: 'test' })
    const decValue = await enc.decrypt(encValue, true)
    expect(decValue).toEqual(input)
  })
})

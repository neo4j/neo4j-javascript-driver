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
      keyAliasCacheMaxSize: 3,
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

import { json } from '../index.ts'
import { newError } from '../error.ts'
import { EncapsulatedKey, EncapsulatedKeyRepository } from './key-encapsulation/encapsulated-key.ts'
import { KeyEncapsulationService } from './key-encapsulation/key-encapsulation-service.ts'

export type EncryptionProfile = EnvelopeEncryptionProfile

interface CacheEntry<T> {
  entry: T
  retrieved: Date
}

export class EnvelopeEncryptionProfile {
  public name: string
  public defaultKeyReference: string
  public encapsulationService: KeyEncapsulationService
  public _keyRepository: EncapsulatedKeyRepository
  private readonly _keyCacheTTL: number
  private readonly _keyCacheMaxSize: number
  private readonly _keyAliasCacheTTL: number
  private readonly _keyAliasCacheMaxSize: number
  private readonly _keyCache: Map<string, CacheEntry<EncapsulatedKey>>
  private readonly _aliasCache: Map<string, CacheEntry<string>>

  constructor (config: {
    name: string
    defaultKeyReference: string
    encapsulationService: KeyEncapsulationService
    keyRepository: EncapsulatedKeyRepository
    keyCacheTTL?: number
    keyCacheMaxSize?: number
    keyAliasCacheTTL?: number
    keyAliasCacheMaxSize?: number
  }) {
    this.name = config.name
    this.defaultKeyReference = config.defaultKeyReference
    this.encapsulationService = config.encapsulationService
    this._keyRepository = config.keyRepository
    this._keyCacheTTL = config.keyCacheTTL ?? 15 * 60 * 1000
    this._keyCacheMaxSize = config.keyCacheMaxSize ?? 100
    this._keyCache = new Map<string, CacheEntry<EncapsulatedKey>>()
    this._keyAliasCacheTTL = config.keyAliasCacheTTL ?? 15 * 1000
    this._keyAliasCacheMaxSize = config.keyAliasCacheMaxSize ?? 100
    this._aliasCache = new Map<string, CacheEntry<string>>()
  }

  async findKey (options?: string | { alias?: string, id?: string }): Promise<EncapsulatedKey | undefined> {
    let key
    if (options == null){
      key = await this._checkAliasCache(this.defaultKeyReference)
    } else if (typeof options === 'string') {
      key = await this._checkKeyCache(options)
    } else if (options.id != null) {
      key = await this._checkKeyCache(options.id)
    } else if (options.alias != null) {
      key = await this._checkAliasCache(options.alias)
    } else {
      throw newError(`invalid key options: ${json.stringify(options)}`)
    }
    return key
  }

  async saveKey (alias: string, encapsulation: Int8Array, metadata: Record<string, string>): Promise<EncapsulatedKey> {
    return await this._keyRepository.save(alias, encapsulation, metadata)
  }

  async _checkKeyCache (id: string): Promise<EncapsulatedKey | undefined> {
    if (this._keyCache.has(id)) {
      const entry = this._keyCache.get(id)
      if (new Date().getTime() - (entry?.retrieved.getTime() ?? 0) < (this._keyCacheTTL ?? 0)) {
        return entry?.entry
      }
    }
    const key = await this._keyRepository.findById(id)
    this._keyCache.set(id, { entry: key, retrieved: new Date() })
    this._pruneCache(this._keyCache, this._keyCacheMaxSize)
    return key
  }

  async _checkAliasCache (alias: string): Promise<EncapsulatedKey | undefined> {
    if (this._aliasCache.has(alias)) {
      const entry = this._aliasCache.get(alias)
      if (new Date().getTime() - (entry?.retrieved.getTime() ?? 0) < (this._keyAliasCacheTTL ?? 0)) {
        // @ts-expect-error
        return await this._checkKeyCache(entry?.entry)
      }
    }
    const key = await this._keyRepository.findByAlias(alias)
    this._aliasCache.set(alias, { entry: key.id(), retrieved: new Date() })
    this._keyCache.set(key.id(), { entry: key, retrieved: new Date() })
    this._pruneCache(this._aliasCache, this._keyAliasCacheMaxSize)
    this._pruneCache(this._keyCache, this._keyCacheMaxSize)
    return key
  }

  _pruneCache (cache: Map<string, { entry: any, retrieved: Date }>, maxSize: number): void {
    if (cache.size > maxSize) {
      const entries = Array.from(cache.entries())
      entries.sort((a, b) => b[1].retrieved.getTime() - a[1].retrieved.getTime())
      let i = 0
      while (cache.size > maxSize) {
        cache.delete(entries[i][0])
        i++
      }
    }
  }
}

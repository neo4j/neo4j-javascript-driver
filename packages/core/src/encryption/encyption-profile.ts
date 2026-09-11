import { json } from '..'
import { newError } from '../error'
import { EncapsulatedKey, EncapsulatedKeyRepository } from './key-encapsulation/encapsulated-key'
import { KeyEncapsulationService } from './key-encapsulation/key-encapsulation-service'

export type EncryptionProfile = EnvelopeEncryptionProfile

interface CacheEntry<T> {
  entry: T
  retrieved: Date
}

/**
 * Configuration for an encryption profile, which combines a {@link KeyEncapsulationService} and {@link keyRepository} to allow the driver to access encapsulated keys and use them.
 *
 * @experimental Part of the Client-Side Encryption preview feature.
 */
export class EnvelopeEncryptionProfile {
  public name: string
  public encapsulationService: KeyEncapsulationService
  public keyRepository: EncapsulatedKeyRepository
  private readonly _keyCacheTTL: number
  private readonly _keyCacheMaxSize: number
  private readonly _keyAliasCacheTTL: number
  private readonly _keyAliasCacheMaxSize: number
  private readonly _keyCache: Map<string, CacheEntry<EncapsulatedKey>>
  private readonly _aliasCache: Map<string, CacheEntry<string>>

  /**
   *
   * @param {Object} config - Configurations
   * @param {string} config.name - Name of the profile, must be the same on all drivers used to access the encrypted data.
   * @param {KeyEncapsulationService} config.encapsulationService - Encapsulation service used to encapsulate and dencapsulate keys. The driver ships with {@link LocalKeyEncapsulationService}, other implementations can be found as separate packages.
   * @param {EncapsulatedKeyRepository} config.keyRepository - Implementation of the {@link EncapsulatedKeyRepository} interface, must be implemented so that the driver can access your key repository.
   * @param {number} config.keyCacheTTL - How long to keep a retrieved encapsulated keys cached by Id - defaults to 15 minutes
   * @param {number} config.keyCacheMaxSize - How many items to keep in the key cache before pruning the oldest - defaults to 100
   * @param {number} config.keyAliasCacheTTL - How long to keep the mapping of alias to key cached - defaults to 15 seconds
   * @param {number} config.keyAliasCacheMaxSize - How many items to keep in the alias cache before pruning the oldest - defaults to 100
   */
  constructor (config: {
    name: string
    encapsulationService: KeyEncapsulationService
    keyRepository: EncapsulatedKeyRepository
    keyCacheTTL?: number
    keyCacheMaxSize?: number
    keyAliasCacheTTL?: number
    keyAliasCacheMaxSize?: number
  }) {
    this.name = config.name
    this.encapsulationService = config.encapsulationService
    this.keyRepository = config.keyRepository
    this._keyCacheTTL = config.keyCacheTTL ?? 15 * 60 * 1000
    this._keyCacheMaxSize = config.keyCacheMaxSize ?? 100
    this._keyCache = new Map<string, CacheEntry<EncapsulatedKey>>()
    this._keyAliasCacheTTL = config.keyAliasCacheTTL ?? 15 * 1000
    this._keyAliasCacheMaxSize = config.keyAliasCacheMaxSize ?? 100
    this._aliasCache = new Map<string, CacheEntry<string>>()
  }

  async findKey (options: string | { alias?: string, id?: string }): Promise<EncapsulatedKey | undefined> {
    let key
    if (typeof options === 'string') {
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
    return await this.keyRepository.save(alias, encapsulation, metadata)
  }

  async _checkKeyCache (id: string): Promise<EncapsulatedKey | undefined> {
    if (this._keyCache.has(id)) {
      const entry = this._keyCache.get(id)
      if (new Date().getTime() - (entry?.retrieved.getTime() ?? 0) < (this._keyCacheTTL ?? 0)) {
        return entry?.entry
      }
    }
    const key = await this.keyRepository.findById(id)
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
    const key = await this.keyRepository.findByAlias(alias)
    this._aliasCache.set(alias, { entry: key.id(), retrieved: new Date() })
    this._keyCache.set(key.id(), { entry: key, retrieved: new Date() })
    this._pruneCache(this._aliasCache, this._keyAliasCacheMaxSize)
    this._pruneCache(this._keyCache, this._keyCacheMaxSize)
    return key
  }

  private _pruneCache (cache: Map<string, { entry: any, retrieved: Date }>, maxSize: number): void {
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

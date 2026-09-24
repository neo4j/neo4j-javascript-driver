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

import { int, Integer, json } from '..'
import { newError } from '../error'
import { EncapsulatedKey, EncapsulatedKeyRecord, EncapsulatedKeyRecordRepository } from './key-encapsulation/encapsulated-key'
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
  public keyRepository: EncapsulatedKeyRecordRepository
  public type: string
  public version: Integer
  private readonly _keyCacheTTL: number
  private readonly _keyCacheMaxSize: number
  private readonly _keyAliasIndexTTL: number
  private readonly _keyAliasIndexMaxSize: number
  private readonly _keyCache: Map<string, CacheEntry<EncapsulatedKeyRecord>>
  private readonly _aliasCache: Map<string, CacheEntry<string>>

  /**
   *
   * @param {Object} config - Configurations
   * @param {string} config.name - Name of the profile, must be the same on all drivers used to access the encrypted data.
   * @param {KeyEncapsulationService} config.encapsulationService - Encapsulation service used to encapsulate and dencapsulate keys. The driver ships with {@link LocalKeyEncapsulationService}, other implementations can be found as separate packages.
   * @param {EncapsulatedKeyRecordRepository} config.keyRepository - Implementation of the {@link EncapsulatedKeyRecordRepository} interface, must be implemented so that the driver can access your key repository.
   * @param {number} config.keyCacheTTL - How long to keep a retrieved encapsulated keys cached by Id - defaults to 15 minutes
   * @param {number} config.keyCacheMaxSize - How many items to keep in the key cache before pruning the oldest - defaults to 100
   * @param {number} config.keyAliasIndexTTL - How long to keep the mapping of alias to key cached - defaults to 15 seconds
   * @param {number} config.keyAliasIndexMaxSize - How many items to keep in the alias cache before pruning the oldest - defaults to 100
   */
  constructor (config: {
    name: string
    encapsulationService: KeyEncapsulationService
    keyRepository: EncapsulatedKeyRecordRepository
    keyCacheTTL?: number
    keyCacheMaxSize?: number
    keyAliasIndexTTL?: number
    keyAliasIndexMaxSize?: number
  }) {
    this.name = config.name
    this.encapsulationService = config.encapsulationService
    this.keyRepository = config.keyRepository
    this._keyCacheTTL = config.keyCacheTTL ?? 15 * 60 * 1000
    this._keyCacheMaxSize = config.keyCacheMaxSize ?? 100
    this._keyCache = new Map<string, CacheEntry<EncapsulatedKeyRecord>>()
    this._keyAliasIndexTTL = config.keyAliasIndexTTL ?? 15 * 1000
    this._keyAliasIndexMaxSize = config.keyAliasIndexMaxSize ?? 100
    this._aliasCache = new Map<string, CacheEntry<string>>()
    this.type = 'ENVELOPE'
    this.version = int(1)
  }

  async findKey (options: string | { alias?: string, id?: string }): Promise<EncapsulatedKeyRecord | undefined> {
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
    return await this.keyRepository.create(alias, encapsulation, metadata)
  }

  async _checkKeyCache (id: string): Promise<EncapsulatedKeyRecord | undefined> {
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

  async _checkAliasCache (alias: string): Promise<EncapsulatedKeyRecord | undefined> {
    if (this._aliasCache.has(alias)) {
      const entry = this._aliasCache.get(alias)
      if (new Date().getTime() - (entry?.retrieved.getTime() ?? 0) < (this._keyAliasIndexTTL ?? 0)) {
        // @ts-expect-error
        return await this._checkKeyCache(entry?.entry)
      }
    }
    const key = await this.keyRepository.findByAlias(alias)
    this._aliasCache.set(alias, { entry: key.id(), retrieved: new Date() })
    this._keyCache.set(key.id(), { entry: key, retrieved: new Date() })
    this._pruneCache(this._aliasCache, this._keyAliasIndexMaxSize)
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

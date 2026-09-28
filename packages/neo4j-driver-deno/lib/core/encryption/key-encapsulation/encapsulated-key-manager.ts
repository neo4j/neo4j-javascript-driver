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

import { EncryptionProfile } from '../encyption-profile.ts'
import { EncapsulatedKey } from './encapsulated-key.ts'
import { KeyEncapsulationService } from './key-encapsulation-service.ts'

/**
 * A manager for encapsulated keys.
 *
 * {@link EnvelopeEncryptionProfile} requires data keys to exist before they can be used for encryption. This
 * manager provides operations for creating and managing such keys.
 * 
 * When creating a key, the manager uses the configured {@link KeyEncapsulationService} to generate and encapsulate a
 * new data key and registers the resulting {@link EncapsulatedKeyRecord} with the configured
 * {@link EncapsulatedKeyRecordRepository}.
 * 
 * @since 6.3.0
 * @experimental Part of the Client-Side Encrytion preview feature
 */
export class EncapsulatedKeyManager {
  private readonly _profile: EncryptionProfile
  private readonly _keyEncapsulationService: KeyEncapsulationService
  constructor (profile: EncryptionProfile, keyEncapsulationService: KeyEncapsulationService) {
    this._profile = profile
    this._keyEncapsulationService = keyEncapsulationService
  }

  /**
   * Creates a new key via the {@link KeyEncapsulationService} and saves it in the profile's configured {@link EncapsulatedKeyRecordRepository}
   *
   * @param {string} name - The alias the new key should be saved under in the {@link EncapsulatedKeyRecordRepository}
   * @returns {Promise<void>} Promise that resolves when the key is created, saved and ready to use.
   */
  async create (name: string): Promise<EncapsulatedKey> {
    const encapulated = await this._keyEncapsulationService.encapsulate({})
    return await this._profile.saveKey(name, encapulated.encapsulation(), encapulated.options())
  }

  /**
   * Finds an encapsulated key by its id.
   *
   * @param {string} id the key id
   * @return the encapsulated key or undefined when no key with the given id exists
   */
  async findById (id: string): Promise<EncapsulatedKey | undefined> {
    const record = await this._profile.findKey({ id })
    if (record != null) {
      return { id: record.id, alias: record.alias }
    } else {
      return undefined
    }
  }

  /**
   * Finds an encapsulated key by its alias.
   *
   * @param {string} alias the key alias
   * @return the encapsulated key or undefined when no key with the given alias exists
   */
  async findByAlias (alias: string): Promise<EncapsulatedKey | undefined> {
    const record = await this._profile.findKey({ alias })
    if (record != null) {
      return { id: record.id, alias: record.alias }
    } else {
      return undefined
    }
  }

  /**
   * Sets the alias of an encapsulated key by id. The alias must not be used by another key. To assign an alias
   * currently used by another key, it must first be deleted from that key.
   *
   * @param {string} id the key id
   * @param {string | undefined} alias the new key alias
   */
  async setAliasById (id: string, alias?: string): Promise<void> {
    return await this._profile.keyRepository.setAliasById(id, alias)
  }

  /**
   * Deletes the alias from encapsulated key by id.
   *
   * @param {string} id the key id
   */
  async deleteAliasById (id: string): Promise<void> {
    return await this.setAliasById(id, undefined)
  }

  /**
   * Deletes an encapsulated key by id.
   *
   * @param {string} id the key id, must not be {@literal null}
   */
  async deleteById (id: string): Promise<void> {
    return await this._profile.keyRepository.deleteById(id)
  }
}

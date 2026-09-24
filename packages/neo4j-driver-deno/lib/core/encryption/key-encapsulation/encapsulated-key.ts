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

/**
 * A repository for {@link EncapsulatedKeyRecord} data.
 * An implementation of this must be provided to a {@link EncryptionProfile} so that the driver knows where to store and retreive encapsulated keys.
 *
 * @since 6.3.0
 * @experimental Part of the Client-Side Encrytion preview feature
 */
export interface EncapsulatedKeyRecordRepository {
  /**
   * Finds and returns an {@link EncapsulatedKeyRecord} by its id.
   *
   * @param {string} id the key id
   * @return {Promise<EncapsulatedKeyRecord>} a promise that resolves to the key or undefined if no key with the given id exists
   */
  findById: (id: string) => Promise<EncapsulatedKeyRecord>

   /**
   * Finds and returns an {@link EncapsulatedKeyRecord} by its alias.
   *
   * @param {string} alias the key alias
   * @return {Promise<EncapsulatedKeyRecord>} a promise that resolves to the key or undefined if no key with the given alias exists
   */
  findByAlias: (alias: string) => Promise<EncapsulatedKeyRecord>

  /**
   * Creates the encapsulation as a key and assigns it a globally unique id.
   *
   * The generated id MUST be globally unique and immutable. Implementations SHOULD use a mechanism designed to
   * generate globally unique identifiers, such as UUIDs.
   *
   * @param {string} alias the key alias
   * @param {Int8Array} encapsulation the key encapsulation
   * @param {Record<string, string>} metadata the key metadata
   * @return {Promise<EncapsulatedKeyRecord>} a promise that resolves to the created key
   */
  create: (alias: string, encapsulation: Int8Array, metadata: Record<string, string>) => Promise<EncapsulatedKeyRecord>

  /**
   * Sets the alias of an encapsulated key by id. The alias must not be used by another key. To assign an alias
   * currently used by another key, it must first be deleted from that key.
   *
   * @param id the key id
   * @param alias the key alias, may be null or undefined to remove the alias
   * @return {Promise<void>} promise that resolves when the alias has been set
   */
  setAliasById: (id: string, alias: string) => Promise<void>

  /**
   * Deletes a key by id.
   *
   * @param {string} id the key id
   * @return {Promise<void>} promise that resolves when the key has been deleted
   */
  deleteById: (id: string) => Promise<void>
}


/**
 * A reference to an encapsulated key.
 *
 * Contains the key's globally unique id and, if assigned, its alias.
 *
 * @since 6.3.0
 * @experimental Part of the Client-Side Encrytion preview feature
 */
export interface EncapsulatedKey {
  /**
   * Returns the globally unique key id.
   *
   * @return {string} the key id
   */
  id: () => string

  /**
   * Returns the key alias if assigned.
   *
   * @return {string | undefined} the key alias
   */
  alias: () => string | undefined
}

/**
 * An encapsulated key with the data required to decapsulate it.
 * Extends {@link EncapsulatedKey} with the key encapsulation and associated metadata required by a
 * {@link KeyEncapsulationService} to decapsulate the key.
 *
 * @since 6.3.0
 * @experimental Part of the Client-Side Encrytion preview feature
 */
export interface EncapsulatedKeyRecord extends EncapsulatedKey {

  /**
   * Returns the key encapsulation.
   *
   * @return {Int8Array} the key encapsulation
   */
  encapsulation: () => Int8Array

  /**
   * Returns the key metadata.
   *
   * @return {Record<string, string>} the key metadata
   */
  metadata: () => Record<string, string>
}

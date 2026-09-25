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
 * Options used by a {@link KeyEncapsulationService} to encapsulate a key.
 *
 * Implementations of {@link KeyEncapsulationService} are expected to define a dedicated subtype of this interface
 * containing the options required by the particular key encapsulation mechanism.
 *
 * @see KeyEncapsulationService
 * @see KeyEncapsulationResult
 * @since 6.3.0
 * @experimental Part of the Client-Side Encrytion preview feature
 */
type KeyEncapsulationOptions = Record<string, string>

type SecretKey = Uint8Array

/**
 * The result of a key encapsulation operation.
 *
 * Contains the encapsulated key, the metadata required to decapsulate it, and the key itself.
 *
 * @since 6.3.0
 * @experimental Part of the Client-Side Encrytion preview feature
 */
export interface EncapsulationResult {
  /**
   * Returns the encapsulated key.
   *
   * @return {Int8Array} the encapsulation bytes
   */
  encapsulation: () => Int8Array

  /**
   * Returns the metadata associated with the encapsulated key.
   *
   * The metadata is provided to the {@link KeyEncapsulationService} when the key is decapsulated.
   *
   * @return {KeyEncapsulationOptions} the key metadata
   */
  options: () => KeyEncapsulationOptions

  /**
   * Returns the key.
   *
   * @return the key
   */
  key: () => SecretKey
}

/**
 * A service responsible for encapsulating and decapsulating keys.
 *
 * @see KeyEncapsulationOptions
 * @see KeyEncapsulationResult
 * @since 6.3.0
 * @experimental Part of the Client-Side Encrytion preview feature
 */
export interface KeyEncapsulationService {
  /**
   * Creates a new key, encapsulates it and returns the result.
   *
   * @param {KeyEncapsulationOptions} options the encapsulation options, depends on the implementation
   * @return {Promise<EncapsulationResult>} a promise that resolves to the encapsulation result
   */
  encapsulate: (options: KeyEncapsulationOptions) => Promise<EncapsulationResult>

  /**
   * Decapsulates encapsulated bytes.
   *
   * @param {Int8Array} encapsulation the encapsulated byte}
   * @param {KeyEncapsulationOptions} metadata the key metadata
   * @return {Promise<Uint8Array>} a promise that resolves to the decapsulated key
   */
  decapsulate: (encapsulation: Int8Array, metadata: KeyEncapsulationOptions) => Promise<Uint8Array>
}

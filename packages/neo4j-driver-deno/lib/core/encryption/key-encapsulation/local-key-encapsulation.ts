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

import { newError } from '../../error.ts'
import CryptoProvider from '../node/crypto.ts'
import { EncapsulationResult, KeyEncapsulationService } from './key-encapsulation-service.ts'

function u8ToB64 (u: Uint8Array): string {
  return btoa(String.fromCharCode(...u))
}

function b64Tou8 (b: string): Uint8Array {
  return Uint8Array.from(atob(b), (c: string) => c.charCodeAt(0))
}

/**
 * An implementation of {@link KeyEncapsulationService} that uses a local, 256-bit, AES-GCM Key Encryption Key (KEK) to encrypt keys.
 */
export class LocalKeyEncapsulationService implements KeyEncapsulationService {
  private readonly _kek: Uint8Array
  private readonly _cryptoProvider: CryptoProvider
  constructor (kek: Uint8Array) {
    if (kek.byteLength !== 32) {
      throw newError(`LocalKeyEncapsualationService master key must be of byteLength 32 (256 bits), got ${kek.byteLength} (${kek.byteLength * 8} bits)`)
    }
    this._kek = kek
    this._cryptoProvider = new CryptoProvider()
  }

  /**
   * Creates a new key, encapsulates it with the local KEK and returns the result.
   *
   * @param {KeyEncapsulationOptions} options the encapsulation options, depends on the implementation
   * @return {Promise<EncapsulationResult>} a promise that resolves to the encapsulation result
   */
  async encapsulate (options: Record<string, string>): Promise<EncapsulationResult> {
    const DEK = this._cryptoProvider.getRandomValues(32)
    const encapulatedDEK = await this._cryptoProvider.encrypt(this._kek, DEK.buffer as ArrayBuffer, undefined)
    return new LocalEncapsulationResult(DEK, new Int8Array(encapulatedDEK.cyphertext), { iv: u8ToB64(encapulatedDEK.iv) })
  }

  /**
   * Decapsulates encapsulated bytes with the local KEK.
   *
   * @param {Int8Array} encapsulation the encapsulated byte}
   * @param {KeyEncapsulationOptions} metadata the key metadata
   * @return {Promise<Uint8Array>} a promise that resolves to the decapsulated key
   */
  async decapsulate (encapsulation: Int8Array, metadata: Record<string, string>): Promise<Uint8Array> {
    return new Uint8Array(await this._cryptoProvider.decrypt(this._kek, b64Tou8(metadata.iv), encapsulation.buffer as ArrayBuffer, undefined))
  }
}

export class LocalEncapsulationResult implements EncapsulationResult {
  private readonly _dek: Uint8Array
  private readonly _encapsulation: Int8Array
  private readonly _options: Record<string, string>
  constructor (DEK: Uint8Array, encapsulation: Int8Array, options: Record<string, string>) {
    this._dek = DEK
    this._encapsulation = encapsulation
    this._options = options
  }

  encapsulation (): Int8Array {
    return this._encapsulation
  }

  options (): Record<string, string> {
    return this._options
  }

  key (): Uint8Array {
    return this._dek
  }
}

/**
 * Returns a new {@link KeyEncapsulationService} implementation that uses the provided AES-256
 * {@link SecretKey} as a master key for encapsulating and decapsulating data keys.
 *
 * @param {Uint8Array} masterKey the AES-256 master key
 * @return {KeyEncapsulationService} the new key encapsulation service
 */
export function localKeyEncapsulationService (masterKey: Uint8Array): LocalKeyEncapsulationService {
  return new LocalKeyEncapsulationService(masterKey)
}

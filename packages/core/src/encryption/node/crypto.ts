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

import * as crypto from 'node:crypto'
import { newError } from '../../error'

/**
 * @private
 */
export default class CryptoProvider {
  async encrypt (key: Uint8Array, message: ArrayBuffer, aad: ArrayBuffer | undefined): Promise<{ cyphertext: ArrayBuffer, iv: Uint8Array }> {
    if (crypto === undefined) {
      throw newError('Your node environment was build without the crypto module, and client side encrytion can therefore not be used')
    }
    const iv = this.getRandomValues(12)
    return {
      cyphertext: await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv,
          additionalData: aad
        },
        await crypto.subtle.importKey('raw', key, { name: 'AES-GCM', length: 256 }, false, ['encrypt']),
        message
      ),
      iv
    }
  }

  async decrypt (key: Uint8Array, iv: Uint8Array, message: ArrayBuffer, aad: ArrayBuffer | undefined): Promise<ArrayBuffer> {
    if (crypto === undefined) {
      throw newError('Your node environment was build without the crypto module, and client side encrytion can therefore not be used')
    }
    return await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: aad
      },
      await crypto.subtle.importKey('raw', key, { name: 'AES-GCM', length: 256 }, false, ['decrypt']),
      message
    )
  }

  getRandomValues (length: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(length))
  }
}

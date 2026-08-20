import * as crypto from 'node:crypto'
import { newError } from '../../error.ts'

const KEY_DERIVATION_INFO = new TextEncoder().encode('neo4j/property-encryption/v1')

export default class CryptoProvider {
  async encrypt (key: Uint8Array, message: ArrayBuffer, aad: ArrayBuffer | undefined): Promise<{ cyphertext: ArrayBuffer, iv: Uint8Array }> {
    if (crypto === undefined) {
      throw newError('Your node environment was build without the crypto module, and client side encrytion can therefore not be used')
    }
    const iv = this.getRandomValues(12)
    console.log(iv)
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
  
  async deriveKey (ikm: Uint8Array): Promise<Uint8Array> {
    const baseKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: KEY_DERIVATION_INFO },
      baseKey,
      256
    )
    return new Uint8Array(bits)
  }
}
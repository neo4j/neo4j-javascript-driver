import * as crypto from 'node:crypto'

export async function encrypt (key: Uint8Array, message: ArrayBuffer, aad: ArrayBuffer | undefined): Promise<{ cyphertext: ArrayBuffer, iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
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

export async function decrypt (key: Uint8Array, iv: Uint8Array, message: ArrayBuffer, aad: ArrayBuffer | undefined): Promise<ArrayBuffer> {
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
export function getRandomValues (length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

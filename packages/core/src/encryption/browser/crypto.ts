export async function encrypt (key: Uint8Array, message: ArrayBuffer, aad: ArrayBuffer | undefined): Promise<{ cyphertext: ArrayBuffer, iv: Uint8Array }> {
  // @ts-expect-error
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  return {
    // @ts-expect-error
    cyphertext: await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: aad
      },

      // @ts-expect-error
      // eslint-disable-next-line
      await window.crypto.subtle.importKey('raw', key, { name: 'AES-GCM', length: 256 }, false, ['encrypt']),
      message
    ),
    iv
  }
}

export async function decrypt (key: Uint8Array, iv: Uint8Array, message: ArrayBuffer, aad: ArrayBuffer | undefined): Promise<ArrayBuffer> {
  // @ts-expect-error
  // eslint-disable-next-line
  return await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: aad
    },
    // @ts-expect-error
    await window.crypto.subtle.importKey('raw', key, { name: 'AES-GCM', length: 256 }, false, ['decrypt']),
    message
  )
}
export function getRandomValues (length: number): Uint8Array {
  // @ts-expect-error
  return window.crypto.getRandomValues(new Uint8Array(length))
}

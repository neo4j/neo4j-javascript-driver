import { decrypt, encrypt, getRandomValues } from '../node/crypto'
import { EncapsulationResult, KeyEncapsulationService } from './key-encapsulation-service'

export class LocalKeyEncapsulationService implements KeyEncapsulationService {
  private readonly _kek: Uint8Array
  constructor (kek: Uint8Array) {
    this._kek = kek
  }

  async encapsulate (options: Record<string, string>): Promise<EncapsulationResult> {
    const DEK = getRandomValues(32)
    // this is not correct key derivation, but it works for now
    const encapulatedDEK = await encrypt(this._kek, DEK.buffer, undefined)
    return new LocalEncapsulationResult(DEK, new Uint8Array(encapulatedDEK.cyphertext), { iv: ivToString(encapulatedDEK.iv) })
  }

  async decapsulate (encapsulation: Uint8Array, options: Record<string, string>): Promise<Uint8Array> {
    return new Uint8Array(await decrypt(this._kek, parseIvString(options.iv), encapsulation.buffer as ArrayBuffer, undefined))
  }
}

function ivToString (iv: Uint8Array): string {
  let string = ''
  for (let i = 0; i < iv.length; i++) {
    string += (('0' + iv[i].toString(16)).slice(-2))
  }
  return string
}

function parseIvString (string: string): Uint8Array {
  const result = []
  for (let i = 0; i < string.length; i += 2) {
    result.push(parseInt(string.substring(i, i + 2), 16))
  }
  return Uint8Array.from(result)
}

export class LocalEncapsulationResult implements EncapsulationResult {
  private readonly _dek: Uint8Array
  private readonly _encapsulation: Uint8Array
  private readonly _options: Record<string, string>
  constructor (DEK: Uint8Array, encapsulation: Uint8Array, options: Record<string, string>) {
    this._dek = DEK
    this._encapsulation = encapsulation
    this._options = options
  }

  encapsulation (): Uint8Array {
    return this._encapsulation
  }

  options (): Record<string, string> {
    return this._options
  }

  key (): Uint8Array {
    return this._dek
  }
}

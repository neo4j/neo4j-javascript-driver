import CryptoProvider from '../node/crypto.ts'
import { EncapsulationResult, KeyEncapsulationService } from './key-encapsulation-service.ts'

function u8ToB64 (u: Uint8Array): string {
  return btoa(String.fromCharCode(...u))
}

function b64Tou8 (b: string): Uint8Array {
  return Uint8Array.from(atob(b), (c: string) => c.charCodeAt(0))
}

export class LocalKeyEncapsulationService implements KeyEncapsulationService {
  private readonly _kek: Uint8Array
  private readonly _cryptoProvider: CryptoProvider
  constructor (kek: Uint8Array) {
    this._kek = kek
    this._cryptoProvider = new CryptoProvider()
  }

  async encapsulate (options: Record<string, string>): Promise<EncapsulationResult> {
    const DEK = this._cryptoProvider.getRandomValues(32)
    // this is not correct key derivation, but it works for now
    const encapulatedDEK = await this._cryptoProvider.encrypt(this._kek, DEK.buffer as ArrayBuffer, undefined)
    return new LocalEncapsulationResult(DEK, new Int8Array(encapulatedDEK.cyphertext), { iv: u8ToB64(encapulatedDEK.iv) })
  }

  async decapsulate (encapsulation: Int8Array, options: Record<string, string>): Promise<Uint8Array> {
    return new Uint8Array(await this._cryptoProvider.decrypt(this._kek, b64Tou8(options.iv), encapsulation.buffer as ArrayBuffer, undefined))
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

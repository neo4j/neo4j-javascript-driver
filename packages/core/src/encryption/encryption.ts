import Integer, { int, isInt } from '../integer'
import { BoltProvider } from '../internal/bolt-provider'
import { EncryptedValue } from './encrypted-value'
import { EncapsulatedKeyManager } from './key-encapsulation/encapsulated-key-manager'
import { encrypt, decrypt, deriveKey } from './node/crypto'
import { isDate, isDateTime, isDuration, isLocalDateTime, isLocalTime, isTime } from '../temporal-types'
import { isVector } from '../vector'
import { isPoint } from '../spatial-types'
import { isUUID } from '../uuid'
import { EncryptionProfile } from './encyption-profile'
import { newError } from '../error'
import { EncapsulatedKey } from './key-encapsulation/encapsulated-key'
import { json } from '..'

export default class EncryptionService {
  private readonly _boltProvider: BoltProvider
  private readonly _profiles: Map<string, { profile: EncryptionProfile, keyManager: EncapsulatedKeyManager }>
  constructor (boltProvider: BoltProvider, profiles: EncryptionProfile[]) {
    this._boltProvider = boltProvider
    this._profiles = new Map<string, { profile: EncryptionProfile, keyManager: EncapsulatedKeyManager }>()
    profiles.forEach((profile) => {
      this._profiles.set(profile.name, { profile, keyManager: new EncapsulatedKeyManager(profile, profile.encapsulationService) })
    })
  }

  async encrypt (value: any, keyOptions: string | { alias?: string, id?: string }, profileName?: string, aad?: Record<string, any>): Promise<Int8Array> {
    const profile = this._getProfile(profileName)
    const { typeName, typeProtocolMajor, typeProtocolMinor } = this._identifyType(value)
    const encodedValue = this._boltProvider.encodeValue(value)
    let encodedAAD
    if (aad != null && !this.isEmpty(aad)) {
      encodedAAD = this._boltProvider.encodeValue(aad)
    }
    const key = await this._getKey(profile.profile, keyOptions)
    const decapsulatedKey = await this.decapsulateKey(profile.profile, key)
    const derivedKey = await deriveKey(decapsulatedKey)
    const { cyphertext, iv } = await encrypt(derivedKey, encodedValue, encodedAAD)
    const metadata = {
      iv: new Int8Array(iv.buffer),
      aad: encodedAAD,
      key_id: key.id()
    }
    return this._boltProvider.encodeObject(new EncryptedValue(new Int8Array(cyphertext), profile.profile.name, typeName, typeProtocolMajor, typeProtocolMinor, metadata))
  }

  async decrypt<T>(value: Int8Array, usePersistedAad?: boolean, aad?: Record<string, any>): Promise<T> {
    let encodedAAD
    const struct = this._boltProvider.decodeObject(value)
    if (aad != null && !this.isEmpty(aad)) {
      encodedAAD = this._boltProvider.encodeValue(usePersistedAad === true ? struct.metadata.aad : aad)
    }
    const profile = this._getProfile(struct.profileName)
    const decapsulatedKey = await this.decapsulateKey(profile.profile, await this._getKey(profile.profile, struct.metadata.key_id))
    const derivedKey = await deriveKey(decapsulatedKey)
    return this._boltProvider.decodeValue(await decrypt(derivedKey, struct.metadata.iv, struct.cipherOutput.buffer as ArrayBuffer, encodedAAD), struct.typeProtocolMajor.toString() + '.' + struct.typeProtocolMinor.toString())
  }

  keyManager (name: string | undefined): EncapsulatedKeyManager {
    const profile = this._getProfile(name)
    return profile.keyManager
  }

  private _identifyType (value: any): { typeName: string, typeProtocolMajor: Integer, typeProtocolMinor: Integer } {
    if (typeof value === 'string') {
      return { typeName: 'STRING', typeProtocolMajor: int(1), typeProtocolMinor: int(0) }
    }
    if (typeof value === 'boolean') {
      return { typeName: 'BOOLEAN', typeProtocolMajor: int(1), typeProtocolMinor: int(0) }
    }
    if (typeof value === 'number') {
      return { typeName: 'FLOAT', typeProtocolMajor: int(1), typeProtocolMinor: int(0) }
    }
    if (typeof value === 'bigint' || isInt(value)) {
      return { typeName: 'INTEGER', typeProtocolMajor: int(1), typeProtocolMinor: int(0) }
    }
    if (isDate(value)) {
      return { typeName: 'DATE', typeProtocolMajor: int(1), typeProtocolMinor: int(0) }
    }
    if (isDuration(value)) {
      return { typeName: 'DURATION', typeProtocolMajor: int(1), typeProtocolMinor: int(0) }
    }
    if (isVector(value)) {
      return { typeName: 'VECTOR', typeProtocolMajor: int(6), typeProtocolMinor: int(0) }
    }
    if (value instanceof Int8Array) {
      return { typeName: 'BYTES', typeProtocolMajor: int(1), typeProtocolMinor: int(0) }
    }
    if (isLocalDateTime(value)) {
      return { typeName: 'LOCAL DATETIME', typeProtocolMajor: int(1), typeProtocolMinor: int(0) }
    }
    if (isLocalTime(value)) {
      return { typeName: 'LOCAL TIME', typeProtocolMajor: int(1), typeProtocolMinor: int(0) }
    }
    if (isDateTime(value)) {
      return { typeName: 'ZONED DATETIME', typeProtocolMajor: int(5), typeProtocolMinor: int(0) }
    }
    if (isTime(value)) {
      return { typeName: 'ZONED TIME', typeProtocolMajor: int(1), typeProtocolMinor: int(0) }
    }
    if (isPoint(value)) {
      return { typeName: 'POINT', typeProtocolMajor: int(1), typeProtocolMinor: int(0) }
    }
    if (isUUID(value)) {
      return { typeName: 'UUID', typeProtocolMajor: int(6), typeProtocolMinor: int(1) }
    }
    if (Array.isArray(value)) {
      const type = this._identifyType(value[0])
      let major = int(1)
      let minor = int(0)
      if (type.typeProtocolMajor.low > 1 || (type.typeProtocolMajor.low === 1 && type.typeProtocolMinor.low > 0)) {
        major = type.typeProtocolMajor
        minor = type.typeProtocolMinor
      }
      return { typeName: `LIST<${type.typeName}>`, typeProtocolMajor: major, typeProtocolMinor: minor }
    }
    throw newError(`could not identify type of: ${json.stringify(value)}`)
  }

  private _getProfile (name?: string): { profile: EncryptionProfile, keyManager: EncapsulatedKeyManager } {
    if (name == null) {
      if (this._profiles.size === 1) {
        // @ts-expect-error
        return this._profiles.get(this._profiles.keys().next().value)
      } else {
        throw newError('When using a driver with multiple encryption profiles configured, which encryption profile to use must be explicitly provided')
      }
    } else {
      const profile = this._profiles.get(name)
      if (profile === undefined) {
        throw newError(`Could not find encryption profile with name ${name}`)
      }
      return profile
    }
  }

  private async _getKey (profile: EncryptionProfile, options: string | { alias?: string, id?: string }): Promise<EncapsulatedKey> {
    const key = await profile.findKey(options)
    if (key == null) {
      throw newError(`Could not find key with key options: ${json.stringify(options)}`)
    }
    return key
  }

  private async decapsulateKey (profile: EncryptionProfile, key: EncapsulatedKey): Promise<Uint8Array> {
    return await profile.encapsulationService.decapsulate(key.encapsulation(), key.metadata())
  }

  private isEmpty (obj: Record<string, any>): boolean {
    for (const prop in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, prop) != null) {
        return false
      }
    }
    return true
  }
}

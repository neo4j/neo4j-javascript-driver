import Integer, { int, isInt } from '../integer.ts'
import { BoltProvider } from '../internal/bolt-provider.ts'
import { EncryptedValue } from './encrypted-value.ts'
import { EncapsulatedKeyManager } from './key-encapsulation/encapsulated-key-manager.ts'
import CryptoProvider from './node/crypto.ts'
import { isDate, isDateTime, isDuration, isLocalDateTime, isLocalTime, isTime } from '../temporal-types.ts'
import type { Duration, Date, Time, LocalDateTime, LocalTime, DateTime } from '../temporal-types.ts'
import { isVector } from '../vector.ts'
import { isPoint } from '../spatial-types.ts'
import type { Point } from '../spatial-types.ts'
import { isUUID } from '../uuid.ts'
import type UUID from '../uuid.ts'
import { EncryptionProfile } from './encyption-profile.ts'
import { newError } from '../error.ts'
import { EncapsulatedKey } from './key-encapsulation/encapsulated-key.ts'
import { json } from '../index.ts'
import type Vector from '../vector.ts'

const supportedAADTypes: string[] = ['BOOLEAN', 'DATE', 'INTEGER', 'LOCAL TIME', 'POINT', 'STRING', 'ZONED TIME', 'UUID', 'BYTES']

export default class EncryptionService {
  private readonly _boltProvider: BoltProvider
  private readonly _profiles: Map<string, { profile: EncryptionProfile, keyManager: EncapsulatedKeyManager }>
  private readonly _cryptoProvider: CryptoProvider
  constructor (boltProvider: BoltProvider, profiles: EncryptionProfile[]) {
    this._boltProvider = boltProvider
    this._profiles = new Map<string, { profile: EncryptionProfile, keyManager: EncapsulatedKeyManager }>()
    profiles.forEach((profile) => {
      this._profiles.set(profile.name, { profile, keyManager: new EncapsulatedKeyManager(profile, profile.encapsulationService) })
    })
    this._cryptoProvider = new CryptoProvider()
  }

  async encrypt (value: any, keyOptions: string | { alias?: string, id?: string }, profileName?: string, aad?: Record<string, any>): Promise<Int8Array> {
    const profile = this._getProfile(profileName)
    const { typeName, typeProtocolMajor, typeProtocolMinor } = this._identifyType(value)
    const encodedValue = this._boltProvider.encodeValue(value)
    let encodedAAD
    let aadType
    if (aad != null && !this.isEmpty(aad)) {
      aadType = this._identifyType(aad)
      if(!supportedAADTypes.includes(aadType.typeName)) {
        throw newError(`Unsupported AAD propety type ${aadType.typeName}, supported values are ${supportedAADTypes.toString()}`)
      }
      encodedAAD = this._boltProvider.encodeValue(aad)
    }
    const key = await this._getKey(profile.profile, keyOptions)
    const decapsulatedKey = await this.decapsulateKey(profile.profile, key)
    const derivedKey = await this._cryptoProvider.deriveKey(decapsulatedKey)
    const { cyphertext, iv } = await this._cryptoProvider.encrypt(derivedKey, encodedValue, encodedAAD)
    const metadata = {
      key_id: key.id(),
      iv: new Int8Array(iv.buffer),
      aad: encodedAAD !== undefined ? new Int8Array(encodedAAD) : undefined,
      aad_encoding_scheme_major: aadType?.typeProtocolMajor,
      aad_encoding_scheme_minor: aadType?.typeProtocolMinor
    }
    return this._boltProvider.encodeObject(new EncryptedValue(new Int8Array(cyphertext), profile.profile.name, typeName, typeProtocolMajor, typeProtocolMinor, metadata))
  }

  async decrypt<T>(value: Int8Array, usePersistedAad?: boolean, aad?: Record<string, any>): Promise<T> {
    let encodedAAD
    const struct = this._boltProvider.decodeObject(value)
    if (usePersistedAad === true) {
      encodedAAD = struct.metadata.aad !== undefined ? struct.metadata.aad.buffer : undefined
    } else if (aad != null && !this.isEmpty(aad)) {
      encodedAAD = this._boltProvider.encodeValue(aad)
    }
    const profile = this._getProfile(struct.profileName)
    const decapsulatedKey = await this.decapsulateKey(profile.profile, await this._getKey(profile.profile, struct.metadata.key_id))
    const derivedKey = await this._cryptoProvider.deriveKey(decapsulatedKey)
    return this._boltProvider.decodeValue(await this._cryptoProvider.decrypt(derivedKey, struct.metadata.iv, struct.cipherOutput.buffer as ArrayBuffer, encodedAAD), struct.typeProtocolMajor.toString() + '.' + struct.typeProtocolMinor.toString())
  }

  keyManager (name: string | undefined): EncapsulatedKeyManager {
    const profile = this._getProfile(name)
    return profile.keyManager
  }

  private _identifyType (value: any): { typeName: string, typeProtocolMajor: Integer, typeProtocolMinor: Integer, verification: (_: any) => boolean  } {
    if (typeof value === 'string') {
      const verification: (value: any) => value is string = (value:any ) => typeof value === 'string'
      return { typeName: 'STRING', typeProtocolMajor: int(1), typeProtocolMinor: int(0), verification }
    }
    if (typeof value === 'boolean') {
      const verification: (value: any) => value is boolean = (value:any ) => typeof value === 'boolean'
      return { typeName: 'BOOLEAN', typeProtocolMajor: int(1), typeProtocolMinor: int(0), verification }
    }
    if (typeof value === 'number') {
      const verification: (value: any) => value is number = (value:any ) => typeof value === 'number'
      return { typeName: 'FLOAT', typeProtocolMajor: int(1), typeProtocolMinor: int(0), verification }
    }
    if (typeof value === 'bigint' || isInt(value)) {
      const verification: (value: any) => value is BigInt = (value:any ) => typeof value === 'bigint'
      return { typeName: 'INTEGER', typeProtocolMajor: int(1), typeProtocolMinor: int(0), verification }
    }
    if (isDate(value)) {
      const verification: (value: any) => value is Date = (value:any ) => isDate(value)
      return { typeName: 'DATE', typeProtocolMajor: int(1), typeProtocolMinor: int(0), verification }
    }
    if (isDuration(value)) {
      const verification: (value: any) => value is Duration = (value:any ) => isDuration(value)
      return { typeName: 'DURATION', typeProtocolMajor: int(1), typeProtocolMinor: int(0), verification }
    }
    if (isVector(value)) {
      const verification: (value: any) => value is Vector<any> = (value:any ) => isVector(value)
      return { typeName: 'VECTOR', typeProtocolMajor: int(6), typeProtocolMinor: int(0), verification }
    }
    if (value instanceof Int8Array) {
      const verification: (value: any) => value is Int8Array = (value:any ) => value instanceof Int8Array
      return { typeName: 'BYTES', typeProtocolMajor: int(1), typeProtocolMinor: int(0), verification }
    }
    if (isLocalDateTime(value)) {
      const verification: (value: any) => value is LocalDateTime = (value:any ) => isLocalDateTime(value)
      return { typeName: 'LOCAL DATETIME', typeProtocolMajor: int(1), typeProtocolMinor: int(0), verification }
    }
    if (isLocalTime(value)) {
      const verification: (value: any) => value is LocalTime = (value:any ) => isLocalTime(value)
      return { typeName: 'LOCAL TIME', typeProtocolMajor: int(1), typeProtocolMinor: int(0), verification }
    }
    if (isDateTime(value)) {
      const verification: (value: any) => value is DateTime = (value:any ) => isDateTime(value)
      return { typeName: 'ZONED DATETIME', typeProtocolMajor: int(5), typeProtocolMinor: int(0), verification }
    }
    if (isTime(value)) {
      const verification: (value: any) => value is Time = (value:any ) => isTime(value)
      return { typeName: 'ZONED TIME', typeProtocolMajor: int(1), typeProtocolMinor: int(0), verification }
    }
    if (isPoint(value)) {
      const verification: (value: any) => value is Point = (value:any ) => isPoint(value)
      return { typeName: 'POINT', typeProtocolMajor: int(1), typeProtocolMinor: int(0), verification }
    }
    if (isUUID(value)) {
      const verification: (value: any) => value is UUID = (value:any ) => isUUID(value)
      return { typeName: 'UUID', typeProtocolMajor: int(6), typeProtocolMinor: int(1), verification }
    }
    if (Array.isArray(value)) {
      const type = this._identifyType(value[0])
      if(!value.map(element => type.verification(element)).every(element => element === true)) {
        throw newError(`Every element of an encrypted array must be of the same property type`)
      }
      let major = int(1)
      let minor = int(0)
      if (type.typeProtocolMajor.low > 1 || (type.typeProtocolMajor.low === 1 && type.typeProtocolMinor.low > 0)) {
        major = type.typeProtocolMajor
        minor = type.typeProtocolMinor
      }
      const verification: (value: any) => boolean = (_: any) => false
      return { typeName: 'LIST', typeProtocolMajor: major, typeProtocolMinor: minor, verification}
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

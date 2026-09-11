import Integer, { int, isInt } from '../integer'
import { BoltProvider } from '../internal/bolt-provider'
import { EncryptedValue } from './encrypted-value'
import { EncapsulatedKeyManager } from './key-encapsulation/encapsulated-key-manager'
import CryptoProvider from './node/crypto'
import { isDate, isDateTime, isDuration, isLocalDateTime, isLocalTime, isTime } from '../temporal-types'
import type { Duration, Date, Time, LocalDateTime, LocalTime, DateTime } from '../temporal-types'
import { isVector } from '../vector'
import { isPoint } from '../spatial-types'
import type { Point } from '../spatial-types'
import { isUUID } from '../uuid'
import type UUID from '../uuid'
import { EncryptionProfile } from './encyption-profile'
import { newError } from '../error'
import { EncapsulatedKey } from './key-encapsulation/encapsulated-key'
import { json } from '..'
import type Vector from '../vector'

const supportedAADTypes: string[] = ['BOOLEAN', 'DATE', 'INTEGER', 'LOCAL TIME', 'POINT', 'STRING', 'ZONED TIME', 'UUID', 'BYTES']

export default class EncryptionService {
  private readonly _boltProvider: BoltProvider
  private readonly _profiles: Map<string, { profile: EncryptionProfile, keyManager: EncapsulatedKeyManager }>
  private readonly _cryptoProvider: CryptoProvider
  constructor (boltProvider: BoltProvider, profiles: EncryptionProfile[]) {
    this._boltProvider = boltProvider
    this._profiles = new Map<string, { profile: EncryptionProfile, keyManager: EncapsulatedKeyManager }>()
    profiles.forEach((profile) => {
      if (this._profiles.has(profile.name)) {
        throw newError(`Multiple profiles with name ${profile.name} configured, each profile must have a unique name.`)
      }
      this._profiles.set(profile.name, { profile, keyManager: new EncapsulatedKeyManager(profile, profile.encapsulationService) })
    })
    this._cryptoProvider = new CryptoProvider()
  }

  /**
   * Encrypts data with AES-GCM 256 into a byte array ready to be saved an a property in a Neo4j database.
   * The byte array includes metadata required to allow another Neo4j Driver configured with the same {@link EncapsulatedKeyRepository} to decrypt the data.
   *
   * @param {Object} encryptRequest - The value to encrypt and associated metadata for the encryption
   * @param {any} encryptRequest.value - The value to encrypt, must be a value able to be saved as a Neo4j Property.
   * @param {string | {alias?: string, id?: string} | undefined} encryptRequest.keyOptions - Used to determine the key to be used, a plain string is assumed to be the id, if omitted the encryption profile's default key reference will be used
   * @param {string} encryptRequest.encryptionProfile - Name of the {@link EncryptionProfile} to use, must be provided unless the driver is configured with only 1 profile.
   * @param {any | undefined} encryptRequest.aad - Additional Authenticated Data for the encryption.
   * @returns
   */
  async encrypt (encryptRequest: { value: any, keyOptions: string | { alias?: string, id?: string }, encryptionProfile?: string, aad?: any }): Promise<Int8Array> {
    const profile = this._getProfile(encryptRequest.encryptionProfile)
    const { typeName, typeProtocolMajor, typeProtocolMinor } = this._identifyType(encryptRequest.value)
    const encodedValue = this._boltProvider.encodeValue(encryptRequest.value)
    let encodedAAD
    let aadType
    if (encryptRequest.aad != null) {
      aadType = this._identifyType(encryptRequest.aad)
      if (!supportedAADTypes.includes(aadType.typeName)) {
        throw newError(`Unsupported AAD propety type ${aadType.typeName}, supported values are ${supportedAADTypes.toString()}`)
      }
      encodedAAD = this._boltProvider.encodeValue(encryptRequest.aad)
    }
    const key = await this._getKey(profile.profile, encryptRequest.keyOptions)
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

  /**
   * Decrypts data encrypted with this or another Neo4j Driver's {@link EncryptionService#encrypt} function.
   *
   * @param {Object} decryptRequest - Object containing encrypted ciphertext and required metadata.
   * @param {Int8Array} decryptRequest.ciphertext - The encrypted ciphertext
   * @param {any | undefined} decryptRequest.aad - The Additional Authenticated Data to verify when decrypting
   * @param {boolean | undefined} decryptRequest.usePersistedAad - Wether to use the persisted aad data stored with the ciphertext, mutually exclusive with decryptRequest.aad
   *
   * @returns
   */
  async decrypt<T>(decryptRequest: { ciphertext: Int8Array, usePersistedAad?: boolean, aad?: any }): Promise<T> {
    let encodedAAD
    const struct = this._boltProvider.decodeObject(decryptRequest.ciphertext)
    if (decryptRequest.usePersistedAad === true) {
      encodedAAD = struct.metadata.aad !== undefined ? struct.metadata.aad.buffer : undefined
    } else if (decryptRequest.aad != null && !this.isEmpty(decryptRequest.aad)) {
      encodedAAD = this._boltProvider.encodeValue(decryptRequest.aad)
    }
    const profile = this._getProfile(struct.profileName)
    const decapsulatedKey = await this.decapsulateKey(profile.profile, await this._getKey(profile.profile, struct.metadata.key_id))
    const derivedKey = await this._cryptoProvider.deriveKey(decapsulatedKey)
    return this._boltProvider.decodeValue(await this._cryptoProvider.decrypt(derivedKey, struct.metadata.iv, struct.cipherOutput.buffer as ArrayBuffer, encodedAAD), struct.typeProtocolMajor.toString() + '.' + struct.typeProtocolMinor.toString())
  }

  /**
   * Returns the key manager for the specified profile
   *
   * @param {string | undefined} profileName name of the profile to get the key manager of, can be omitted if driver is configured with only one encryption profile
   * @returns {EncapsulatedKeyManager} The key manager of the specified profile.
   */
  keyManager (profileName: string | undefined): EncapsulatedKeyManager {
    const profile = this._getProfile(profileName)
    return profile.keyManager
  }

  private _identifyType (value: any): { typeName: string, typeProtocolMajor: Integer, typeProtocolMinor: Integer, verification: (_: any) => boolean } {
    if (typeof value === 'string') {
      const verification: (value: any) => value is string = (value: any) => typeof value === 'string'
      return { typeName: 'STRING', typeProtocolMajor: int(1), typeProtocolMinor: int(0), verification }
    }
    if (typeof value === 'boolean') {
      const verification: (value: any) => value is boolean = (value: any) => typeof value === 'boolean'
      return { typeName: 'BOOLEAN', typeProtocolMajor: int(1), typeProtocolMinor: int(0), verification }
    }
    if (typeof value === 'number') {
      const verification: (value: any) => value is number = (value: any) => typeof value === 'number'
      return { typeName: 'FLOAT', typeProtocolMajor: int(1), typeProtocolMinor: int(0), verification }
    }
    if (typeof value === 'bigint' || isInt(value)) {
      const verification: (value: any) => value is BigInt = (value: any) => typeof value === 'bigint'
      return { typeName: 'INTEGER', typeProtocolMajor: int(1), typeProtocolMinor: int(0), verification }
    }
    if (isDate(value)) {
      const verification: (value: any) => value is Date = (value: any) => isDate(value)
      return { typeName: 'DATE', typeProtocolMajor: int(1), typeProtocolMinor: int(0), verification }
    }
    if (isDuration(value)) {
      const verification: (value: any) => value is Duration = (value: any) => isDuration(value)
      return { typeName: 'DURATION', typeProtocolMajor: int(1), typeProtocolMinor: int(0), verification }
    }
    if (isVector(value)) {
      const verification: (value: any) => value is Vector<any> = (value: any) => isVector(value)
      return { typeName: 'VECTOR', typeProtocolMajor: int(6), typeProtocolMinor: int(0), verification }
    }
    if (value instanceof Int8Array) {
      const verification: (value: any) => value is Int8Array = (value: any) => value instanceof Int8Array
      return { typeName: 'BYTES', typeProtocolMajor: int(1), typeProtocolMinor: int(0), verification }
    }
    if (isLocalDateTime(value)) {
      const verification: (value: any) => value is LocalDateTime = (value: any) => isLocalDateTime(value)
      return { typeName: 'LOCAL DATETIME', typeProtocolMajor: int(1), typeProtocolMinor: int(0), verification }
    }
    if (isLocalTime(value)) {
      const verification: (value: any) => value is LocalTime = (value: any) => isLocalTime(value)
      return { typeName: 'LOCAL TIME', typeProtocolMajor: int(1), typeProtocolMinor: int(0), verification }
    }
    if (isDateTime(value)) {
      const verification: (value: any) => value is DateTime = (value: any) => isDateTime(value)
      return { typeName: 'ZONED DATETIME', typeProtocolMajor: int(5), typeProtocolMinor: int(0), verification }
    }
    if (isTime(value)) {
      const verification: (value: any) => value is Time = (value: any) => isTime(value)
      return { typeName: 'ZONED TIME', typeProtocolMajor: int(1), typeProtocolMinor: int(0), verification }
    }
    if (isPoint(value)) {
      const verification: (value: any) => value is Point = (value: any) => isPoint(value)
      return { typeName: 'POINT', typeProtocolMajor: int(1), typeProtocolMinor: int(0), verification }
    }
    if (isUUID(value)) {
      const verification: (value: any) => value is UUID = (value: any) => isUUID(value)
      return { typeName: 'UUID', typeProtocolMajor: int(6), typeProtocolMinor: int(1), verification }
    }
    if (Array.isArray(value)) {
      const type = this._identifyType(value[0])
      if (!value.map(element => type.verification(element)).every(element => element)) {
        throw newError('Every element of an encrypted array must be of the same property type')
      }
      let major = int(1)
      let minor = int(0)
      if (type.typeProtocolMajor.low > 1 || (type.typeProtocolMajor.low === 1 && type.typeProtocolMinor.low > 0)) {
        major = type.typeProtocolMajor
        minor = type.typeProtocolMinor
      }
      const verification: (value: any) => boolean = (_: any) => false
      return { typeName: 'LIST', typeProtocolMajor: major, typeProtocolMinor: minor, verification }
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

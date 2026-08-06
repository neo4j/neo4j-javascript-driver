import Integer, { int, isInt } from '../integer'
import { BoltProvider } from '../internal/bolt-provider'
import { EncryptedValue } from './encrypted-value'
import { EncapsulatedKeyManager } from './key-encapsulation/encapsulated-key-manager'
import { encrypt, decrypt } from './node/crypto'
import { isDate, isDateTime, isDuration, isLocalDateTime, isLocalTime, isTime } from '../temporal-types'
import { isVector } from '../vector'
import { isPoint } from '../spatial-types'
import { isUUID } from '../uuid'
import { EncryptionProfile } from './encyption-profile'
import { newError } from '../error'

export default class EncryptionService {
  private readonly _boltProvider: BoltProvider
  private readonly _profiles: Map<string, { profile: EncryptionProfile, keyManager: EncapsulatedKeyManager }>
  constructor (boltProvider: BoltProvider, profiles: EncryptionProfile[]) {
    this._boltProvider = boltProvider
    this._profiles = new Map<string, { profile: EncryptionProfile, keyManager: EncapsulatedKeyManager }>()
    profiles.forEach((profile) => {
      this._profiles.set(profile.name, { profile, keyManager: new EncapsulatedKeyManager(profile.keyRepository, profile.encapsulationService) })
    })
  }

  async encrypt (value: any, keyOptions: string | Record<string, any>, profileName?: string, aad?: Record<string, any>): Promise<Int8Array> {
    const profile = this._getProfile(profileName)
    const { typeName, typeProtocolMajor, typeProtocolMinor } = this._identifyType(value)
    const encodedValue = this._boltProvider.encodeValue(value)
    const encodedAAD = aad !== undefined ? this._boltProvider.encodeValue(aad) : undefined
    const key = await this._getKey(profile.profile, keyOptions)
    const { cyphertext, iv } = await encrypt(key, encodedValue, encodedAAD)
    const metadata = {
      iv: new Int8Array(iv.buffer),
      aad: encodedAAD
    }
    return this._boltProvider.encodeObject(new EncryptedValue(int(1), new Int8Array(cyphertext), profileName ?? '', typeName, typeProtocolMajor, typeProtocolMinor, metadata))
  }

  async decrypt<T>(value: Int8Array, keyOptions: string | Record<string, any>, profileName?: string, aad?: Record<string, any>): Promise<T> {
    const profile = this._getProfile(profileName)
    let encodedAAD
    if (aad != null) {
      encodedAAD = this._boltProvider.encodeValue(aad)
    }
    const struct = this._boltProvider.decodeObject(value)
    const key = await this._getKey(profile.profile, keyOptions)
    // @ts-expect-error
    return this._boltProvider.decodeValue(await decrypt(key, struct.metadata.iv, struct.cipherOutput, encodedAAD ?? struct.metadata.aad), struct.typeProtocolMajor.toString() + '.' + struct.typeProtocolMinor.toString())
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
    if (value instanceof Uint8Array) {
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
    // TODO: Implement list
    throw new Error()
  }

  private _getProfile (name?: string): { profile: EncryptionProfile, keyManager: EncapsulatedKeyManager } {
    if (name === undefined) {
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

  private async _getKey (profile: EncryptionProfile, options: string | Record<string, any>): Promise<Uint8Array> {
    if (typeof options === 'string') {
      const input = await profile.keyRepository.findByAlias(options)
      return await profile.encapsulationService.decapsulate(input.encapsulation(), input.metadata())
    } else if (options.alias != null) {
      const input = await profile.keyRepository.findByAlias(options.alias)
      return await profile.encapsulationService.decapsulate(input.encapsulation(), input.metadata())
    } else if (options.name != null) {
      const input = await profile.keyRepository.findById(options.name)
      return await profile.encapsulationService.decapsulate(input.encapsulation(), input.metadata())
    }
    throw newError('PLACEHOLDER MESSAGE')
  }
}

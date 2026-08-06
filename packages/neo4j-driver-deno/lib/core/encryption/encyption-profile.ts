import { EncapsulatedKeyRepository } from './key-encapsulation/encapsulated-key.ts'
import { KeyEncapsulationService } from './key-encapsulation/key-encapsulation-service.ts'

export type EncryptionProfile = EnvelopeEncryptionProfile

export class EnvelopeEncryptionProfile {
  public name: string
  public defaultKeyReference: string
  public encapsulationService: KeyEncapsulationService
  public keyRepository: EncapsulatedKeyRepository
  private readonly _keyCacheTTL?: number
  private readonly _keyCacheMaxSize?: number
  private readonly _keyAliasCacheTTL?: number
  private readonly _keyAliasCacheMaxSize?: number
  constructor (config: {
    name: string
    defaultKeyReference: string
    encapsulationService: KeyEncapsulationService
    keyRepository: EncapsulatedKeyRepository
    keyCacheTTL?: number
    keyCacheMaxSize?: number
    keyAliasCacheTTL?: number
    keyAliasCacheMaxSize?: number
  }) {
    this.name = config.name
    this.defaultKeyReference = config.defaultKeyReference
    this.encapsulationService = config.encapsulationService
    this.keyRepository = config.keyRepository
    this._keyCacheTTL = config.keyCacheTTL
    this._keyCacheMaxSize = config.keyCacheMaxSize
    this._keyAliasCacheTTL = config.keyAliasCacheTTL
    this._keyAliasCacheMaxSize = config.keyAliasCacheMaxSize
  }
}

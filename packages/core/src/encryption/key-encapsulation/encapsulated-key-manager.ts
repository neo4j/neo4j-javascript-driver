import { EncryptionProfile } from '../encyption-profile'
import { EncapsulatedKey } from './encapsulated-key'
import { KeyEncapsulationService } from './key-encapsulation-service'

export class EncapsulatedKeyManager {
  private readonly _profile: EncryptionProfile
  private readonly _keyEncapsulationService: KeyEncapsulationService
  constructor (profile: EncryptionProfile, keyEncapsulationService: KeyEncapsulationService) {
    this._profile = profile
    this._keyEncapsulationService = keyEncapsulationService
  }

  async create (name: string): Promise<EncapsulatedKey> {
    const encapulated = await this._keyEncapsulationService.encapsulate({})
    const result = await this._profile.saveKey(name, encapulated.encapsulation(), encapulated.options())
    return result
  }
}

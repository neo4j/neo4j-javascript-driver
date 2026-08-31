import { EncryptionProfile } from '../encyption-profile'
import { KeyEncapsulationService } from './key-encapsulation-service'

export class EncapsulatedKeyManager {
  private readonly _profile: EncryptionProfile
  private readonly _keyEncapsulationService: KeyEncapsulationService
  constructor (profile: EncryptionProfile, keyEncapsulationService: KeyEncapsulationService) {
    this._profile = profile
    this._keyEncapsulationService = keyEncapsulationService
  }

  /**
   * Creates a new key via the {@link KeyEncapsulationService} and saves it in the profile's configured {@link EncapsulatedKeyRepository}
   *
   * @param {string} name - The alias the new key should be saved under in the {@link EncapsulatedKeyRepository}
   * @returns {Promise<void>} Promise that resolves when the key is created, saved and ready to use.
   */
  async create (name: string): Promise<void> {
    const encapulated = await this._keyEncapsulationService.encapsulate({})
    await this._profile.saveKey(name, encapulated.encapsulation(), encapulated.options())
  }
}

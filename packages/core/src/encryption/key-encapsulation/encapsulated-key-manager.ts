import { EncapsulatedKey, EncapsulatedKeyRepository } from './encapsulated-key'
import { KeyEncapsulationService } from './key-encapsulation-service'

export class EncapsulatedKeyManager {
  private readonly _keyRepository: EncapsulatedKeyRepository
  private readonly _keyEncapsulationService: KeyEncapsulationService
  constructor (keyRepository: EncapsulatedKeyRepository, keyEncapsulationService: KeyEncapsulationService) {
    this._keyRepository = keyRepository
    this._keyEncapsulationService = keyEncapsulationService
  }

  async create (name: string): Promise<EncapsulatedKey> {
    const encapulated = await this._keyEncapsulationService.encapsulate({})
    const result = await this._keyRepository.save([name], encapulated.encapsulation(), encapulated.options())
    return result
  }
}

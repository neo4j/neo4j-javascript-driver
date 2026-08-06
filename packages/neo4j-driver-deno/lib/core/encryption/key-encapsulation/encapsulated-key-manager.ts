import { EncapsulatedKeyRepository } from './encapsulated-key.ts'
import { KeyEncapsulationService } from './key-encapsulation-service.ts'

export class EncapsulatedKeyManager {
    private _keyRepository: EncapsulatedKeyRepository
    private _keyEncapsulationService: KeyEncapsulationService
    constructor(keyRepository: EncapsulatedKeyRepository, keyEncapsulationService: KeyEncapsulationService) {
        this._keyRepository = keyRepository
        this._keyEncapsulationService = keyEncapsulationService
    }

    async create(name: string): Promise<Uint8Array> {
        const result = await this._keyEncapsulationService.encapsulate({})
        await this._keyRepository.save([name], result.encapsulation(), result.options())
        return result.encapsulation()
    }
}
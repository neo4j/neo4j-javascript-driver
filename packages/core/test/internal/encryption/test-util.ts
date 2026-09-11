import { EncapsulatedKeyRepository } from '../../../src'

export class KeyRepo implements EncapsulatedKeyRepository {
  aliasToId: Map<string, string>
  idToKey: Map<string, any>
  constructor () {
    this.aliasToId = new Map<string, string>()
    this.idToKey = new Map<string, any>()
  }

  async findById (id: string): Promise<any> {
    return this.idToKey.get(id)
  }

  async findByAlias (alias: string): Promise<any> {
    return this.idToKey.get(this.aliasToId.get(alias) ?? '')
  }

  async save (alias: string, encapsulation: Int8Array, metadata: Record<string, string>): Promise<any> {
    const id = '1'
    this.aliasToId.set(alias, id)
    const key = {
      alias: () => alias,
      encapsulation: () => encapsulation,
      metadata: () => metadata,
      id: () => id
    }
    this.idToKey.set(id, key)
    return await Promise.resolve(key)
  }

  async addAliasById (id: string, alias: string): Promise<void> {
    this.aliasToId.set(alias, id)
    return await Promise.resolve()
  }

  async deleteAliasById (id: string, alias: string): Promise<void> {
    this.aliasToId.delete(alias)
    return await Promise.resolve()
  }

  async deleteById (id: string): Promise<void> {
    this.idToKey.delete(id)
    return await Promise.resolve()
  }
}

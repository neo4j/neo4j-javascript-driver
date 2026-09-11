export default class KeyRepo {
  constructor () {
    this.aliasToId = new Map()
    this.idToKey = new Map()
  }

  findById (id) {
    return this.idToKey.get(id)
  }

  findByAlias (alias) {
    return this.idToKey.get(this.aliasToId.get(alias) ?? '')
  }

  save (alias, encapsulation, metadata) {
    const id = 'testkit-key'
    this.aliasToId.set(alias, id)
    const key = {
      alias: () => alias,
      encapsulation: () => encapsulation,
      metadata: () => metadata,
      id: () => id
    }
    this.idToKey.set(id, key)
    return Promise.resolve(key)
  }

  addAliasById (id, alias) {
    this.aliasToId.set(alias, id)
    return Promise.resolve()
  }

  deleteAliasById (id, alias) {
    this.aliasToId.delete(alias)
    return Promise.resolve()
  }

  deleteById (id) {
    this.idToKey.delete(id)
    return Promise.resolve()
  }
}

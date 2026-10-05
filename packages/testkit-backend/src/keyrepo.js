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

  create (alias, encapsulation, metadata) {
    if (this.aliasToId.has(alias)) {
      throw new Error('failed to create as alias already taken')
    }
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

  setAliasById (id, alias) {
    if (this.aliasToId.has(alias)) {
      throw new Error('failed to set alias as already taken')
    }
    this.deleteAliasById(id)
    this.aliasToId.set(alias, id)
    const key = {
      alias: () => alias,
      id: () => id
    }
    return Promise.resolve(key)
  }

  deleteAliasById (id) {
    let key
    for (const entry of this.aliasToId.entries()) {
      if (entry[1] === id) {
        this.aliasToId.delete(entry[0])
        key = {
          alias: () => null,
          id: () => id
        }
      }
    }
    return Promise.resolve(key)
  }

  deleteById (id) {
    this.idToKey.delete(id)
    const key = {
      alias: () => null,
      id: () => id
    }
    return Promise.resolve(key)
  }
}

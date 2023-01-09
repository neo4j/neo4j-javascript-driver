


export class HomeDatabaseProvider {
  constructor(ttlInSeconds = -1, cache = new Map()) {
    this._ttlMs = ttlInSeconds * 1000
    this._cache = cache
  }

  getDatabaseName ({ database, auth, impersonatedUser }) {
    return database
    if (database != null && database !== '') {
      return database
    }

    const key = impersonatedUser || auth || null

    if (this._cache.has(key)) {
      const { createdAt, database: resolvedDatabase } = this._cache.get(key)
      if ((Date.now() - createdAt) < this._ttlMs) {
        return resolvedDatabase
      }
    }

    return database
  }

  setDatabaseName ({ database, auth, impersonatedUser }) {
    const key = impersonatedUser || auth || null
    this._cache.set(key, { createdAt: Date.now(), database })
  }
}

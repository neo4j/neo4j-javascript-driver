export default class HomeDatabaseCache {
  maxSize: number
  map: Map<string, HomeDatabaseEntry>

  constructor (maxSize: number) {
    this.maxSize = maxSize
    this.map = new Map()
  }

  set (user: string, database: string): void {
    this.map.set(user, { database, lastUsed: Date.now() })
    this._pruneCache()
  }

  get (user: string): string | undefined {
    const value = this.map.get(user)
    if (value !== undefined) {
      value.lastUsed = Date.now()
      return value.database
    }
    return undefined
  }

  delete (user: string): void {
    this.map.delete(user)
  }

  removeFailedDatabase (database: string): void {
    this.map.forEach((_, key) => {
      if (this.map.get(key)?.database === database) {
        this.map.delete(key)
      }
    })
  }

  private _pruneCache (): void {
    console.log(this.map.size)
    if (this.map.size > 1000) {
      const sortedArray = Array.from(this.map.entries()).sort((a, b) => a[1].lastUsed - b[1].lastUsed)
      for (let i = 0; i < 70; i++) { //
        console.error(sortedArray[i])
        this.map.delete(sortedArray[i][0])
      }
    }
  }
}

interface HomeDatabaseEntry {
  database: string
  lastUsed: number
}

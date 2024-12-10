/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [https://neo4j.com]
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Cache which maps users to their last known home database, along with the last time the entry was accessed.
 * 
 * @private
 */
export default class HomeDatabaseCache {
  maxSize: number
  map: Map<string, HomeDatabaseEntry>

  constructor (maxSize: number) {
    this.maxSize = maxSize
    this.map = new Map()
  }

  /**
   * Updates or add an entry to the cache, and prunes the cache if above the maximum allowed size
   * 
   * @param {string} user cache key for the user to set
   * @param {string} database new home database to set for the user
   */
  set (user: string, database: string): void {
    this.map.set(user, { database, lastUsed: Date.now() })
    this._pruneCache()
  }

  /**
   * retrieves the last known home database for a user
   * 
   * @param {string} user cache key for the user to get
   */
  get (user: string): string | undefined {
    const value = this.map.get(user)
    if (value !== undefined) {
      value.lastUsed = Date.now()
      return value.database
    }
    return undefined
  }

  /**
   * removes the entry for a given user in the cache
   * 
   * @param {string} user cache key for the user to remove
   */
  delete (user: string): void {
    this.map.delete(user)
  }

  /**
   * removes all entries listing a given database from the cache
   * 
   * @param {string} database the name of the database to clear from the cache
   */
  removeFailedDatabase (database: string): void {
    this.map.forEach((_, key) => {
      if (this.map.get(key)?.database === database) {
        this.map.delete(key)
      }
    })
  }

  /**
   * Removes a number of the oldest entries in the cache if the number of entries has exceeded the maximum size.
   */
  private _pruneCache (): void {
    if (this.map.size > this.maxSize) {
      const sortedArray = Array.from(this.map.entries()).sort((a, b) => a[1].lastUsed - b[1].lastUsed)
      for (let i = 0; i < 70; i++) { // c * max_size * logn(max_size), c is set to 0.01
        this.map.delete(sortedArray[i][0])
      }
    }
  }
}

/**
 * Interface for an entry in the cache.
 */
interface HomeDatabaseEntry {
  database: string
  lastUsed: number
}

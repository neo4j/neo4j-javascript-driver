/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [http://neo4j.com]
 *
 * This file is part of Neo4j.
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
 * Interface for the piece of software responsible for keeping track of current active bookmarks accross the driver.
 * @interface
 */
export default class BookmarkManager {
  constructor () {
    throw new Error('Not implemented')
  }

  /**
   * Method called when the bookmarks get updated when a transaction finished.
   *
   * This method will be called when auto-commit queries finish and when explicit transactions
   * get commited.
   * @param {string} database The database which the bookmarks belongs to
   * @param {Iterable<string>} previousBookmarks The bookmarks used when starting the transaction
   * @param {Iterable<string>} newBookmarks The new bookmarks received at the end of the transaction.
   * @returns {void}
  */
  updateBookmarks (database: string, previousBookmarks: Iterable<string>, newBookmarks: Iterable<string>): void {
    throw new Error('Not implemented')
  }

  /**
   * Method called by the driver to get the bookmarks for one specific database
   *
   * @param {string} database The database which the bookmarks belong to
   * @returns {Iterable<string>} The set of bookmarks
   */
  getBookmarks (database: string): Iterable<string> {
    throw new Error('Not implemented')
  }

  /**
   * Method called by the driver for getting all the bookmarks.
   *
   * This method should return all bookmarks for all databases present in the BookmarkManager.
   *
   * @returns {Iterable<string>} The set of bookmarks
   */
  getAllBookmarks (): Iterable<string> {
    throw new Error('Not implemented')
  }

  /**
   * Forget the databases and its bookmarks
   *
   * This method is not called by the driver. Forgetting unused databases is the user's responsibility.
   *
   * @param {Iterable<string>} databases The databases which the bookmarks will be removed for.
   */
  forget (databases: Iterable<string>): void {
    throw new Error('Not implemented')
  }
}

export interface BookmarkManagerConfig {
  initialBookmarks?: Map<string, Iterable<string>>
  bookmarksSupplier?: (database?: string) => Iterable<string>
  bookmarksConsumer?: (database: string, bookmarks: Iterable<string>) => void
}

/**
 * @typedef {Object} BookmarkManagerConfig
 * @property {Map<string,Iterable<string>>} [initialBookmarks] Defines the initial set of bookmarks. The key is the database name and the values are the bookmarks.
 * @property {function([database]: string):Iterable<string>} [bookmarksSupplier] Called for supplying extra bookmarks to the BookmarkManager
 * 1. supplying bookmarks from the given database when the default BookmarkManager's `.getBookmarks(database)` gets called.
 * 2. supplying all the bookmarks when the default BookmarkManager's `.getAllBookmarks()` gets called
 * @property {function(database: string, bookmarks: Iterable<string>): void} [bookmarksConsumer] Called when the set of bookmarks for database get updated
 */
/**
 * Provides an configured {@link BookmarkManager} instance.
 *
 * @param {BookmarkManagerConfig} [config={}]
 * @returns {BookmarkManager}
 */
export function bookmarkManager (config: BookmarkManagerConfig = {}): BookmarkManager {
  const initialBookmarks = new Map<string, Set<string>>()

  config.initialBookmarks?.forEach((v, k) => initialBookmarks.set(k, new Set(v)))

  return new Neo4jBookmarkManager(
    initialBookmarks,
    config.bookmarksSupplier,
    config.bookmarksConsumer
  )
}

class Neo4jBookmarkManager implements BookmarkManager {
  constructor (
    private readonly _bookmarksPerDb: Map<string, Set<string>>,
    private readonly _bookmarksSupplier?: (database?: string) => Iterable<string>,
    private readonly _bookmarksConsumer?: (database: string, bookmark: Iterable<string>) => void
  ) {

  }

  updateBookmarks (database: string, previousBookmarks: Iterable<string>, newBookmarks: Iterable<string>): void {
    const bookmarks = this._getOrInitializeBookmarks(database)
    for (const bm of previousBookmarks) {
      bookmarks.delete(bm)
    }
    for (const bm of newBookmarks) {
      bookmarks.add(bm)
    }
    if (typeof this._bookmarksConsumer === 'function') {
      this._bookmarksConsumer(database, [...bookmarks])
    }
  }

  private _getOrInitializeBookmarks (database: string): Set<string> {
    let maybeBookmarks = this._bookmarksPerDb.get(database)
    if (maybeBookmarks === undefined) {
      maybeBookmarks = new Set()
      this._bookmarksPerDb.set(database, maybeBookmarks)
    }
    return maybeBookmarks
  }

  getBookmarks (database: string): Iterable<string> {
    const bookmarks = new Set(this._bookmarksPerDb.get(database))

    if (typeof this._bookmarksSupplier === 'function') {
      const suppliedBookmarks = this._bookmarksSupplier(database) ?? []
      for (const bm of suppliedBookmarks) {
        bookmarks.add(bm)
      }
    }

    return [...bookmarks]
  }

  getAllBookmarks (): Iterable<string> {
    const bookmarks = new Set<string>()

    for (const [, dbBookmarks] of this._bookmarksPerDb) {
      for (const bm of dbBookmarks) {
        bookmarks.add(bm)
      }
    }
    if (typeof this._bookmarksSupplier === 'function') {
      const suppliedBookmarks = this._bookmarksSupplier() ?? []
      for (const bm of suppliedBookmarks) {
        bookmarks.add(bm)
      }
    }

    return bookmarks
  }

  forget (databases: Iterable<string>): void {
    for (const database of databases) {
      this._bookmarksPerDb.delete(database)
    }
  }
}

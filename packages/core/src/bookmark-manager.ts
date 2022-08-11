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

export default interface BookmarkManager {
  /* Method called when the bookmarks get updated when a transaction finished.
  *
  * This method will be called during when auto-commit queries finished and explicit transactions
  * get commited.
  * @param database The database which the bookmarks belongs to
  * @param previousBookmarks The bookmarks used during the transaction creation
  * @param newBookmarks The new bookmarks resolved at the end of the transaction.
  * @returns {void}
  */
  updateBookmarks: (database: string, previousBookmarks: string[], newBookmarks: string[]) => void

  /**
   * Method called by the driver to get the bookmark for one specific database
   *
   * @param database The database which the bookmarks belongs to
   * @returns {string[]} The set of bookmarks
   */
  getBookmarks: (database: string) => string[]

  /**
   * Method called by the driver for getting all the bookmarks.
   *
   * The return of this method should be all the bookmarks present in the BookmarkManager for all databases.
   * The databases informed in the method call will be used for enriching the bookmark set by enforcing the bookmark
   * manager calls `bookmarkSupplier` for these database names even though this database are not present in the bookmark
   * manager map yet.
   *
   * @param mustIncludedDatabases The database which must be included in the result even if they don't have be initialized yet.
   * @returns {string[]} The set of bookmarks
   */
  getAllBookmarks: () => string[]

  /**
   * Forget the databases and its bookmarks
   *
   * This method is not called by the driver. Forgetting unused databases is the user's responsibility.
   *
   * @param databases The databases which the bookmarks will be removed for.
   */
  forget: (databases: string[]) => void
}

export interface BookmarkManagerConfig {
  initialBookmarks?: Map<string, string[]>
  bookmarksSupplier?: (database?: string) => string[]
  bookmarksConsumer?: (database: string, bookmarks: string[]) => void
}

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
    private readonly _bookmarksSupplier?: (database?: string) => string[],
    private readonly _bookmarksConsumer?: (database: string, bookmark: string[]) => void
  ) {

  }

  updateBookmarks (database: string, previousBookmarks: string[], newBookmarks: string[]): void {
    const bookmarks = this._getOrInitializeBookmarks(database)
    previousBookmarks.forEach(bm => bookmarks.delete(bm))
    newBookmarks.forEach(bm => bookmarks.add(bm))

    if (typeof this._bookmarksConsumer === 'function') {
      this._bookmarksConsumer(database, [...bookmarks])
    }
  }

  private _getOrInitializeBookmarks (database: string): Set<string> {
    let maybeBookmarks = this._bookmarksPerDb.get(database)
    if (maybeBookmarks == null) {
      maybeBookmarks = new Set()
      this._bookmarksPerDb.set(database, maybeBookmarks)
    }
    return maybeBookmarks
  }

  getBookmarks (database: string): string[] {
    const bookmarks = this._bookmarksPerDb.get(database) ?? []

    if (typeof this._bookmarksSupplier === 'function') {
      const suppliedBookmarks = this._bookmarksSupplier(database) ?? []
      return [...bookmarks, ...suppliedBookmarks]
    }

    return [...bookmarks]
  }

  getAllBookmarks (): string[] {
    const bookmarks = []

    for (const [, dbBookmarks] of this._bookmarksPerDb) {
      bookmarks.push(...dbBookmarks)
    }
    if (typeof this._bookmarksSupplier === 'function') {
      const suppliedBookmarks = this._bookmarksSupplier() ?? []
      bookmarks.push(...suppliedBookmarks)
    }

    return bookmarks
  }

  forget (databases: string[]): void {
    for (const database of databases) {
      this._bookmarksPerDb.delete(database)
    }
  }
}

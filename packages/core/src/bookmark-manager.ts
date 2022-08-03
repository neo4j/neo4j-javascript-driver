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
  /**
  * Method called when the bookmarks get update because of a given event
  *
  * @param database The database which the bookmarks belongs to
  * @param previousBookmarks The bookmarks used during the session creation
  * @param newBookmarks The new bookmarks resolved at the end of the session.
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
   * Method called by the driver for getting all the bookmarks
   *
   * @param mustIncludedDatabases The database which must be included in the result even if they don't have be initialized yet.
   * @returns {string[]} The set of bookmarks
   */
  getAllBookmarks: (mustIncludedDatabases: string[]) => string[]
}

export interface BookmarkManagerConfig {
  initialBookmarks?: Map<string, string[]>
  bookmarkSupplier?: (database: string) => string[]
  notifyBookmarks?: (database: string, bookmarks: string[]) => void
}

export function bookmarkManager (config: BookmarkManagerConfig = {}): BookmarkManager {
  const initialBookmarks = new Map<string, Set<string>>()

  config.initialBookmarks?.forEach((v, k) => initialBookmarks.set(k, new Set(v)))

  return new Neo4jBookmarkManager(
    initialBookmarks,
    config.bookmarkSupplier,
    config.notifyBookmarks
  )
}

class Neo4jBookmarkManager implements BookmarkManager {
  constructor (
    private readonly _bookmarksPerDb: Map<string, Set<string>>,
    private readonly _bookmarkSupplier?: (database: string) => string[],
    private readonly _notifyBookmarks?: (database: string, bookmark: string[]) => void
  ) {

  }

  updateBookmarks (database: string, previousBookmarks: string[], newBookmarks: string[]): void {
    const bookmarks = this._getOrInitializeBookmarks(database)
    previousBookmarks.forEach(bm => bookmarks.delete(bm))
    newBookmarks.forEach(bm => bookmarks.add(bm))

    if (typeof this._notifyBookmarks === 'function') {
      this._notifyBookmarks(database, [...bookmarks])
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

    if (typeof this._bookmarkSupplier === 'function') {
      const suppliedBookmarks = this._bookmarkSupplier(database) ?? []
      return [...bookmarks, ...suppliedBookmarks]
    }

    return [...bookmarks]
  }

  getAllBookmarks (mustIncludedDatabases: string[]): string[] {
    const bookmarks = []
    const databases = new Set([...this._bookmarksPerDb.keys(), ...mustIncludedDatabases])

    for (const database of databases) {
      bookmarks.push(...this.getBookmarks(database))
    }

    return bookmarks
  }
}

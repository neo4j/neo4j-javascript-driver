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
 * @since 5.0
 */
export default class BookmarkManager {
  /**
   * @constructor
   * @private
   */
  private constructor () {
    throw new Error('Not implemented')
  }

  /**
   * Method called when the bookmarks get updated when a transaction finished.
   *
   * This method will be called when auto-commit queries finish and when explicit transactions
   * get committed.
   *
   * @param {Iterable<string>} previousBookmarks The bookmarks used when starting the transaction
   * @param {Iterable<string>} newBookmarks The new bookmarks received at the end of the transaction.
   * @returns {void}
  */
  async updateBookmarks (previousBookmarks: Iterable<string>, newBookmarks: Iterable<string>): Promise<void> {
    throw new Error('Not implemented')
  }

  /**
   * Method called by the driver to get the bookmarks.
   *
   * @returns {Iterable<string>} The set of bookmarks
   */
  async getBookmarks (): Promise<Iterable<string>> {
    throw new Error('Not implemented')
  }
}

export interface BookmarkManagerConfig {
  initialBookmarks?: Iterable<string>
  bookmarksSupplier?: () => Promise<Iterable<string>>
  bookmarksConsumer?: (bookmarks: Iterable<string>) => Promise<void>
}

/**
 * @typedef {Object} BookmarkManagerConfig
 *
 * @since 5.0
 * @property {Iterable<string>} [initialBookmarks] Defines the initial set of bookmarks. The key is the database name and the values are the bookmarks.
 * @property {function():Promise<Iterable<string>>} [bookmarksSupplier] Called for supplying extra bookmarks to the BookmarkManager
 * @property {function(bookmarks: Iterable<string>): Promise<void>} [bookmarksConsumer] Called when the set of bookmarks  get updated
 */
/**
 * Provides an configured {@link BookmarkManager} instance.
 *
 * @since 5.0
 * @param {BookmarkManagerConfig} [config={}]
 * @returns {BookmarkManager}
 */
export function bookmarkManager (config: BookmarkManagerConfig = {}): BookmarkManager {
  const initialBookmarks = new Set(config.initialBookmarks)

  return new Neo4jBookmarkManager(
    initialBookmarks,
    config.bookmarksSupplier,
    config.bookmarksConsumer
  )
}

class Neo4jBookmarkManager implements BookmarkManager {
  constructor (
    private readonly _bookmarks: Set<string>,
    private readonly _bookmarksSupplier?: () => Promise<Iterable<string>>,
    private readonly _bookmarksConsumer?: (bookmark: Iterable<string>) => Promise<void>
  ) {

  }

  async updateBookmarks (previousBookmarks: Iterable<string>, newBookmarks: Iterable<string>): Promise<void> {
    const bookmarks = this._bookmarks
    for (const bm of previousBookmarks) {
      bookmarks.delete(bm)
    }
    for (const bm of newBookmarks) {
      bookmarks.add(bm)
    }
    if (typeof this._bookmarksConsumer === 'function') {
      await this._bookmarksConsumer([...bookmarks])
    }
  }

  async getBookmarks (): Promise<Iterable<string>> {
    const bookmarks = new Set(this._bookmarks)

    if (typeof this._bookmarksSupplier === 'function') {
      const suppliedBookmarks = await this._bookmarksSupplier() ?? []
      for (const bm of suppliedBookmarks) {
        bookmarks.add(bm)
      }
    }

    return [...bookmarks]
  }
}

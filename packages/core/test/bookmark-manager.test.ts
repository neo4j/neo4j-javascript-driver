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
import {
  bookmarkManager
} from '../src/bookmark-manager'
import { installMatchers } from './utils/matchers'

describe('BookmarkManager', () => {
  const systemBookmarks = ['system:bm01', 'system:bm02']
  const neo4jBookmarks = ['neo4j:bm01', 'neo4j:bm02']

  beforeAll(() => {
    installMatchers()
  })

  describe('getBookmarks()', () => {
    it('should return all bookmarks ', async () => {
      const manager = bookmarkManager({
        initialBookmarks: [...neo4jBookmarks, ...systemBookmarks]
      })

      const bookmarks = await manager.getBookmarks()

      expect(bookmarks).toBeSortedEqual([...neo4jBookmarks, ...systemBookmarks])
    })

    it('should return empty if there are no bookmarks', async () => {
      const manager = bookmarkManager({})

      const bookmarks = await manager.getBookmarks()

      expect(bookmarks).toBeSortedEqual([])
    })

    it('should return enriched bookmarks list with supplied bookmarks', async () => {
      const extraBookmarks = ['neo4j:bmextra', 'system:bmextra', 'adb:bmextra']
      const bookmarksSupplier = jest.fn(async () => await Promise.resolve(extraBookmarks))
      const manager = bookmarkManager({
        initialBookmarks: [...neo4jBookmarks, ...systemBookmarks],
        bookmarksSupplier
      })

      const bookmarks = await manager.getBookmarks()

      expect(bookmarks).toBeSortedEqual(
        [...neo4jBookmarks, ...systemBookmarks, ...extraBookmarks]
      )
    })

    it('should not leak bookmarks from bookmarks supplier to the internal state', async () => {
      const extraBookmarks = ['neo4j:bmextra', 'system:bmextra', 'adb:bmextra']
      const bookmarksSupplier = jest.fn()
      bookmarksSupplier.mockReturnValueOnce(Promise.resolve(extraBookmarks)).mockReturnValue(Promise.resolve([]))
      const manager = bookmarkManager({
        initialBookmarks: [...neo4jBookmarks, ...systemBookmarks],
        bookmarksSupplier
      })

      const bookmarksWithExtraBookmarks = await manager.getBookmarks()

      expect(bookmarksWithExtraBookmarks).toBeSortedEqual(
        [...neo4jBookmarks, ...systemBookmarks, ...extraBookmarks]
      )

      const internalBookmarks = await manager.getBookmarks()

      expect(bookmarksWithExtraBookmarks).toBeSortedEqual(
        [...neo4jBookmarks, ...systemBookmarks]
      )
    })

    it('should return duplicate bookmarks if bookmarksSupplier returns already existing bm', async () => {
      const extraBookmarks = ['neo4j:bmextra', 'system:bmextra', 'adb:bmextra']
      const bookmarksSupplier = jest.fn(async () => await Promise.resolve([...extraBookmarks, ...systemBookmarks]))
      const manager = bookmarkManager({
        initialBookmarks: [...neo4jBookmarks, ...systemBookmarks],
        bookmarksSupplier
      })

      const bookmarks = await manager.getBookmarks()

      expect(bookmarks).toBeSortedEqual(
        [...neo4jBookmarks, ...systemBookmarks, ...extraBookmarks]
      )
    })

    it('should call bookmarkSupplier for getting all bookmarks', async () => {
      const bookmarksSupplier = jest.fn()
      const manager = bookmarkManager({
        initialBookmarks: [...neo4jBookmarks, ...systemBookmarks],
        bookmarksSupplier
      })

      await manager.getBookmarks()

      expect(bookmarksSupplier).toBeCalledWith()
    })
  })

  describe('updateBookmarks()', () => {
    it('should replace previous bookmarks with new bookmarks', async () => {
      const newBookmarks = ['neo4j:bm03']
      const manager = bookmarkManager({
        initialBookmarks: [...neo4jBookmarks, ...systemBookmarks]
      })

      await manager.updateBookmarks(

        await manager.getBookmarks(),
        newBookmarks
      )

      await expect(manager.getBookmarks()).resolves.toBeSortedEqual(newBookmarks)
    })

    it('should not remove bookmarks not present in the original list', async () => {
      const newBookmarks = ['neo4j:bm03']
      const manager = bookmarkManager({
        initialBookmarks: [...neo4jBookmarks, ...systemBookmarks]
      })

      const [bookmarkNotUsedInTx, ...bookmarksUsedInTx] = [...neo4jBookmarks, ...systemBookmarks]
      await manager.updateBookmarks(
        bookmarksUsedInTx,
        newBookmarks
      )

      await expect(manager.getBookmarks())
        .resolves.toBeSortedEqual([bookmarkNotUsedInTx, ...newBookmarks])
    })

    it('should notify new bookmarks', async () => {
      const bookmarksConsumer = jest.fn()
      const newBookmarks = ['neo4j:bm03']
      const manager = bookmarkManager({
        initialBookmarks: [...neo4jBookmarks, ...systemBookmarks],
        bookmarksConsumer
      })

      await manager.updateBookmarks(
        await manager.getBookmarks(),
        newBookmarks
      )

      expect(bookmarksConsumer).toBeCalledWith(newBookmarks)
    })
  })
})

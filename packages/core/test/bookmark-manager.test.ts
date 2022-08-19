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

describe('BookmarkManager', () => {
  const systemBookmarks = ['system:bm01', 'system:bm02']
  const neo4jBookmarks = ['neo4j:bm01', 'neo4j:bm02']

  describe('getBookmarks()', () => {
    it('should return empty if db doesnt exists', async () => {
      const manager = bookmarkManager({})

      const bookmarks = await manager.getBookmarks('neo4j')

      expect(bookmarks).toEqual([])
    })

    it('should return bookmarks for the given db', async () => {
      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['neo4j', neo4jBookmarks],
          ['system', systemBookmarks]
        ])
      })

      const bookmarks = await manager.getBookmarks('neo4j')

      expect(bookmarks).toEqual(neo4jBookmarks)
    })

    it('should return get bookmarks from bookmarkSupplier', async () => {
      const extraBookmarks = ['neo4j:bm03', 'neo4j:bm04']

      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['neo4j', neo4jBookmarks],
          ['system', systemBookmarks]
        ]),
        bookmarksSupplier: async () => await Promise.resolve(extraBookmarks)
      })

      const bookmarks = await manager.getBookmarks('neo4j')

      expect(bookmarks).toEqual([...neo4jBookmarks, ...extraBookmarks])
    })

    it('should return not duplicate bookmarks if bookmarkSupplier returns existing bm', async () => {
      const extraBookmarks = ['neo4j:bm03', 'neo4j:bm04']

      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['neo4j', neo4jBookmarks],
          ['system', systemBookmarks]
        ]),
        bookmarksSupplier: async () => await Promise.resolve([...extraBookmarks, ...neo4jBookmarks])
      })

      const bookmarks = await manager.getBookmarks('neo4j')

      expect(bookmarks).toEqual([...neo4jBookmarks, ...extraBookmarks])
    })

    it('should return call from bookmarkSupplier with correct database', async () => {
      const bookmarksSupplier = jest.fn()

      const manager = bookmarkManager({
        bookmarksSupplier
      })

      await manager.getBookmarks('neo4j')

      expect(bookmarksSupplier).toBeCalledWith('neo4j')
    })
  })

  describe('getAllBookmarks()', () => {
    it('should return all bookmarks ', async () => {
      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['neo4j', neo4jBookmarks],
          ['system', systemBookmarks]
        ])
      })

      const bookmarks = await manager.getAllBookmarks()

      expect([...bookmarks]).toEqual([...neo4jBookmarks, ...systemBookmarks])
    })

    it('should return empty if there are no bookmarks for any db', async () => {
      const manager = bookmarkManager({})

      const bookmarks = await manager.getAllBookmarks()

      expect([...bookmarks]).toEqual([])
    })

    it('should return enriched bookmarks list with supplied bookmarks', async () => {
      const extraBookmarks = ['neo4j:bmextra', 'system:bmextra', 'adb:bmextra']
      const bookmarksSupplier = jest.fn(async (database?: string) => await Promise.resolve(extraBookmarks))
      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['neo4j', neo4jBookmarks],
          ['system', systemBookmarks]
        ]),
        bookmarksSupplier
      })

      const bookmarks = await manager.getAllBookmarks()

      expect([...bookmarks].sort()).toEqual(
        [...neo4jBookmarks, ...systemBookmarks, ...extraBookmarks].sort()
      )
    })

    it('should return duplicate bookmarks if bookmarksSupplier returns already existing bm', async () => {
      const extraBookmarks = ['neo4j:bmextra', 'system:bmextra', 'adb:bmextra']
      const bookmarksSupplier = jest.fn(async (database?: string) => await Promise.resolve([...extraBookmarks, ...systemBookmarks]))
      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['neo4j', neo4jBookmarks],
          ['system', systemBookmarks]
        ]),
        bookmarksSupplier
      })

      const bookmarks = await manager.getAllBookmarks()

      expect([...bookmarks].sort()).toEqual(
        [...neo4jBookmarks, ...systemBookmarks, ...extraBookmarks].sort()
      )
    })

    it('should call bookmarkSupplier for getting all bookmarks', async () => {
      const bookmarksSupplier = jest.fn()
      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['neo4j', neo4jBookmarks],
          ['system', systemBookmarks]
        ]),
        bookmarksSupplier
      })

      await manager.getAllBookmarks()

      expect(bookmarksSupplier).toBeCalledWith()
    })
  })

  describe('updateBookmarks()', () => {
    it('should remove previous bookmarks and new bookmarks for an existing db', async () => {
      const newBookmarks = ['neo4j:bm03']
      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['neo4j', neo4jBookmarks],
          ['system', systemBookmarks]
        ])
      })

      await manager.updateBookmarks(
        'neo4j',
        await manager.getAllBookmarks(),
        newBookmarks
      )

      await expect(manager.getBookmarks('neo4j')).resolves.toEqual(newBookmarks)
      await expect(manager.getBookmarks('system')).resolves.toEqual(systemBookmarks)
    })

    it('should not remove bookmarks not present in the original list', async () => {
      const newBookmarks = ['neo4j:bm03']
      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['neo4j', neo4jBookmarks],
          ['system', systemBookmarks]
        ])
      })

      const [bookmarkNotUsedInTx, ...bookmarksUsedInTx] = neo4jBookmarks
      await manager.updateBookmarks(
        'neo4j',
        bookmarksUsedInTx,
        newBookmarks
      )

      await expect(manager.getBookmarks('neo4j'))
        .resolves.toEqual([bookmarkNotUsedInTx, ...newBookmarks])
      await expect(manager.getBookmarks('system')).resolves.toEqual(systemBookmarks)
    })

    it('should add bookmarks to a non-existing database', async () => {
      const newBookmarks = ['neo4j:bm03']
      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['system', systemBookmarks]
        ])
      })

      await manager.updateBookmarks(
        'neo4j',
        [],
        newBookmarks
      )

      await expect(manager.getBookmarks('neo4j')).resolves.toEqual(newBookmarks)
      await expect(manager.getBookmarks('system')).resolves.toEqual(systemBookmarks)
    })

    it('should notify new bookmarks', async () => {
      const bookmarksConsumer = jest.fn()
      const newBookmarks = ['neo4j:bm03']
      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['neo4j', neo4jBookmarks],
          ['system', systemBookmarks]
        ]),
        bookmarksConsumer
      })

      await manager.updateBookmarks(
        'neo4j',
        await manager.getAllBookmarks(),
        newBookmarks
      )

      expect(bookmarksConsumer).toBeCalledWith('neo4j', newBookmarks)
    })
  })

  describe('forget()', () => {
    it('should forget database', async () => {
      const extraBookmarks = ['system:bmextra', 'adb:bmextra']
      const bookmarksSupplier = jest.fn(async () => extraBookmarks)
      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['neo4j', neo4jBookmarks],
          ['system', systemBookmarks]
        ]),
        bookmarksSupplier
      })

      await manager.forget(['neo4j', 'adb'])
      const bookmarks = await manager.getAllBookmarks()

      expect([...bookmarks].sort()).toEqual(
        [...systemBookmarks, ...extraBookmarks].sort()
      )
    })

    it('should forget what never reminded', async () => {
      const extraBookmarks = ['system:bmextra', 'adb:bmextra']
      const bookmarksSupplier = jest.fn(async () => extraBookmarks)
      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['neo4j', neo4jBookmarks],
          ['system', systemBookmarks]
        ]),
        bookmarksSupplier
      })

      await manager.forget(['unexisting-db'])
      const bookmarks = await manager.getAllBookmarks()

      expect([...bookmarks].sort()).toEqual(
        [...systemBookmarks, ...neo4jBookmarks, ...extraBookmarks].sort()
      )
    })
  })
})

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
    it('should return empty if db doesnt exists', () => {
      const manager = bookmarkManager({})

      const bookmarks = manager.getBookmarks('neo4j')

      expect(bookmarks).toEqual([])
    })

    it('should return bookmarks for the given db', () => {
      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['neo4j', neo4jBookmarks],
          ['system', systemBookmarks]
        ])
      })

      const bookmarks = manager.getBookmarks('neo4j')

      expect(bookmarks).toEqual(neo4jBookmarks)
    })

    it('should return get bookmarks from bookmarkSupplier', () => {
      const extraBookmarks = ['neo4j:bm03', 'neo4j:bm04']

      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['neo4j', neo4jBookmarks],
          ['system', systemBookmarks]
        ]),
        bookmarksSupplier: () => extraBookmarks
      })

      const bookmarks = manager.getBookmarks('neo4j')

      expect(bookmarks).toEqual([...neo4jBookmarks, ...extraBookmarks])
    })

    it('should return call from bookmarkSupplier with correct database', () => {
      const bookmarksSupplier = jest.fn()

      const manager = bookmarkManager({
        bookmarksSupplier
      })

      manager.getBookmarks('neo4j')

      expect(bookmarksSupplier).toBeCalledWith('neo4j')
    })
  })

  describe('getAllBookmarks()', () => {
    it('should return all bookmarks ', () => {
      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['neo4j', neo4jBookmarks],
          ['system', systemBookmarks]
        ])
      })

      const bookmarks = manager.getAllBookmarks()

      expect(bookmarks).toEqual([...neo4jBookmarks, ...systemBookmarks])
    })

    it('should return empty if there are no bookmarks for any db', () => {
      const manager = bookmarkManager({})

      const bookmarks = manager.getAllBookmarks()

      expect(bookmarks).toEqual([])
    })

    it('should return enriched bookmarks list with supplied bookmarks', () => {
      const extraBookmarks = ['neo4j:bmextra', 'system:bmextra', 'adb:bmextra']
      const bookmarksSupplier = jest.fn((database?: string) => extraBookmarks)
      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['neo4j', neo4jBookmarks],
          ['system', systemBookmarks]
        ]),
        bookmarksSupplier
      })

      const bookmarks = manager.getAllBookmarks()

      expect(bookmarks.sort()).toEqual(
        [...neo4jBookmarks, ...systemBookmarks, ...extraBookmarks].sort()
      )
    })

    it('should call bookmarkSupplier for getting all bookmarks', () => {
      const bookmarksSupplier = jest.fn()
      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['neo4j', neo4jBookmarks],
          ['system', systemBookmarks]
        ]),
        bookmarksSupplier
      })

      manager.getAllBookmarks()

      expect(bookmarksSupplier).toBeCalledWith()
    })
  })

  describe('updateBookmarks()', () => {
    it('should remove previous bookmarks and new bookmarks for an existing db', () => {
      const newBookmarks = ['neo4j:bm03']
      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['neo4j', neo4jBookmarks],
          ['system', systemBookmarks]
        ])
      })

      manager.updateBookmarks(
        'neo4j',
        manager.getAllBookmarks(),
        newBookmarks
      )

      expect(manager.getBookmarks('neo4j')).toEqual(newBookmarks)
      expect(manager.getBookmarks('system')).toEqual(systemBookmarks)
    })

    it('should add bookmarks to a non-existing database', () => {
      const newBookmarks = ['neo4j:bm03']
      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['system', systemBookmarks]
        ])
      })

      manager.updateBookmarks(
        'neo4j',
        [],
        newBookmarks
      )

      expect(manager.getBookmarks('neo4j')).toEqual(newBookmarks)
      expect(manager.getBookmarks('system')).toEqual(systemBookmarks)
    })

    it('should notify new bookmarks', () => {
      const bookmarksConsumer = jest.fn()
      const newBookmarks = ['neo4j:bm03']
      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['neo4j', neo4jBookmarks],
          ['system', systemBookmarks]
        ]),
        bookmarksConsumer
      })

      manager.updateBookmarks(
        'neo4j',
        manager.getAllBookmarks(),
        newBookmarks
      )

      expect(bookmarksConsumer).toBeCalledWith('neo4j', newBookmarks)
    })
  })

  describe('forget()', () => {
    it('should forget database', () => {
      const extraBookmarks = ['system:bmextra', 'adb:bmextra']
      const bookmarksSupplier = jest.fn(() => extraBookmarks)
      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['neo4j', neo4jBookmarks],
          ['system', systemBookmarks]
        ]),
        bookmarksSupplier
      })

      manager.forget(['neo4j', 'adb'])
      const bookmarks = manager.getAllBookmarks()

      expect(bookmarks.sort()).toEqual(
        [...systemBookmarks, ...extraBookmarks].sort()
      )
    })
  })
})

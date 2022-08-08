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
        bookmarkSupplier: () => extraBookmarks
      })

      const bookmarks = manager.getBookmarks('neo4j')

      expect(bookmarks).toEqual([...neo4jBookmarks, ...extraBookmarks])
    })

    it('should return call from bookmarkSupplier with correct database', () => {
      const bookmarkSupplier = jest.fn()

      const manager = bookmarkManager({
        bookmarkSupplier
      })

      manager.getBookmarks('neo4j')

      expect(bookmarkSupplier).toBeCalledWith('neo4j')
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

      const bookmarks = manager.getAllBookmarks(['neo4j', 'adb'])

      expect(bookmarks).toEqual([...neo4jBookmarks, ...systemBookmarks])
    })

    it('should return empty if there isnt bookmarks for any db', () => {
      const manager = bookmarkManager({})

      const bookmarks = manager.getAllBookmarks(['neo4j', 'adb'])

      expect(bookmarks).toEqual([])
    })

    it('should return enrich bookmarks list with supplied bookmarks', () => {
      const extraBookmarks = ['neo4j:bmextra', 'system:bmextra', 'adb:bmextra']
      const bookmarkSupplier = jest.fn((database: string) => [`${database}:bmextra`])
      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['neo4j', neo4jBookmarks],
          ['system', systemBookmarks]
        ]),
        bookmarkSupplier
      })

      const bookmarks = manager.getAllBookmarks(['neo4j', 'adb'])

      expect(bookmarks.sort()).toEqual(
        [...neo4jBookmarks, ...systemBookmarks, ...extraBookmarks].sort()
      )
    })

    it('should call bookmarkSupplier for each existing and listed databases ', () => {
      const bookmarkSupplier = jest.fn()
      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['neo4j', neo4jBookmarks],
          ['system', systemBookmarks]
        ]),
        bookmarkSupplier
      })

      manager.getAllBookmarks(['neo4j', 'adb'])

      expect(bookmarkSupplier).toBeCalledWith('neo4j')
      expect(bookmarkSupplier).toBeCalledWith('adb')
      expect(bookmarkSupplier).toBeCalledWith('system')
    })
  })

  describe('updateBookmarks()', () => {
    it('should remove previous bookmarks and new bookmarks an existing db', () => {
      const newBookmarks = ['neo4j:bm03']
      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['neo4j', neo4jBookmarks],
          ['system', systemBookmarks]
        ])
      })

      manager.updateBookmarks(
        'neo4j',
        manager.getAllBookmarks(['neo4j', 'system']),
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
      const notifyBookmarks = jest.fn()
      const newBookmarks = ['neo4j:bm03']
      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['neo4j', neo4jBookmarks],
          ['system', systemBookmarks]
        ]),
        notifyBookmarks
      })

      manager.updateBookmarks(
        'neo4j',
        manager.getAllBookmarks(['neo4j', 'system']),
        newBookmarks
      )

      expect(notifyBookmarks).toBeCalledWith('neo4j', newBookmarks)
    })
  })

  describe('forget()', () => {
    it('should forgot database', () => {
      const extraBookmarks = ['system:bmextra', 'adb:bmextra']
      const bookmarkSupplier = jest.fn((database: string) => [`${database}:bmextra`])
      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['neo4j', neo4jBookmarks],
          ['system', systemBookmarks]
        ]),
        bookmarkSupplier
      })

      manager.forget(['neo4j', 'adb'])
      const bookmarks = manager.getAllBookmarks(['system', 'adb'])

      expect(bookmarks.sort()).toEqual(
        [...systemBookmarks, ...extraBookmarks].sort()
      )
    })

    it('getAllBookmarks() should not call bookmarkSupplier for the forget dbs', () => {
      const bookmarkSupplier = jest.fn((database: string) => [`${database}:bmextra`])
      const manager = bookmarkManager({
        initialBookmarks: new Map([
          ['neo4j', neo4jBookmarks],
          ['system', systemBookmarks]
        ]),
        bookmarkSupplier
      })

      manager.forget(['neo4j', 'adb'])
      manager.getAllBookmarks(['system', 'adb'])

      expect(bookmarkSupplier).not.toBeCalledWith('neo4j')
    })
  })
})

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
import { internal } from 'neo4j-driver-core'

const {
  bookmarks: { Bookmarks }
} = internal

describe('#unit Bookmarks', () => {
  it('should be possible to construct bookmarks from string', () => {
    const bookmarks = new Bookmarks('neo4j:bookmark:v1:tx412')

    expect(bookmarks.isEmpty()).toBeFalsy()
    expect(bookmarks.values()).toEqual(['neo4j:bookmark:v1:tx412'])
  })

  it('should be possible to construct bookmarks from string array', () => {
    const bookmarks = new Bookmarks([
      'neo4j:bookmark:v1:tx1',
      'neo4j:bookmark:v1:tx2',
      'neo4j:bookmark:v1:tx3'
    ])

    expect(bookmarks.isEmpty()).toBeFalsy()
    expect(bookmarks.values()).toEqual([
      'neo4j:bookmark:v1:tx1',
      'neo4j:bookmark:v1:tx2',
      'neo4j:bookmark:v1:tx3'
    ])
  })

  it('should be possible to construct bookmarks from null', () => {
    const bookmarks = new Bookmarks(null)

    expect(bookmarks.isEmpty()).toBeTruthy()
    expect(bookmarks.values()).toEqual([])
  })

  it('should be possible to construct bookmarks from undefined', () => {
    const bookmarks = new Bookmarks(undefined)

    expect(bookmarks.isEmpty()).toBeTruthy()
    expect(bookmarks.values()).toEqual([])
  })

  it('should be possible to construct bookmarks from an empty string', () => {
    const bookmarks = new Bookmarks('')

    expect(bookmarks.isEmpty()).toBeTruthy()
    expect(bookmarks.values()).toEqual([])
  })

  it('should be possible to construct bookmarks from empty array', () => {
    const bookmarks = new Bookmarks([])

    expect(bookmarks.isEmpty()).toBeTruthy()
    expect(bookmarks.values()).toEqual([])
  })

  it('should be possible to construct bookmarks from nested arrays', () => {
    const bookmarks = new Bookmarks([
      'neo4j:bookmark:v1:tx1',
      ['neo4j:bookmark:v1:tx2'],
      [
        ['neo4j:bookmark:v1:tx3', 'neo4j:bookmark:v1:tx4'],
        ['neo4j:bookmark:v1:tx5', 'neo4j:bookmark:v1:tx6']
      ]
    ])

    expect(bookmarks.isEmpty()).toBeFalsy()
    expect(bookmarks.values()).toEqual([
      'neo4j:bookmark:v1:tx1',
      'neo4j:bookmark:v1:tx2',
      'neo4j:bookmark:v1:tx3',
      'neo4j:bookmark:v1:tx4',
      'neo4j:bookmark:v1:tx5',
      'neo4j:bookmark:v1:tx6'
    ])
  })

  it('should be possible to construct bookmarks from nested arrays with null and undefined elements', () => {
    const bookmarks = new Bookmarks([
      'neo4j:bookmark:v1:tx1',
      null,
      undefined,
      ['neo4j:bookmark:v1:tx2'],
      [undefined],
      [
        ['neo4j:bookmark:v1:tx3', 'neo4j:bookmark:v1:tx4'],
        [undefined, 'neo4j:bookmark:v1:tx5', 'neo4j:bookmark:v1:tx6', null]
      ]
    ])

    expect(bookmarks.isEmpty()).toBeFalsy()
    expect(bookmarks.values()).toEqual([
      'neo4j:bookmark:v1:tx1',
      'neo4j:bookmark:v1:tx2',
      'neo4j:bookmark:v1:tx3',
      'neo4j:bookmark:v1:tx4',
      'neo4j:bookmark:v1:tx5',
      'neo4j:bookmark:v1:tx6'
    ])
  })

  it('should not be possible to construct bookmarks from object', () => {
    expect(() => new Bookmarks({})).toThrowError(TypeError)
    expect(
      () => new Bookmarks({ bookmarks: 'neo4j:bookmark:v1:tx1' })
    ).toThrowError(TypeError)
  })

  it('should not be possible to construct bookmarks from number array', () => {
    expect(() => new Bookmarks([1, 2, 3])).toThrowError(TypeError)
  })

  it('should not be possible to construct bookmarks from mixed array', () => {
    expect(
      () => new Bookmarks(['neo4j:bookmark:v1:tx1', 2, 'neo4j:bookmark:v1:tx3'])
    ).toThrowError(TypeError)
  })

  it('should keep unparsable bookmarks', () => {
    const bookmarks = new Bookmarks('neo4j:bookmark:v1:txWrong')

    expect(bookmarks.isEmpty()).toBeFalsy()
    expect(bookmarks.values()).toEqual(['neo4j:bookmark:v1:txWrong'])
  })

  it('should keep unparsable bookmarks', () => {
    const bookmarks = new Bookmarks([
      'neo4j:bookmark:v1:tx42',
      'neo4j:bookmark:v1:txWrong',
      'neo4j:bookmark:v1:tx4242'
    ])

    expect(bookmarks.isEmpty()).toBeFalsy()
    expect(bookmarks.values()).toEqual([
      'neo4j:bookmark:v1:tx42',
      'neo4j:bookmark:v1:txWrong',
      'neo4j:bookmark:v1:tx4242'
    ])
  })

  it('should turn into empty transaction params when empty', () => {
    const bookmarks = new Bookmarks(null)

    expect(bookmarks.isEmpty()).toBeTruthy()
    expect(bookmarks.asBeginTransactionParameters()).toEqual({})
  })

  it('should turn into transaction params when represents single bookmarks', () => {
    const bookmarks = new Bookmarks('neo4j:bookmark:v1:tx142')

    expect(bookmarks.isEmpty()).toBeFalsy()
    expect(bookmarks.asBeginTransactionParameters()).toEqual({
      bookmarks: ['neo4j:bookmark:v1:tx142']
    })
  })

  it('should turn into transaction params when represents multiple bookmarks', () => {
    const bookmarks = new Bookmarks([
      'neo4j:bookmark:v1:tx1',
      'neo4j:bookmark:v1:tx3',
      'neo4j:bookmark:v1:tx42',
      'neo4j:bookmark:v1:tx5'
    ])

    expect(bookmarks.isEmpty()).toBeFalsy()
    expect(bookmarks.asBeginTransactionParameters()).toEqual({
      bookmarks: [
        'neo4j:bookmark:v1:tx1',
        'neo4j:bookmark:v1:tx3',
        'neo4j:bookmark:v1:tx42',
        'neo4j:bookmark:v1:tx5'
      ]
    })
  })

  it('should expose bookmarks values', () => {
    expect(new Bookmarks(undefined).values()).toEqual([])
    expect(new Bookmarks(null).values()).toEqual([])

    const bookmarksString = 'neo4j:bookmark:v1:tx123'
    expect(new Bookmarks(bookmarksString).values()).toEqual([bookmarksString])

    const bookmarksStrings = [
      'neo4j:bookmark:v1:tx1',
      'neo4j:bookmark:v1:tx2',
      'neo4j:bookmark:v1:tx3'
    ]
    expect(new Bookmarks(bookmarksStrings).values()).toEqual(bookmarksStrings)
  })

  it('should expose empty bookmarks value', () => {
    const bookmarks = Bookmarks.empty()
    expect(bookmarks).toBeDefined()
    expect(bookmarks.isEmpty()).toBeTruthy()
  })
})

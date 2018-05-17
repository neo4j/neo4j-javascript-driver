/**
 * Copyright (c) 2002-2018 "Neo4j,"
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
import Bookmark from '../../src/v1/internal/bookmark';

describe('Bookmark', () => {

  it('should be possible to construct bookmark from string', () => {
    const bookmark = new Bookmark('neo4j:bookmark:v1:tx412');

    expect(bookmark.isEmpty()).toBeFalsy();
    expect(bookmark.maxBookmarkAsString()).toEqual('neo4j:bookmark:v1:tx412');
  });

  it('should be possible to construct bookmark from string array', () => {
    const bookmark = new Bookmark(['neo4j:bookmark:v1:tx1', 'neo4j:bookmark:v1:tx2', 'neo4j:bookmark:v1:tx3']);

    expect(bookmark.isEmpty()).toBeFalsy();
    expect(bookmark.maxBookmarkAsString()).toEqual('neo4j:bookmark:v1:tx3');
  });

  it('should be possible to construct bookmark from null', () => {
    const bookmark = new Bookmark(null);

    expect(bookmark.isEmpty()).toBeTruthy();
    expect(bookmark.maxBookmarkAsString()).toBeNull();
  });

  it('should be possible to construct bookmark from undefined', () => {
    const bookmark = new Bookmark(undefined);

    expect(bookmark.isEmpty()).toBeTruthy();
    expect(bookmark.maxBookmarkAsString()).toBeNull();
  });

  it('should be possible to construct bookmark from an empty string', () => {
    const bookmark = new Bookmark('');

    expect(bookmark.isEmpty()).toBeTruthy();
    expect(bookmark.maxBookmarkAsString()).toBeNull();
  });

  it('should be possible to construct bookmark from empty array', () => {
    const bookmark = new Bookmark([]);

    expect(bookmark.isEmpty()).toBeTruthy();
    expect(bookmark.maxBookmarkAsString()).toBeNull();
  });

  it('should not be possible to construct bookmark from object', () => {
    expect(() => new Bookmark({})).toThrowError(TypeError);
    expect(() => new Bookmark({bookmark: 'neo4j:bookmark:v1:tx1'})).toThrowError(TypeError);
  });

  it('should not be possible to construct bookmark from number array', () => {
    expect(() => new Bookmark([1, 2, 3])).toThrowError(TypeError);
  });

  it('should not be possible to construct bookmark from mixed array', () => {
    expect(() => new Bookmark(['neo4j:bookmark:v1:tx1', 2, 'neo4j:bookmark:v1:tx3'])).toThrowError(TypeError);
  });

  it('should keep unparsable bookmark', () => {
    const bookmark = new Bookmark('neo4j:bookmark:v1:txWrong');

    expect(bookmark.isEmpty()).toBeFalsy();
    expect(bookmark.maxBookmarkAsString()).toEqual('neo4j:bookmark:v1:txWrong');
  });

  it('should skip unparsable bookmarks', () => {
    const bookmark = new Bookmark(['neo4j:bookmark:v1:tx42', 'neo4j:bookmark:v1:txWrong', 'neo4j:bookmark:v1:tx4242']);

    expect(bookmark.isEmpty()).toBeFalsy();
    expect(bookmark.maxBookmarkAsString()).toEqual('neo4j:bookmark:v1:tx4242');
  });

  it('should turn into empty transaction params when empty', () => {
    const bookmark = new Bookmark(null);

    expect(bookmark.isEmpty()).toBeTruthy();
    expect(bookmark.asBeginTransactionParameters()).toEqual({});
  });

  it('should turn into transaction params when represents single bookmark', () => {
    const bookmark = new Bookmark('neo4j:bookmark:v1:tx142');

    expect(bookmark.isEmpty()).toBeFalsy();
    expect(bookmark.asBeginTransactionParameters()).toEqual({
      bookmark: 'neo4j:bookmark:v1:tx142',
      bookmarks: ['neo4j:bookmark:v1:tx142']
    });
  });

  it('should turn into transaction params when represents multiple bookmarks', () => {
    const bookmark = new Bookmark(
      ['neo4j:bookmark:v1:tx1', 'neo4j:bookmark:v1:tx3', 'neo4j:bookmark:v1:tx42', 'neo4j:bookmark:v1:tx5']
    );

    expect(bookmark.isEmpty()).toBeFalsy();
    expect(bookmark.asBeginTransactionParameters()).toEqual({
      bookmark: 'neo4j:bookmark:v1:tx42',
      bookmarks: ['neo4j:bookmark:v1:tx1', 'neo4j:bookmark:v1:tx3', 'neo4j:bookmark:v1:tx42', 'neo4j:bookmark:v1:tx5']
    });
  });

});

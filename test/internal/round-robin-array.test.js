/**
 * Copyright (c) 2002-2018 "Neo Technology,"
 * Network Engine for Objects in Lund AB [http://neotechnology.com]
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
import RoundRobinArray from '../../lib/v1/internal/round-robin-array';

describe('round-robin-array', () => {

  it('should behave correctly when empty', () => {
    const array = new RoundRobinArray();

    expect(array.isEmpty()).toBeTruthy();
    expect(array.size()).toEqual(0);
    expect(array.next()).toBeNull();
    expect(array.toArray()).toEqual([]);

    array.remove(1);

    expect(array.isEmpty()).toBeTruthy();
    expect(array.size()).toEqual(0);
    expect(array.next()).toBeNull();
    expect(array.toArray()).toEqual([]);
  });

  it('should behave correctly when contains single element', () => {
    const array = new RoundRobinArray([5]);

    expect(array.isEmpty()).toBeFalsy();
    expect(array.size()).toEqual(1);
    expect(array.next()).toEqual(5);
    expect(array.toArray()).toEqual([5]);

    array.remove(1);

    expect(array.isEmpty()).toBeFalsy();
    expect(array.size()).toEqual(1);
    expect(array.next()).toEqual(5);
    expect(array.toArray()).toEqual([5]);

    array.remove(5);

    expect(array.isEmpty()).toBeTruthy();
    expect(array.size()).toEqual(0);
    expect(array.next()).toBeNull();
    expect(array.toArray()).toEqual([]);
  });

  it('should push items', () => {
    const array1 = new RoundRobinArray();
    array1.pushAll([1]);
    expect(array1.toArray()).toEqual([1]);

    const array2 = new RoundRobinArray([]);
    array2.pushAll([1, 2, 3]);
    expect(array2.toArray()).toEqual([1, 2, 3]);

    const array3 = new RoundRobinArray([1, 2, 3]);
    array3.pushAll([4, 5]);
    expect(array3.toArray()).toEqual([1, 2, 3, 4, 5]);
  });

  it('should push empty array', () => {
    const emptyArray = new RoundRobinArray();
    emptyArray.pushAll([]);
    expect(emptyArray.isEmpty()).toBeTruthy();

    const nonEmptyArray = new RoundRobinArray([1, 2, 3]);
    nonEmptyArray.pushAll([]);
    expect(nonEmptyArray.toArray()).toEqual([1, 2, 3]);
  });

  it('should throw when trying to push illegal items', () => {
    const emptyArray = new RoundRobinArray();
    const nonEmptyArray = new RoundRobinArray([1, 2, 3]);

    expect(() => emptyArray.pushAll(undefined)).toThrow();
    expect(() => nonEmptyArray.pushAll(undefined)).toThrow();

    expect(() => emptyArray.pushAll(null)).toThrow();
    expect(() => nonEmptyArray.pushAll(null)).toThrow();

    expect(() => emptyArray.pushAll({})).toThrow();
    expect(() => nonEmptyArray.pushAll({})).toThrow();

    expect(() => emptyArray.pushAll({a: 1, b: 2})).toThrow();
    expect(() => nonEmptyArray.pushAll({a: 1, b: 2})).toThrow();
  });

  it('should step through array', () => {
    const array = new RoundRobinArray([1, 2, 3, 4, 5]);

    expect(array.next()).toEqual(1);
    expect(array.next()).toEqual(2);
    expect(array.next()).toEqual(3);
    expect(array.next()).toEqual(4);
    expect(array.next()).toEqual(5);
    expect(array.next()).toEqual(1);
    expect(array.next()).toEqual(2);
  });

  it('should step through single element array', () => {
    const array = new RoundRobinArray([5]);

    expect(array.next()).toEqual(5);
    expect(array.next()).toEqual(5);
    expect(array.next()).toEqual(5);
  });

  it('should handle deleting item before current ', () => {
    const array = new RoundRobinArray([1, 2, 3, 4, 5]);

    expect(array.next()).toEqual(1);
    expect(array.next()).toEqual(2);
    array.remove(2);
    expect(array.next()).toEqual(4);
    expect(array.next()).toEqual(5);
    expect(array.next()).toEqual(1);
    expect(array.next()).toEqual(3);
    expect(array.next()).toEqual(4);
    expect(array.next()).toEqual(5);
  });

  it('should handle deleting item on current ', () => {
    const array = new RoundRobinArray([1, 2, 3, 4, 5]);

    expect(array.next()).toEqual(1);
    expect(array.next()).toEqual(2);
    array.remove(3);
    expect(array.next()).toEqual(4);
    expect(array.next()).toEqual(5);
    expect(array.next()).toEqual(1);
    expect(array.next()).toEqual(2);
    expect(array.next()).toEqual(4);
    expect(array.next()).toEqual(5);
  });

  it('should handle deleting item after current ', () => {
    const array = new RoundRobinArray([1, 2, 3, 4, 5]);

    expect(array.next()).toEqual(1);
    expect(array.next()).toEqual(2);
    array.remove(4);
    expect(array.next()).toEqual(3);
    expect(array.next()).toEqual(5);
    expect(array.next()).toEqual(1);
    expect(array.next()).toEqual(2);
    expect(array.next()).toEqual(3);
  });

  it('should handle deleting last item ', () => {
    const array = new RoundRobinArray([1, 2, 3, 4, 5]);

    expect(array.next()).toEqual(1);
    expect(array.next()).toEqual(2);
    expect(array.next()).toEqual(3);
    expect(array.next()).toEqual(4);
    array.remove(5);
    expect(array.next()).toEqual(1);
    expect(array.next()).toEqual(2);
    expect(array.next()).toEqual(3);
    expect(array.next()).toEqual(4);
    expect(array.next()).toEqual(1);
  });

  it('should handle deleting first item ', () => {
    const array = new RoundRobinArray([1, 2, 3, 4, 5]);
    array.remove(1);
    expect(array.next()).toEqual(2);
    expect(array.next()).toEqual(3);
    expect(array.next()).toEqual(4);
    expect(array.next()).toEqual(5);
    expect(array.next()).toEqual(2);
    expect(array.next()).toEqual(3);
    expect(array.next()).toEqual(4);
    expect(array.next()).toEqual(5);
  });

  it('should handle deleting multiple items ', () => {
    const array = new RoundRobinArray([1, 2, 3, 1, 1]);
    array.remove(1);
    expect(array.next()).toEqual(2);
    expect(array.next()).toEqual(3);
    expect(array.next()).toEqual(2);
    expect(array.next()).toEqual(3);
  });

  it('should have correct toString ', () => {
    const array = new RoundRobinArray([1, 2, 3]);
    expect(array.toString()).toEqual('[1,2,3]');
  });

});

/**
 * Copyright (c) 2002-2016 "Neo Technology,"
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

var RoundRobinArray = require('../../lib/v1/internal/round-robin-array').default;

describe('round-robin-array', function() {
  it('should step through array', function () {
    var array = new RoundRobinArray([1,2,3,4,5]);

    expect(array.hop()).toEqual(1);
    expect(array.hop()).toEqual(2);
    expect(array.hop()).toEqual(3);
    expect(array.hop()).toEqual(4);
    expect(array.hop()).toEqual(5);
    expect(array.hop()).toEqual(1);
    expect(array.hop()).toEqual(2);
    //....
  });

  it('should step through single element array', function () {
    var array = new RoundRobinArray([5]);

    expect(array.hop()).toEqual(5);
    expect(array.hop()).toEqual(5);
    expect(array.hop()).toEqual(5);
    //....
  });

  it('should handle deleting item before current ', function () {
    var array = new RoundRobinArray([1,2,3,4,5]);

    expect(array.hop()).toEqual(1);
    expect(array.hop()).toEqual(2);
    array.remove(2);
    expect(array.hop()).toEqual(3);
    expect(array.hop()).toEqual(4);
    expect(array.hop()).toEqual(5);
    expect(array.hop()).toEqual(1);
    expect(array.hop()).toEqual(3);
    //....
  });

  it('should handle deleting item on current ', function () {
    var array = new RoundRobinArray([1,2,3,4,5]);

    expect(array.hop()).toEqual(1);
    expect(array.hop()).toEqual(2);
    array.remove(3);
    expect(array.hop()).toEqual(4);
    expect(array.hop()).toEqual(5);
    expect(array.hop()).toEqual(1);
    expect(array.hop()).toEqual(2);
    expect(array.hop()).toEqual(4);
    //....
  });

  it('should handle deleting item after current ', function () {
    var array = new RoundRobinArray([1,2,3,4,5]);

    expect(array.hop()).toEqual(1);
    expect(array.hop()).toEqual(2);
    array.remove(4);
    expect(array.hop()).toEqual(3);
    expect(array.hop()).toEqual(5);
    expect(array.hop()).toEqual(1);
    expect(array.hop()).toEqual(2);
    expect(array.hop()).toEqual(3);
    //....
  });

  it('should handle deleting last item ', function () {
    var array = new RoundRobinArray([1,2,3,4,5]);

    expect(array.hop()).toEqual(1);
    expect(array.hop()).toEqual(2);
    expect(array.hop()).toEqual(3);
    expect(array.hop()).toEqual(4);
    array.remove(5);
    expect(array.hop()).toEqual(1);
    expect(array.hop()).toEqual(2);
    expect(array.hop()).toEqual(3);
    expect(array.hop()).toEqual(4);
    expect(array.hop()).toEqual(1);
    //....
  });

  it('should handle deleting first item ', function () {
    var array = new RoundRobinArray([1,2,3,4,5]);
    array.remove(1);
    expect(array.hop()).toEqual(2);
    expect(array.hop()).toEqual(3);
    expect(array.hop()).toEqual(4);
    expect(array.hop()).toEqual(5);
    expect(array.hop()).toEqual(2);
    expect(array.hop()).toEqual(3);
    expect(array.hop()).toEqual(4);
    expect(array.hop()).toEqual(5);
    //....
  });

  it('should handle deleting multiple items ', function () {
    var array = new RoundRobinArray([1,2,3,1,1]);
    array.remove(1);
    expect(array.hop()).toEqual(2);
    expect(array.hop()).toEqual(3);
    expect(array.hop()).toEqual(2);
    expect(array.hop()).toEqual(3);
    //....
  });

});

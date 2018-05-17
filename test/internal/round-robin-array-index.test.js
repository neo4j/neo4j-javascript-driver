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
import RoundRobinArrayIndex from '../../src/v1/internal/round-robin-array-index';

describe('RoundRobinArrayIndex', () => {

  it('should return -1 for empty array', () => {
    const arrayLength = 0;
    const index = new RoundRobinArrayIndex();

    expect(index.next(arrayLength)).toEqual(-1);
  });

  it('should always return 0 for single element array', () => {
    const arrayLength = 1;
    const index = new RoundRobinArrayIndex();

    expect(index.next(arrayLength)).toEqual(0);
    expect(index.next(arrayLength)).toEqual(0);
    expect(index.next(arrayLength)).toEqual(0);
  });

  it('should round robin for multi element array', () => {
    const arrayLength = 5;
    const index = new RoundRobinArrayIndex();

    expect(index.next(arrayLength)).toEqual(0);
    expect(index.next(arrayLength)).toEqual(1);
    expect(index.next(arrayLength)).toEqual(2);
    expect(index.next(arrayLength)).toEqual(3);
    expect(index.next(arrayLength)).toEqual(4);
    expect(index.next(arrayLength)).toEqual(0);
    expect(index.next(arrayLength)).toEqual(1);
    expect(index.next(arrayLength)).toEqual(2);
    expect(index.next(arrayLength)).toEqual(3);
    expect(index.next(arrayLength)).toEqual(4);
  });

  it('should move back to zero when overflow', () => {
    const arrayLength = 5;
    const index = new RoundRobinArrayIndex(Number.MAX_SAFE_INTEGER - 2);

    expect(index.next(arrayLength)).toEqual(4);
    expect(index.next(arrayLength)).toEqual(0);
    expect(index.next(arrayLength)).toEqual(0);
    expect(index.next(arrayLength)).toEqual(1);
    expect(index.next(arrayLength)).toEqual(2);
    expect(index.next(arrayLength)).toEqual(3);
    expect(index.next(arrayLength)).toEqual(4);
    expect(index.next(arrayLength)).toEqual(0);
  });

});

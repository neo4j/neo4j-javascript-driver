/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [https://neo4j.com]
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

import { vector } from '../src'

describe('Vector', () => {
  describe('vector', () => {
    it.each([
      ['Int8Array', Int8Array.from([0]), 'INT8'],
      ['Int16Array', Int16Array.from([0]), 'INT16'],
      ['Int32Array', Int32Array.from([0]), 'INT32'],
      ['BigInt64Array', BigInt64Array.from([BigInt(0)]), 'INT64'],
      ['Float32Array', Float32Array.from([0]), 'FLOAT32'],
      ['Float64Array', Float64Array.from([0]), 'FLOAT64']
    ])('should create vector from (%s)', (_, typedArray, expectedType) => {
      const vec = vector(typedArray)
      expect(vec.getType()).toEqual(expectedType)
      expect(vec.asTypedArray()).toEqual(typedArray)
    })
  })
  describe('.toString()', () => {
    it.each([
      ['Int8Array', Int8Array.from([1]), 'vector([1], 1, INTEGER8 NOT NULL)'],
      ['Int16Array', Int16Array.from([1, 2, 3]), 'vector([1, 2, 3], 3, INTEGER16 NOT NULL)'],
      ['Int32Array', Int32Array.from([3]), 'vector([3], 1, INTEGER32 NOT NULL)'],
      ['BigInt64Array', BigInt64Array.from([BigInt(0)]), 'vector([0], 1, INTEGER NOT NULL)'],
      ['Float32Array', Float32Array.from([0.5, 1.875]), 'vector([0.5, 1.875], 2, FLOAT32 NOT NULL)'],
      ['Float32Array with special values', Float32Array.from([-Infinity, Infinity, NaN, -NaN]), 'vector([-Infinity, Infinity, NaN, NaN], 4, FLOAT32 NOT NULL)'],
      ['Float64Array', Float64Array.from([2]), 'vector([2], 1, FLOAT NOT NULL)'],
      ['Float64Array with special values', Float64Array.from([-Infinity, Infinity, NaN, -NaN]), 'vector([-Infinity, Infinity, NaN, NaN], 4, FLOAT NOT NULL)']
    ])('should correctly stringify (%s)', (_, typedArray, expectedString) => {
      const vec = vector(typedArray)
      expect(vec.toString()).toEqual(expectedString)
    })
  })
})

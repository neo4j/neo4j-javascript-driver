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
import { assertNumber, assertNumberOrInteger } from './internal/util'
import { NumberOrInteger } from './graph-types'
import Integer from './integer'

const POINT_IDENTIFIER_PROPERTY = '__isPoint__'

/**
 * Represents a single two or three-dimensional point in a particular coordinate reference system.
 * Created `Point` objects are frozen with `Object.freeze()` in constructor and thus immutable.
 */
export class Point<T extends NumberOrInteger = Integer> {
  readonly srid: T
  readonly x: number
  readonly y: number
  readonly z: number | undefined

  /**
   * @constructor
   * @param {T} srid - The coordinate reference system identifier.
   * @param {number} x - The `x` coordinate of the point.
   * @param {number} y - The `y` coordinate of the point.
   * @param {number} [z=undefined] - The `z` coordinate of the point or `undefined` if point has 2 dimensions.
   */
  constructor(srid: T, x: number, y: number, z?: number) {
    /**
     * The coordinate reference system identifier.
     * @type {T}
     */
    this.srid = <T>assertNumberOrInteger(srid, 'SRID')
    /**
     * The `x` coordinate of the point.
     * @type {number}
     */
    this.x = assertNumber(x, 'X coordinate')
    /**
     * The `y` coordinate of the point.
     * @type {number}
     */
    this.y = assertNumber(y, 'Y coordinate')
    /**
     * The `z` coordinate of the point or `undefined` if point is 2-dimensional.
     * @type {number}
     */
    this.z = z === null || z === undefined ? z : assertNumber(z, 'Z coordinate')
    Object.freeze(this)
  }

  /**
   * @ignore
   */
  toString(): string {
    return this.z || this.z === 0
      ? `Point{srid=${formatAsFloat(this.srid)}, x=${formatAsFloat(
          this.x
        )}, y=${formatAsFloat(this.y)}, z=${formatAsFloat(this.z)}}`
      : `Point{srid=${formatAsFloat(this.srid)}, x=${formatAsFloat(
          this.x
        )}, y=${formatAsFloat(this.y)}}`
  }
}

function formatAsFloat(number: NumberOrInteger) {
  return Number.isInteger(number) ? number + '.0' : number.toString()
}

Object.defineProperty(Point.prototype, POINT_IDENTIFIER_PROPERTY, {
  value: true,
  enumerable: false,
  configurable: false,
  writable: false
})

/**
 * Test if given object is an instance of {@link Point} class.
 * @param {Object} obj the object to test.
 * @return {boolean} `true` if given object is a {@link Point}, `false` otherwise.
 */
export function isPoint(obj?: any): obj is Point {
  return (obj && obj[POINT_IDENTIFIER_PROPERTY]) === true
}

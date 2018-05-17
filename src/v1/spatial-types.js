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

const POINT_IDENTIFIER_PROPERTY = '__isPoint__';

/**
 * Represents a single two or three-dimensional point in a particular coordinate reference system.
 * Created <code>Point</code> objects are frozen with {@link Object#freeze()} in constructor and thus immutable.
 */
export class Point {

  /**
   * @constructor
   * @param {Integer|number} srid the coordinate reference system identifier.
   * @param {number} x the <code>x</code> coordinate of the point.
   * @param {number} y the <code>y</code> coordinate of the point.
   * @param {number} [z=undefined] the <code>y</code> coordinate of the point or <code>undefined</code> if point has 2 dimensions.
   */
  constructor(srid, x, y, z) {
    this.srid = srid;
    this.x = x;
    this.y = y;
    this.z = z;
    Object.freeze(this);
  }

  toString() {
    return this.z || this.z === 0
      ? `Point{srid=${formatAsFloat(this.srid)}, x=${formatAsFloat(this.x)}, y=${formatAsFloat(this.y)}, z=${formatAsFloat(this.z)}}`
      : `Point{srid=${formatAsFloat(this.srid)}, x=${formatAsFloat(this.x)}, y=${formatAsFloat(this.y)}}`;
  }
}

function formatAsFloat(number) {
  return Number.isInteger(number) ? number + '.0' : number.toString();
}

Object.defineProperty(Point.prototype, POINT_IDENTIFIER_PROPERTY, {
  value: true,
  enumerable: false,
  configurable: false
});

/**
 * Test if given object is an instance of {@link Point} class.
 * @param {object} obj the object to test.
 * @return {boolean} <code>true</code> if given object is a {@link Point}, <code>false</code> otherwise.
 */
export function isPoint(obj) {
  return (obj && obj[POINT_IDENTIFIER_PROPERTY]) === true;
}

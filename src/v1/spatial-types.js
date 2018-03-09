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

import {int} from './integer';

const POINT_2D_IDENTIFIER_PROPERTY = '__isPoint2D__';
const POINT_3D_IDENTIFIER_PROPERTY = '__isPoint3D__';

/**
 * Represents a single two-dimensional point in a particular coordinate reference system.
 */
export class Point2D {

  /**
   * @constructor
   * @param {number|Integer} srid the coordinate reference system identifier.
   * @param {number} x the <code>x</code> coordinate of the point.
   * @param {number} y the <code>y</code> coordinate of the point.
   */
  constructor(srid, x, y) {
    this.srid = int(srid);
    this.x = x;
    this.y = y;
  }
}

Object.defineProperty(Point2D.prototype, POINT_2D_IDENTIFIER_PROPERTY, {
  value: true,
  enumerable: false,
  configurable: false
});

/**
 * Represents a single tree-dimensional point in a particular coordinate reference system.
 */
export class Point3D {

  /**
   * @constructor
   * @param {number|Integer} srid the coordinate reference system identifier.
   * @param {number} x the <code>x</code> coordinate of the point.
   * @param {number} y the <code>y</code> coordinate of the point.
   * @param {number} z the <code>z</code> coordinate of the point.
   */
  constructor(srid, x, y, z) {
    this.srid = int(srid);
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

Object.defineProperty(Point3D.prototype, POINT_3D_IDENTIFIER_PROPERTY, {
  value: true,
  enumerable: false,
  configurable: false
});

/**
 * Test if given object is an instance of {@link Point2D} class.
 * @param {object} obj the object to test.
 * @return {boolean} <code>true</code> if given object is a {@link Point2D}, <code>false</code> otherwise.
 */
export function isPoint2D(obj) {
  return hasProperty(obj, POINT_2D_IDENTIFIER_PROPERTY);
}

/**
 * Test if given object is an instance of {@link Point3D} class.
 * @param {object} obj the object to test.
 * @return {boolean} <code>true</code> if given object is a {@link Point3D}, <code>false</code> otherwise.
 */
export function isPoint3D(obj) {
  return hasProperty(obj, POINT_3D_IDENTIFIER_PROPERTY);
}

function hasProperty(obj, name) {
  return (obj && obj[name]) === true;
}

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

import Integer, { int } from '../src/integer'
import { isPoint, Point } from '../src/spatial-types'

const WGS_84_2D_CRS_CODE: Integer = int(4326)
const CARTESIAN_2D_CRS_CODE: Integer = int(7203)

const WGS_84_3D_CRS_CODE: Integer = int(4979)
const CARTESIAN_3D_CRS_CODE: Integer = int(9157)

describe('Point', () => {
  test.each([
    WGS_84_2D_CRS_CODE,
    CARTESIAN_2D_CRS_CODE,
    WGS_84_3D_CRS_CODE,
    CARTESIAN_3D_CRS_CODE,
    WGS_84_2D_CRS_CODE.toNumber(),
    CARTESIAN_2D_CRS_CODE.toNumber(),
    WGS_84_3D_CRS_CODE.toNumber(),
    CARTESIAN_3D_CRS_CODE.toNumber()
  ])('should expose frozen immutable point (srid=%s)', srid => {
    const point = new Point(srid, 1.2, 3.4)

    expect(Object.isFrozen(point)).toBeTruthy()

    expect(point.srid).toEqual(srid)
    expect(point.x).toEqual(1.2)
    expect(point.y).toEqual(3.4)
    expect(point.z).toBeUndefined()

    const anyPoint: any = point

    expect(() => {
      anyPoint.x = 5.6
    }).toThrow()
    expect(() => {
      anyPoint.y = 5.6
    }).toThrow()
    expect(() => {
      anyPoint.z = 5.6
    }).toThrow()

    expect(anyPoint.x).toEqual(1.2)
    expect(anyPoint.y).toEqual(3.4)
    expect(anyPoint.z).toBeUndefined()
  })

  test.each([
    [
      new Point(CARTESIAN_3D_CRS_CODE, 19.24, 100.29, 20.22222),
      'Point{srid=9157, x=19.24, y=100.29, z=20.22222}'
    ],
    [
      new Point(WGS_84_2D_CRS_CODE, 1.00005, 2.00006),
      'Point{srid=4326, x=1.00005, y=2.00006}'
    ],
    [
      new Point(WGS_84_3D_CRS_CODE, 1.111, 2.222, 0.0),
      'Point{srid=4979, x=1.111, y=2.222, z=0.0}'
    ],
    [
      new Point(WGS_84_2D_CRS_CODE, 123.9, 64.5, undefined),
      'Point{srid=4326, x=123.9, y=64.5}'
    ],
    [
      new Point(CARTESIAN_2D_CRS_CODE, 23.9378123, 67.3891, Number.NaN),
      'Point{srid=7203, x=23.9378123, y=67.3891}'
    ]
  ])('%s.toString() toEqual %s', (point, expectedString) => {
    expect(point.toString()).toEqual(expectedString)
  })
})

describe('isPoint', () => {
  test.each([
    new Point(CARTESIAN_3D_CRS_CODE, 19.24, 100.29, 20.22222),
    new Point(CARTESIAN_3D_CRS_CODE, 19.24, 100.29),
    new Point(0, 19.24, 100.29, 20.22222)
  ])('isPoint(%s) should be truthy', point =>
    expect(isPoint(point)).toBeTruthy()
  )

  test.each([
    { srid: CARTESIAN_3D_CRS_CODE, x: 18.24, y: 13.8, z: 124 },
    { srid: 0, x: 18.24, y: 13.8 },
    ['srid', CARTESIAN_3D_CRS_CODE, 'x', 18.24, 'y', 12.8, 'z', 124],
    'Point(1, 2, 3, 4)'
  ])('isPoint(%s) should be falsy', point => expect(isPoint(point)).toBeFalsy())
})

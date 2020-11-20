/**
 * Copyright (c) 2002-2020 "Neo4j,"
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

import neo4j, { int } from '../src'
import sharedNeo4j from './internal/shared-neo4j'
import { isPoint, Point } from '../src/spatial-types'
import _ from 'lodash'

const WGS_84_2D_CRS_CODE = neo4j.int(4326)
const CARTESIAN_2D_CRS_CODE = neo4j.int(7203)

const WGS_84_3D_CRS_CODE = neo4j.int(4979)
const CARTESIAN_3D_CRS_CODE = neo4j.int(9157)

describe('#integration spatial-types', () => {
  let driver
  let driverWithNativeNumbers
  let session
  let protocolVersion

  beforeAll(() => {
    driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken)
    driverWithNativeNumbers = neo4j.driver(
      'bolt://localhost',
      sharedNeo4j.authToken,
      { disableLosslessIntegers: true }
    )
  })

  afterAll(async () => {
    if (driver) {
      await driver.close()
      driver = null
    }

    if (driverWithNativeNumbers) {
      await driverWithNativeNumbers.close()
      driverWithNativeNumbers = null
    }
  })

  beforeEach(async () => {
    session = driver.session()
    protocolVersion = await sharedNeo4j.cleanupAndGetProtocolVersion(driver)
  })

  afterEach(async () => {
    if (session) {
      await session.close()
      session = null
    }
  })

  it('should expose frozen immutable points', () => {
    const point = new Point(CARTESIAN_2D_CRS_CODE, 1.2, 3.4)

    expect(Object.isFrozen(point)).toBeTruthy()

    expect(point.srid).toEqual(CARTESIAN_2D_CRS_CODE)
    expect(point.x).toEqual(1.2)
    expect(point.y).toEqual(3.4)
    expect(point.z).toBeUndefined()

    try {
      point.x = 5.6
    } catch (e) {}
    try {
      point.y = 7.8
    } catch (e) {}
    try {
      point.z = 9.0
    } catch (e) {}

    expect(point.x).toEqual(1.2)
    expect(point.y).toEqual(3.4)
    expect(point.z).toBeUndefined()
  })

  it('should receive 2D points', done => {
    testReceivingOfPoints(
      done,
      'RETURN point({x: 169.99, y: 12.1718})',
      point => {
        expect(isPoint(point)).toBeTruthy()
        expect(point.srid).toEqual(CARTESIAN_2D_CRS_CODE)
        expect(point.x).toEqual(169.99)
        expect(point.y).toEqual(12.1718)
        expect(point.z).toBeUndefined()
      }
    )
  })

  it('should receive 2D points with crs', done => {
    testReceivingOfPoints(
      done,
      "RETURN point({x: 2.3, y: 4.5, crs: 'WGS-84'})",
      point => {
        expect(isPoint(point)).toBeTruthy()
        expect(point.srid).toEqual(WGS_84_2D_CRS_CODE)
        expect(point.x).toEqual(2.3)
        expect(point.y).toEqual(4.5)
        expect(point.z).toBeUndefined()
      }
    )
  })

  it('should receive 3D points', done => {
    testReceivingOfPoints(
      done,
      'RETURN point({x: -19.9, y: 45.99, z: 8.88})',
      point => {
        expect(isPoint(point)).toBeTruthy()
        expect(point.srid).toEqual(CARTESIAN_3D_CRS_CODE)
        expect(point.x).toEqual(-19.9)
        expect(point.y).toEqual(45.99)
        expect(point.z).toEqual(8.88)
      }
    )
  })

  it('should receive 3D points with crs', done => {
    testReceivingOfPoints(
      done,
      "RETURN point({x: 34.76, y: 11.9, z: -99.01, crs: 'WGS-84-3D'})",
      point => {
        expect(isPoint(point)).toBeTruthy()
        expect(point.srid).toEqual(WGS_84_3D_CRS_CODE)
        expect(point.x).toEqual(34.76)
        expect(point.y).toEqual(11.9)
        expect(point.z).toEqual(-99.01)
      }
    )
  })

  it('should send and receive 2D point', done => {
    testSendingAndReceivingOfPoints(
      done,
      new Point(CARTESIAN_2D_CRS_CODE, 19.101, -88.21)
    )
  })

  it('should send and receive 3D point', done => {
    testSendingAndReceivingOfPoints(
      done,
      new Point(WGS_84_3D_CRS_CODE, 1.22, 9.8, -6.65)
    )
  })

  it('should send and receive array of 2D points', done => {
    const arrayOfPoints = [
      new Point(WGS_84_2D_CRS_CODE, 12.3, 11.2),
      new Point(WGS_84_2D_CRS_CODE, 2.45, 81.302),
      new Point(WGS_84_2D_CRS_CODE, 0.12, -89.9),
      new Point(WGS_84_2D_CRS_CODE, 93.75, 23.213),
      new Point(WGS_84_2D_CRS_CODE, 111.13, -70.1),
      new Point(WGS_84_2D_CRS_CODE, 43.99, -1)
    ]

    testSendingAndReceivingOfPoints(done, arrayOfPoints)
  })

  it('should send and receive array of 3D points', done => {
    const arrayOfPoints = [
      new Point(CARTESIAN_3D_CRS_CODE, 83.38, 123.9, -19),
      new Point(CARTESIAN_3D_CRS_CODE, 31, 39.1, -19.19),
      new Point(CARTESIAN_3D_CRS_CODE, 0.845, -0.74, 3.48),
      new Point(CARTESIAN_3D_CRS_CODE, 123.33, 93.3, 96.96),
      new Point(CARTESIAN_3D_CRS_CODE, -54.9, 13.7893, -90.9)
    ]

    testSendingAndReceivingOfPoints(done, arrayOfPoints)
  })

  it('should receive point with number srid when disableLosslessIntegers=true', done => {
    session = driverWithNativeNumbers.session()

    testReceivingOfPoints(
      done,
      'RETURN point({x: 42.231, y: 176.938123})',
      point => {
        expect(isPoint(point)).toBeTruthy()
        expect(_.isNumber(point.srid)).toBeTruthy()
        expect(point.srid).toEqual(CARTESIAN_2D_CRS_CODE.toNumber())
      }
    )
  })

  it('should send and receive point with number srid when disableLosslessIntegers=true', done => {
    session = driverWithNativeNumbers.session()

    testSendingAndReceivingOfPoints(
      done,
      new Point(CARTESIAN_3D_CRS_CODE.toNumber(), 12.87, 13.89, 14.901)
    )
  })

  it('should convert points to string', () => {
    const point1 = new Point(CARTESIAN_3D_CRS_CODE, 19.24, 100.29, 20.22222)
    expect(point1.toString()).toEqual(
      'Point{srid=9157, x=19.24, y=100.29, z=20.22222}'
    )

    const point2 = new Point(WGS_84_2D_CRS_CODE, 1.00005, 2.00006)
    expect(point2.toString()).toEqual('Point{srid=4326, x=1.00005, y=2.00006}')

    const point3 = new Point(WGS_84_3D_CRS_CODE, 1.111, 2.222, 0.0)
    expect(point3.toString()).toEqual(
      'Point{srid=4979, x=1.111, y=2.222, z=0.0}'
    )

    const point4 = new Point(CARTESIAN_2D_CRS_CODE, 78.15, 92.2, null)
    expect(point4.toString()).toEqual('Point{srid=7203, x=78.15, y=92.2}')

    const point5 = new Point(WGS_84_2D_CRS_CODE, 123.9, 64.5, undefined)
    expect(point5.toString()).toEqual('Point{srid=4326, x=123.9, y=64.5}')

    const point6 = new Point(
      CARTESIAN_2D_CRS_CODE,
      23.9378123,
      67.3891,
      Number.NaN
    )
    expect(point6.toString()).toEqual(
      'Point{srid=7203, x=23.9378123, y=67.3891}'
    )
  })

  it('should validate types of constructor arguments for Point', () => {
    expect(() => new Point('1', 2, 3)).toThrowError(TypeError)
    expect(() => new Point(1, '2', 3)).toThrowError(TypeError)
    expect(() => new Point(1, 2, '3')).toThrowError(TypeError)
    expect(() => new Point(1, 2, '3')).toThrowError(TypeError)

    expect(() => new Point('1', 2, 3, null)).toThrowError(TypeError)
    expect(() => new Point(1, '2', 3, null)).toThrowError(TypeError)
    expect(() => new Point(1, 2, '3', null)).toThrowError(TypeError)
    expect(() => new Point(1, 2, '3', null)).toThrowError(TypeError)

    expect(() => new Point('1', 2, 3, 4)).toThrowError(TypeError)
    expect(() => new Point(1, '2', 3, 4)).toThrowError(TypeError)
    expect(() => new Point(1, 2, '3', 4)).toThrowError(TypeError)
    expect(() => new Point(1, 2, '3', 4)).toThrowError(TypeError)

    expect(() => new Point(1, int(2), 3, 4)).toThrowError(TypeError)
    expect(() => new Point(1, 2, int(3), 4)).toThrowError(TypeError)
    expect(() => new Point(1, 2, 3, int(4))).toThrowError(TypeError)

    expect(new Point(1, 2, 3, 4)).toBeDefined()

    expect(new Point(int(1), 2, 3, undefined)).toBeDefined()
    expect(new Point(1, 2, 3, undefined)).toBeDefined()

    expect(new Point(1, 2, 3, null)).toBeDefined()
    expect(new Point(int(1), 2, 3, null)).toBeDefined()
  })

  function testReceivingOfPoints (done, query, pointChecker) {
    if (neo4jDoesNotSupportPoints(done)) {
      return
    }

    session
      .run(query)
      .then(result => {
        const records = result.records
        expect(records.length).toEqual(1)

        const point = records[0].get(0)
        pointChecker(point)
      })
      .then(() => session.close())
      .then(() => done())
  }

  function testSendingAndReceivingOfPoints (done, originalValue) {
    if (neo4jDoesNotSupportPoints(done)) {
      return
    }

    session
      .run('CREATE (n: Node {value: $value}) RETURN n.value', {
        value: originalValue
      })
      .then(result => {
        const records = result.records
        expect(records.length).toEqual(1)

        const receivedPoint = records[0].get(0)
        expect(receivedPoint).toEqual(originalValue)
      })
      .then(() => session.close())
      .then(() => done())
  }

  function neo4jDoesNotSupportPoints (done) {
    if (protocolVersion < 2) {
      done()
      return true
    }
    return false
  }
})

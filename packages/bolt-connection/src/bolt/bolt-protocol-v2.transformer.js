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

import {
  isPoint,
  int,
  isDuration,
  Duration,
  isLocalDateTime,
  isLocalTime,
  internal,
  isTime,
  Time,
  isDate,
  isDateTime,
  DateTime,
  Point,
  isInt
} from 'neo4j-driver-core'

import { structure } from '../packstream'
import { TypeTransformer } from './transformer'

import {
  epochDayToDate,
  nanoOfDayToLocalTime,
  epochSecondAndNanoToLocalDateTime
} from './temporal-factory'

import v1 from './bolt-protocol-v1.transformer'

const {
  temporalUtil: {
    dateToEpochDay,
    localDateTimeToEpochSecond,
    localTimeToNanoOfDay
  }
} = internal

const POINT_2D = 0x58
const POINT_2D_STRUCT_SIZE = 3

const POINT_3D = 0x59
const POINT_3D_STRUCT_SIZE = 4

const DURATION = 0x45
const DURATION_STRUCT_SIZE = 4

const LOCAL_TIME = 0x74
const LOCAL_TIME_STRUCT_SIZE = 1

const TIME = 0x54
const TIME_STRUCT_SIZE = 2

const DATE = 0x44
const DATE_STRUCT_SIZE = 1

const LOCAL_DATE_TIME = 0x64
const LOCAL_DATE_TIME_STRUCT_SIZE = 2

const DATE_TIME_WITH_ZONE_OFFSET = 0x46
const DATE_TIME_WITH_ZONE_OFFSET_STRUCT_SIZE = 3

const DATE_TIME_WITH_ZONE_ID = 0x66
const DATE_TIME_WITH_ZONE_ID_STRUCT_SIZE = 3

/**
 * Creates the Point2D Transformer
 * @returns {TypeTransformer}
 */
function createPoint2DTransformer () {
  return new TypeTransformer({
    signature: POINT_2D,
    isTypeInstance: point => isPoint(point) && (point.z === null || point.z === undefined),
    toStructure: point => new structure.Structure(POINT_2D, [
      int(point.srid),
      point.x,
      point.y
    ]),
    fromStructure: struct => {
      structure.verifyStructSize('Point2D', POINT_2D_STRUCT_SIZE, struct.size)

      const [srid, x, y] = struct.fields
      return new Point(
        srid,
        x,
        y,
        undefined // z
      )
    }
  })
}

/**
 * Creates the Point3D Transformer
 * @returns {TypeTransformer}
 */
function createPoint3DTransformer () {
  return new TypeTransformer({
    signature: POINT_3D,
    isTypeInstance: point => isPoint(point) && point.z !== null && point.z !== undefined,
    toStructure: point => new structure.Structure(POINT_3D, [
      int(point.srid),
      point.x,
      point.y,
      point.z
    ]),
    fromStructure: struct => {
      structure.verifyStructSize('Point3D', POINT_3D_STRUCT_SIZE, struct.size)

      const [srid, x, y, z] = struct.fields
      return new Point(
        srid,
        x,
        y,
        z
      )
    }
  })
}

/**
 * Creates the Duration Transformer
 * @returns {TypeTransformer}
 */
function createDurationTransformer () {
  return new TypeTransformer({
    signature: DURATION,
    isTypeInstance: isDuration,
    toStructure: value => {
      const months = int(value.months)
      const days = int(value.days)
      const seconds = int(value.seconds)
      const nanoseconds = int(value.nanoseconds)

      return new structure.Structure(DURATION, [months, days, seconds, nanoseconds])
    },
    fromStructure: struct => {
      structure.verifyStructSize('Duration', DURATION_STRUCT_SIZE, struct.size)

      const [months, days, seconds, nanoseconds] = struct.fields

      return new Duration(months, days, seconds, nanoseconds)
    }
  })
}

/**
 * Creates the LocalTime Transformer
 * @param {Object} param
 * @param {boolean} param.disableLosslessIntegers Disables lossless integers
 * @param {boolean} param.useBigInt Uses BigInt instead of number or Integer
 * @returns {TypeTransformer}
 */
function createLocalTimeTransformer ({ disableLosslessIntegers, useBigInt }) {
  return new TypeTransformer({
    signature: LOCAL_TIME,
    isTypeInstance: isLocalTime,
    toStructure: value => {
      const nanoOfDay = localTimeToNanoOfDay(
        value.hour,
        value.minute,
        value.second,
        value.nanosecond
      )

      return new structure.Structure(LOCAL_TIME, [nanoOfDay])
    },
    fromStructure: struct => {
      structure.verifyStructSize('LocalTime', LOCAL_TIME_STRUCT_SIZE, struct.size)

      const [nanoOfDay] = struct.fields
      const result = nanoOfDayToLocalTime(nanoOfDay)
      return convertIntegerPropsIfNeeded(result, disableLosslessIntegers, useBigInt)
    }
  })
}

/**
 * Creates the Time Transformer
 * @param {Object} param
 * @param {boolean} param.disableLosslessIntegers Disables lossless integers
 * @param {boolean} param.useBigInt Uses BigInt instead of number or Integer
 * @returns {TypeTransformer}
 */
function createTimeTransformer ({ disableLosslessIntegers, useBigInt }) {
  return new TypeTransformer({
    signature: TIME,
    isTypeInstance: isTime,
    toStructure: value => {
      const nanoOfDay = localTimeToNanoOfDay(
        value.hour,
        value.minute,
        value.second,
        value.nanosecond
      )
      const offsetSeconds = int(value.timeZoneOffsetSeconds)

      return new structure.Structure(TIME, [nanoOfDay, offsetSeconds])
    },
    fromStructure: struct => {
      structure.verifyStructSize('Time', TIME_STRUCT_SIZE, struct.size)

      const [nanoOfDay, offsetSeconds] = struct.fields
      const localTime = nanoOfDayToLocalTime(nanoOfDay)
      const result = new Time(
        localTime.hour,
        localTime.minute,
        localTime.second,
        localTime.nanosecond,
        offsetSeconds
      )
      return convertIntegerPropsIfNeeded(result, disableLosslessIntegers, useBigInt)
    }
  })
}

/**
 * Creates the Date Transformer
 * @param {Object} param
 * @param {boolean} param.disableLosslessIntegers Disables lossless integers
 * @param {boolean} param.useBigInt Uses BigInt instead of number or Integer
 * @returns {TypeTransformer}
 */
function createDateTransformer ({ disableLosslessIntegers, useBigInt }) {
  return new TypeTransformer({
    signature: DATE,
    isTypeInstance: isDate,
    toStructure: value => {
      const epochDay = dateToEpochDay(value.year, value.month, value.day)

      return new structure.Structure(DATE, [epochDay])
    },
    fromStructure: struct => {
      structure.verifyStructSize('Date', DATE_STRUCT_SIZE, struct.size)

      const [epochDay] = struct.fields
      const result = epochDayToDate(epochDay)
      return convertIntegerPropsIfNeeded(result, disableLosslessIntegers, useBigInt)
    }
  })
}

/**
 * Creates the LocalDateTime Transformer
 * @param {Object} param
 * @param {boolean} param.disableLosslessIntegers Disables lossless integers
 * @param {boolean} param.useBigInt Uses BigInt instead of number or Integer
 * @returns {TypeTransformer}
 */
function createLocalDateTimeTransformer ({ disableLosslessIntegers, useBigInt }) {
  return new TypeTransformer({
    signature: LOCAL_DATE_TIME,
    isTypeInstance: isLocalDateTime,
    toStructure: value => {
      const epochSecond = localDateTimeToEpochSecond(
        value.year,
        value.month,
        value.day,
        value.hour,
        value.minute,
        value.second,
        value.nanosecond
      )
      const nano = int(value.nanosecond)

      return new structure.Structure(LOCAL_DATE_TIME, [epochSecond, nano])
    },
    fromStructure: struct => {
      structure.verifyStructSize(
        'LocalDateTime',
        LOCAL_DATE_TIME_STRUCT_SIZE,
        struct.size
      )

      const [epochSecond, nano] = struct.fields
      const result = epochSecondAndNanoToLocalDateTime(epochSecond, nano)
      return convertIntegerPropsIfNeeded(result, disableLosslessIntegers, useBigInt)
    }
  })
}

/**
 * Creates the DateTime with ZoneId Transformer
 * @param {Object} param
 * @param {boolean} param.disableLosslessIntegers Disables lossless integers
 * @param {boolean} param.useBigInt Uses BigInt instead of number or Integer
 * @returns {TypeTransformer}
 */
function createDateTimeWithZoneIdTransformer ({ disableLosslessIntegers, useBigInt }) {
  return new TypeTransformer({
    signature: DATE_TIME_WITH_ZONE_ID,
    isTypeInstance: object => isDateTime(object) && object.timeZoneId != null,
    toStructure: value => {
      const epochSecond = localDateTimeToEpochSecond(
        value.year,
        value.month,
        value.day,
        value.hour,
        value.minute,
        value.second,
        value.nanosecond
      )
      const nano = int(value.nanosecond)
      const timeZoneId = value.timeZoneId

      return new structure.Structure(DATE_TIME_WITH_ZONE_ID, [epochSecond, nano, timeZoneId])
    },
    fromStructure: struct => {
      structure.verifyStructSize(
        'DateTimeWithZoneId',
        DATE_TIME_WITH_ZONE_ID_STRUCT_SIZE,
        struct.size
      )

      const [epochSecond, nano, timeZoneId] = struct.fields

      const localDateTime = epochSecondAndNanoToLocalDateTime(epochSecond, nano)
      const result = new DateTime(
        localDateTime.year,
        localDateTime.month,
        localDateTime.day,
        localDateTime.hour,
        localDateTime.minute,
        localDateTime.second,
        localDateTime.nanosecond,
        null,
        timeZoneId
      )
      return convertIntegerPropsIfNeeded(result, disableLosslessIntegers, useBigInt)
    }
  })
}

/**
 * Creates the DateTime with Offset Transformer
 * @param {Object} param
 * @param {boolean} param.disableLosslessIntegers Disables lossless integers
 * @param {boolean} param.useBigInt Uses BigInt instead of number or Integer
 * @returns {TypeTransformer}
 */
function createDateTimeWithOffsetTransformer ({ disableLosslessIntegers, useBigInt }) {
  return new TypeTransformer({
    signature: DATE_TIME_WITH_ZONE_OFFSET,
    isTypeInstance: object => isDateTime(object) && object.timeZoneId == null,
    toStructure: value => {
      const epochSecond = localDateTimeToEpochSecond(
        value.year,
        value.month,
        value.day,
        value.hour,
        value.minute,
        value.second,
        value.nanosecond
      )
      const nano = int(value.nanosecond)
      const timeZoneOffsetSeconds = int(value.timeZoneOffsetSeconds)
      return new structure.Structure(DATE_TIME_WITH_ZONE_OFFSET, [epochSecond, nano, timeZoneOffsetSeconds])
    },
    fromStructure: struct => {
      structure.verifyStructSize(
        'DateTimeWithZoneOffset',
        DATE_TIME_WITH_ZONE_OFFSET_STRUCT_SIZE,
        struct.size
      )

      const [epochSecond, nano, timeZoneOffsetSeconds] = struct.fields

      const localDateTime = epochSecondAndNanoToLocalDateTime(epochSecond, nano)
      const result = new DateTime(
        localDateTime.year,
        localDateTime.month,
        localDateTime.day,
        localDateTime.hour,
        localDateTime.minute,
        localDateTime.second,
        localDateTime.nanosecond,
        timeZoneOffsetSeconds,
        null
      )
      return convertIntegerPropsIfNeeded(result, disableLosslessIntegers, useBigInt)
    }
  })
}

function convertIntegerPropsIfNeeded (obj, disableLosslessIntegers, useBigInt) {
  if (!disableLosslessIntegers && !useBigInt) {
    return obj
  }

  const convert = value =>
    useBigInt ? value.toBigInt() : value.toNumberOrInfinity()

  const clone = Object.create(Object.getPrototypeOf(obj))
  for (const prop in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, prop) === true) {
      const value = obj[prop]
      clone[prop] = isInt(value) ? convert(value) : value
    }
  }
  Object.freeze(clone)
  return clone
}

export default {
  ...v1,
  createPoint2DTransformer,
  createPoint3DTransformer,
  createDurationTransformer,
  createLocalTimeTransformer,
  createTimeTransformer,
  createDateTransformer,
  createLocalDateTimeTransformer,
  createDateTimeWithZoneIdTransformer,
  createDateTimeWithOffsetTransformer
}

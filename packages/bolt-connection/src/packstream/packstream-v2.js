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

import * as v1 from './packstream-v1'
import {
  int,
  isInt,
  isPoint,
  Point,
  DateTime,
  Duration,
  isDate,
  isDateTime,
  isDuration,
  isLocalDateTime,
  isLocalTime,
  isTime,
  Time,
  internal
} from 'neo4j-driver-core'

import {
  epochDayToDate,
  epochSecondAndNanoToLocalDateTime,
  nanoOfDayToLocalTime
} from './temporal-factory'

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

export class Packer extends v1.Packer {
  disableByteArrays () {
    throw new Error('Bolt V2 should always support byte arrays')
  }

  packable (obj, dehydrate = (x) => x) {
    return super.packable(obj, x => {
      if (isPoint(x)) {
        return packPoint(x)
      } else if (isDuration(x)) {
        return packDuration(x)
      } else if (isLocalTime(x)) {
        return packLocalTime(x)
      } else if (isTime(x)) {
        return packTime(x)
      } else if (isDate(x)) {
        return packDate(x)
      } else if (isLocalDateTime(x)) {
        return packLocalDateTime(x)
      } else if (isDateTime(x)) {
        return packDateTime(x)
      } else {
        return dehydrate(x)
      }
    })
  }
}

export class Unpacker extends v1.Unpacker {
  /**
   * @constructor
   * @param {boolean} disableLosslessIntegers if this unpacker should convert all received integers to native JS numbers.
   * @param {boolean} useBigInt if this unpacker should convert all received integers to Bigint
   */
  constructor (disableLosslessIntegers = false, useBigInt = false) {
    super(disableLosslessIntegers, useBigInt)
  }

  _hydrate (structure, onUnknowStructure = struct => struct) {
    const verifyStructSize = this._verifyStructSize.bind(this)
    return super._hydrate(structure, struct => {
      const signature = struct.signature
      if (signature === POINT_2D) {
        return unpackPoint2D(verifyStructSize, struct)
      } else if (signature === POINT_3D) {
        return unpackPoint3D(verifyStructSize, struct)
      } else if (signature === DURATION) {
        return unpackDuration(verifyStructSize, struct)
      } else if (signature === LOCAL_TIME) {
        return unpackLocalTime(verifyStructSize, struct, this._disableLosslessIntegers, this._useBigInt)
      } else if (signature === TIME) {
        return unpackTime(verifyStructSize, struct, this._disableLosslessIntegers, this._useBigInt)
      } else if (signature === DATE) {
        return unpackDate(verifyStructSize, struct, this._disableLosslessIntegers, this._useBigInt)
      } else if (signature === LOCAL_DATE_TIME) {
        return unpackLocalDateTime(verifyStructSize, struct, this._disableLosslessIntegers, this._useBigInt)
      } else if (signature === DATE_TIME_WITH_ZONE_OFFSET) {
        return unpackDateTimeWithZoneOffset(verifyStructSize, struct, this._disableLosslessIntegers, this._useBigInt)
      } else if (signature === DATE_TIME_WITH_ZONE_ID) {
        return unpackDateTimeWithZoneId(verifyStructSize, struct, this._disableLosslessIntegers, this._useBigInt)
      } else {
        return onUnknowStructure(struct)
      }
    })
  }
}

/**
 * Pack given 2D or 3D point.
 * @param {Point} point the point value to pack.
 * @param {Packer} packer the packer to use.
 */
function packPoint (point) {
  const is2DPoint = point.z === null || point.z === undefined
  if (is2DPoint) {
    packPoint2D(point)
  } else {
    packPoint3D(point)
  }
}

/**
 * Pack given 2D point.
 * @param {Point} point the point value to pack.
 * @param {Packer} packer the packer to use.
 */
function packPoint2D (point) {
  const fields = [
    int(point.srid),
    point.x,
    point.y
  ]
  return new v1.Structure(POINT_2D, fields)
}

/**
 * Pack given 3D point.
 * @param {Point} point the point value to pack.
 * @param {Packer} packer the packer to use.
 */
function packPoint3D (point) {
  const fields = [
    int(point.srid),
    point.x,
    point.y,
    point.z
  ]
  return new v1.Structure(POINT_3D, fields)
}

/**
 * Unpack 2D point value using the given unpacker.
 * @param {Unpacker} unpacker the unpacker to use.
 * @param {number} structSize the retrieved struct size.
 * @param {BaseBuffer} buffer the buffer to unpack from.
 * @return {Point} the unpacked 2D point value.
 */
function unpackPoint2D (verifyStructSize, struct) {
  verifyStructSize('Point2D', POINT_2D_STRUCT_SIZE, struct.size)

  const [srid, x, y] = struct.fields
  return new Point(
    srid,
    x,
    y,
    undefined // z
  )
}

/**
 * Unpack 3D point value using the given unpacker.
 * @param {Unpacker} unpacker the unpacker to use.
 * @param {number} structSize the retrieved struct size.
 * @param {BaseBuffer} buffer the buffer to unpack from.
 * @return {Point} the unpacked 3D point value.
 */
function unpackPoint3D (verifyStructSize, struct) {
  verifyStructSize('Point3D', POINT_3D_STRUCT_SIZE, struct.size)

  const [srid, x, y, z] = struct.fields

  return new Point(srid, x, y, z)
}

/**
 * Pack given duration.
 * @param {Duration} value the duration value to pack.
 * @param {Packer} packer the packer to use.
 */
function packDuration (value) {
  const months = int(value.months)
  const days = int(value.days)
  const seconds = int(value.seconds)
  const nanoseconds = int(value.nanoseconds)

  return new v1.Structure(DURATION, [months, days, seconds, nanoseconds])
}

/**
 * Unpack duration value using the given unpacker.
 * @param {Unpacker} unpacker the unpacker to use.
 * @param {number} structSize the retrieved struct size.
 * @param {BaseBuffer} buffer the buffer to unpack from.
 * @return {Duration} the unpacked duration value.
 */
function unpackDuration (verifyStructSize, struct) {
  verifyStructSize('Duration', DURATION_STRUCT_SIZE, struct.size)

  const [months, days, seconds, nanoseconds] = struct.fields

  return new Duration(months, days, seconds, nanoseconds)
}

/**
 * Pack given local time.
 * @param {LocalTime} value the local time value to pack.
 * @param {Packer} packer the packer to use.
 */
function packLocalTime (value, packer) {
  const nanoOfDay = localTimeToNanoOfDay(
    value.hour,
    value.minute,
    value.second,
    value.nanosecond
  )

  return new v1.Structure(LOCAL_TIME, [nanoOfDay])
}

/**
 * Unpack local time value using the given unpacker.
 * @param {Unpacker} unpacker the unpacker to use.
 * @param {number} structSize the retrieved struct size.
 * @param {BaseBuffer} buffer the buffer to unpack from.
 * @param {boolean} disableLosslessIntegers if integer properties in the result local time should be native JS numbers.
 * @return {LocalTime} the unpacked local time value.
 */
function unpackLocalTime (verifyStructSize, struct, disableLosslessIntegers, useBigInt) {
  verifyStructSize('LocalTime', LOCAL_TIME_STRUCT_SIZE, struct.size)

  const [nanoOfDay] = struct.fields
  const result = nanoOfDayToLocalTime(nanoOfDay)
  return convertIntegerPropsIfNeeded(result, disableLosslessIntegers, useBigInt) // check disable lossless
}

/**
 * Pack given time.
 * @param {Time} value the time value to pack.
 * @param {Packer} packer the packer to use.
 */
function packTime (value) {
  const nanoOfDay = localTimeToNanoOfDay(
    value.hour,
    value.minute,
    value.second,
    value.nanosecond
  )
  const offsetSeconds = int(value.timeZoneOffsetSeconds)

  return new v1.Structure(TIME, [nanoOfDay, offsetSeconds])
}

/**
 * Unpack time value using the given unpacker.
 * @param {Unpacker} unpacker the unpacker to use.
 * @param {number} structSize the retrieved struct size.
 * @param {BaseBuffer} buffer the buffer to unpack from.
 * @param {boolean} disableLosslessIntegers if integer properties in the result time should be native JS numbers.
 * @return {Time} the unpacked time value.
 */
function unpackTime (
  verifyStructSize,
  struct,
  disableLosslessIntegers,
  useBigInt
) {
  verifyStructSize('Time', TIME_STRUCT_SIZE, struct.size)

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

/**
 * Pack given neo4j date.
 * @param {Date} value the date value to pack.
 * @param {Packer} packer the packer to use.
 */
function packDate (value) {
  const epochDay = dateToEpochDay(value.year, value.month, value.day)

  return new v1.Structure(DATE, [epochDay])
}

/**
 * Unpack neo4j date value using the given unpacker.
 * @param {Unpacker} unpacker the unpacker to use.
 * @param {number} structSize the retrieved struct size.
 * @param {BaseBuffer} buffer the buffer to unpack from.
 * @param {boolean} disableLosslessIntegers if integer properties in the result date should be native JS numbers.
 * @return {Date} the unpacked neo4j date value.
 */
function unpackDate (
  verifyStructSize,
  struct,
  disableLosslessIntegers,
  useBigInt
) {
  verifyStructSize('Date', DATE_STRUCT_SIZE, struct.size)

  const [epochDay] = struct.fields
  const result = epochDayToDate(epochDay)
  return convertIntegerPropsIfNeeded(result, disableLosslessIntegers, useBigInt)
}

/**
 * Pack given local date time.
 * @param {LocalDateTime} value the local date time value to pack.
 * @param {Packer} packer the packer to use.
 */
function packLocalDateTime (value) {
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

  return new v1.Structure(LOCAL_DATE_TIME, [epochSecond, nano])
}

/**
 * Unpack local date time value using the given unpacker.
 * @param {Unpacker} unpacker the unpacker to use.
 * @param {number} structSize the retrieved struct size.
 * @param {BaseBuffer} buffer the buffer to unpack from.
 * @param {boolean} disableLosslessIntegers if integer properties in the result local date-time should be native JS numbers.
 * @return {LocalDateTime} the unpacked local date time value.
 */
function unpackLocalDateTime (
  verifyStructSize,
  struct,
  disableLosslessIntegers,
  useBigInt
) {
  verifyStructSize(
    'LocalDateTime',
    LOCAL_DATE_TIME_STRUCT_SIZE,
    struct.size
  )

  const [epochSecond, nano] = struct.fields
  const result = epochSecondAndNanoToLocalDateTime(epochSecond, nano)
  return convertIntegerPropsIfNeeded(result, disableLosslessIntegers, useBigInt)
}

/**
 * Pack given date time.
 * @param {DateTime} value the date time value to pack.
 * @param {Packer} packer the packer to use.
 */
function packDateTime (value) {
  if (value.timeZoneId) {
    packDateTimeWithZoneId(value)
  } else {
    packDateTimeWithZoneOffset(value)
  }
}

/**
 * Pack given date time with zone offset.
 * @param {DateTime} value the date time value to pack.
 * @param {Packer} packer the packer to use.
 */
function packDateTimeWithZoneOffset (value) {
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
  return new v1.Structure(DATE_TIME_WITH_ZONE_OFFSET, [epochSecond, nano, timeZoneOffsetSeconds])
}

/**
 * Unpack date time with zone offset value using the given unpacker.
 * @param {Unpacker} unpacker the unpacker to use.
 * @param {number} structSize the retrieved struct size.
 * @param {BaseBuffer} buffer the buffer to unpack from.
 * @param {boolean} disableLosslessIntegers if integer properties in the result date-time should be native JS numbers.
 * @return {DateTime} the unpacked date time with zone offset value.
 */
function unpackDateTimeWithZoneOffset (
  verifyStructSize,
  struct,
  disableLosslessIntegers,
  useBigInt
) {
  verifyStructSize(
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

/**
 * Pack given date time with zone id.
 * @param {DateTime} value the date time value to pack.
 * @param {Packer} packer the packer to use.
 */
function packDateTimeWithZoneId (value) {
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

  return new v1.Structure(DATE_TIME_WITH_ZONE_ID, [epochSecond, nano, timeZoneId])
}

/**
 * Unpack date time with zone id value using the given unpacker.
 * @param {Unpacker} unpacker the unpacker to use.
 * @param {number} structSize the retrieved struct size.
 * @param {BaseBuffer} buffer the buffer to unpack from.
 * @param {boolean} disableLosslessIntegers if integer properties in the result date-time should be native JS numbers.
 * @return {DateTime} the unpacked date time with zone id value.
 */
function unpackDateTimeWithZoneId (
  verifyStructSize,
  struct,
  disableLosslessIntegers,
  useBigInt
) {
  verifyStructSize(
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

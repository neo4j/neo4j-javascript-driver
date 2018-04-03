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

import * as v1 from './packstream-v1';
import {isPoint, Point} from '../spatial-types';
import {
  Date,
  DateTimeWithZoneId,
  DateTimeWithZoneOffset,
  Duration,
  Time,
  isDate,
  isDateTimeWithZoneId,
  isDateTimeWithZoneOffset,
  isDuration,
  isLocalDateTime,
  isLocalTime,
  isTime
} from '../temporal-types';
import {int} from '../integer';
import {
  dateToEpochDay,
  localDateTimeToEpochSecond,
  localTimeToNanoOfDay,
  epochDayToDate,
  epochSecondAndNanoToLocalDateTime,
  nanoOfDayToLocalTime
} from '../internal/temporal-util';

const POINT_2D = 0x58;
const POINT_2D_STRUCT_SIZE = 3;

const POINT_3D = 0x59;
const POINT_3D_STRUCT_SIZE = 4;

const DURATION = 0x45;
const DURATION_STRUCT_SIZE = 4;

const LOCAL_TIME = 0x74;
const LOCAL_TIME_STRUCT_SIZE = 1;

const TIME = 0x54;
const TIME_STRUCT_SIZE = 2;

const DATE = 0x44;
const DATE_STRUCT_SIZE = 1;

const LOCAL_DATE_TIME = 0x64;
const LOCAL_DATE_TIME_STRUCT_SIZE = 2;

const DATE_TIME_WITH_ZONE_OFFSET = 0x46;
const DATE_TIME_WITH_ZONE_OFFSET_STRUCT_SIZE = 3;

const DATE_TIME_WITH_ZONE_ID = 0x66;
const DATE_TIME_WITH_ZONE_ID_STRUCT_SIZE = 3;

export class Packer extends v1.Packer {

  /**
   * @constructor
   * @param {Chunker} chunker the chunker backed by a network channel.
   */
  constructor(chunker) {
    super(chunker);
  }

  disableByteArrays() {
    throw new Error('Bolt V2 should always support byte arrays');
  }

  packable(obj, onError) {
    if (isPoint(obj)) {
      return () => packPoint(obj, this, onError);
    } else if (isDuration(obj)) {
      return () => packDuration(obj, this, onError);
    } else if (isLocalTime(obj)) {
      return () => packLocalTime(obj, this, onError);
    } else if (isTime(obj)) {
      return () => packTime(obj, this, onError);
    } else if (isDate(obj)) {
      return () => packDate(obj, this, onError);
    } else if (isLocalDateTime(obj)) {
      return () => packLocalDateTime(obj, this, onError);
    } else if (isDateTimeWithZoneOffset(obj)) {
      return () => packDateTimeWithZoneOffset(obj, this, onError);
    } else if (isDateTimeWithZoneId(obj)) {
      return () => packDateTimeWithZoneId(obj, this, onError);
    } else {
      return super.packable(obj, onError);
    }
  }
}

export class Unpacker extends v1.Unpacker {

  /**
   * @constructor
   * @param {boolean} disableLosslessIntegers if this unpacker should convert all received integers to native JS numbers.
   */
  constructor(disableLosslessIntegers = false) {
    super(disableLosslessIntegers);
  }


  _unpackUnknownStruct(signature, structSize, buffer) {
    if (signature == POINT_2D) {
      return unpackPoint2D(this, structSize, buffer);
    } else if (signature == POINT_3D) {
      return unpackPoint3D(this, structSize, buffer);
    } else if (signature == DURATION) {
      return unpackDuration(this, structSize, buffer);
    } else if (signature == LOCAL_TIME) {
      return unpackLocalTime(this, structSize, buffer);
    } else if (signature == TIME) {
      return unpackTime(this, structSize, buffer);
    } else if (signature == DATE) {
      return unpackDate(this, structSize, buffer);
    } else if (signature == LOCAL_DATE_TIME) {
      return unpackLocalDateTime(this, structSize, buffer);
    } else if (signature == DATE_TIME_WITH_ZONE_OFFSET) {
      return unpackDateTimeWithZoneOffset(this, structSize, buffer);
    } else if (signature == DATE_TIME_WITH_ZONE_ID) {
      return unpackDateTimeWithZoneId(this, structSize, buffer);
    } else {
      return super._unpackUnknownStruct(signature, structSize, buffer);
    }
  }
}

function packPoint(point, packer, onError) {
  const is2DPoint = point.z === null || point.z === undefined;
  if (is2DPoint) {
    packPoint2D(point, packer, onError);
  } else {
    packPoint3D(point, packer, onError);
  }
}

function packPoint2D(point, packer, onError) {
  const packableStructFields = [
    packer.packable(int(point.srid), onError),
    packer.packable(point.x, onError),
    packer.packable(point.y, onError)
  ];
  packer.packStruct(POINT_2D, packableStructFields, onError);
}

function packPoint3D(point, packer, onError) {
  const packableStructFields = [
    packer.packable(int(point.srid), onError),
    packer.packable(point.x, onError),
    packer.packable(point.y, onError),
    packer.packable(point.z, onError)
  ];
  packer.packStruct(POINT_3D, packableStructFields, onError);
}

function unpackPoint2D(unpacker, structSize, buffer) {
  unpacker._verifyStructSize('Point2D', POINT_2D_STRUCT_SIZE, structSize);

  return new Point(
    unpacker.unpack(buffer), // srid
    unpacker.unpack(buffer), // x
    unpacker.unpack(buffer), // y
    undefined                // z
  );
}

function unpackPoint3D(unpacker, structSize, buffer) {
  unpacker._verifyStructSize('Point3D', POINT_3D_STRUCT_SIZE, structSize);

  return new Point(
    unpacker.unpack(buffer), // srid
    unpacker.unpack(buffer), // x
    unpacker.unpack(buffer), // y
    unpacker.unpack(buffer)  // z
  );
}

function packDuration(value, packer, onError) {
  const months = int(value.months);
  const days = int(value.days);
  const seconds = int(value.seconds);
  const nanoseconds = int(value.nanoseconds);

  const packableStructFields = [
    packer.packable(months, onError),
    packer.packable(days, onError),
    packer.packable(seconds, onError),
    packer.packable(nanoseconds, onError),
  ];
  packer.packStruct(DURATION, packableStructFields, onError);
}

function unpackDuration(unpacker, structSize, buffer) {
  unpacker._verifyStructSize('Duration', DURATION_STRUCT_SIZE, structSize);

  const months = unpacker.unpack(buffer);
  const days = unpacker.unpack(buffer);
  const seconds = unpacker.unpack(buffer);
  const nanoseconds = unpacker.unpack(buffer);

  return new Duration(months, days, seconds, nanoseconds);
}

function packLocalTime(value, packer, onError) {
  const nanoOfDay = localTimeToNanoOfDay(value);

  const packableStructFields = [
    packer.packable(nanoOfDay, onError)
  ];
  packer.packStruct(LOCAL_TIME, packableStructFields, onError);
}

function unpackLocalTime(unpacker, structSize, buffer) {
  unpacker._verifyStructSize('LocalTime', LOCAL_TIME_STRUCT_SIZE, structSize);

  const nanoOfDay = unpacker.unpack(buffer);
  return nanoOfDayToLocalTime(nanoOfDay);
}

/**
 * Pack given time.
 * @param {Time} value the time value to pack.
 * @param {Packer} packer the packer to use.
 * @param {function} onError the error callback.
 */
function packTime(value, packer, onError) {
  const nanoOfDay = localTimeToNanoOfDay(value.localTime);
  const offsetSeconds = int(value.offsetSeconds);

  const packableStructFields = [
    packer.packable(nanoOfDay, onError),
    packer.packable(offsetSeconds, onError)
  ];
  packer.packStruct(TIME, packableStructFields, onError);
}

/**
 * Unpack time value using the given unpacker.
 * @param {Unpacker} unpacker the unpacker to use.
 * @param {number} structSize the retrieved struct size.
 * @param {BaseBuffer} buffer the buffer to unpack from.
 * @return {Time} the unpacked time value.
 */
function unpackTime(unpacker, structSize, buffer) {
  unpacker._verifyStructSize('Time', TIME_STRUCT_SIZE, structSize);

  const nanoOfDay = unpacker.unpack(buffer);
  const offsetSeconds = unpacker.unpack(buffer);

  const localTime = nanoOfDayToLocalTime(nanoOfDay);
  return new Time(localTime, offsetSeconds);
}

/**
 * Pack given neo4j date.
 * @param {Date} value the date value to pack.
 * @param {Packer} packer the packer to use.
 * @param {function} onError the error callback.
 */
function packDate(value, packer, onError) {
  const epochDay = dateToEpochDay(value);

  const packableStructFields = [
    packer.packable(epochDay, onError)
  ];
  packer.packStruct(DATE, packableStructFields, onError);
}

/**
 * Unpack neo4j date value using the given unpacker.
 * @param {Unpacker} unpacker the unpacker to use.
 * @param {number} structSize the retrieved struct size.
 * @param {BaseBuffer} buffer the buffer to unpack from.
 * @return {Date} the unpacked neo4j date value.
 */
function unpackDate(unpacker, structSize, buffer) {
  unpacker._verifyStructSize('Date', DATE_STRUCT_SIZE, structSize);

  const epochDay = unpacker.unpack(buffer);
  return epochDayToDate(epochDay);
}

/**
 * Pack given local date time.
 * @param {LocalDateTime} value the local date time value to pack.
 * @param {Packer} packer the packer to use.
 * @param {function} onError the error callback.
 */
function packLocalDateTime(value, packer, onError) {
  const epochSecond = localDateTimeToEpochSecond(value);
  const nano = int(value.localTime.nanosecond);

  const packableStructFields = [
    packer.packable(epochSecond, onError),
    packer.packable(nano, onError)
  ];
  packer.packStruct(LOCAL_DATE_TIME, packableStructFields, onError);
}

/**
 * Unpack local date time value using the given unpacker.
 * @param {Unpacker} unpacker the unpacker to use.
 * @param {number} structSize the retrieved struct size.
 * @param {BaseBuffer} buffer the buffer to unpack from.
 * @return {LocalDateTime} the unpacked local date time value.
 */
function unpackLocalDateTime(unpacker, structSize, buffer) {
  unpacker._verifyStructSize('LocalDateTime', LOCAL_DATE_TIME_STRUCT_SIZE, structSize);

  const epochSecond = unpacker.unpack(buffer);
  const nano = unpacker.unpack(buffer);

  return epochSecondAndNanoToLocalDateTime(epochSecond, nano);
}

/**
 * Pack given date time with zone offset.
 * @param {DateTimeWithZoneOffset} value the date time value to pack.
 * @param {Packer} packer the packer to use.
 * @param {function} onError the error callback.
 */
function packDateTimeWithZoneOffset(value, packer, onError) {
  const epochSecond = localDateTimeToEpochSecond(value.localDateTime);
  const nano = int(value.localDateTime.localTime.nanosecond);
  const offsetSeconds = int(value.offsetSeconds);

  const packableStructFields = [
    packer.packable(epochSecond, onError),
    packer.packable(nano, onError),
    packer.packable(offsetSeconds, onError)
  ];
  packer.packStruct(DATE_TIME_WITH_ZONE_OFFSET, packableStructFields, onError);
}

/**
 * Unpack date time with zone offset value using the given unpacker.
 * @param {Unpacker} unpacker the unpacker to use.
 * @param {number} structSize the retrieved struct size.
 * @param {BaseBuffer} buffer the buffer to unpack from.
 * @return {DateTimeWithZoneOffset} the unpacked date time with zone offset value.
 */
function unpackDateTimeWithZoneOffset(unpacker, structSize, buffer) {
  unpacker._verifyStructSize('DateTimeWithZoneOffset', DATE_TIME_WITH_ZONE_OFFSET_STRUCT_SIZE, structSize);

  const epochSecond = unpacker.unpack(buffer);
  const nano = unpacker.unpack(buffer);
  const offsetSeconds = unpacker.unpack(buffer);

  const localDateTime = epochSecondAndNanoToLocalDateTime(epochSecond, nano);
  return new DateTimeWithZoneOffset(localDateTime, offsetSeconds);
}

/**
 * Pack given date time with zone id.
 * @param {DateTimeWithZoneId} value the date time value to pack.
 * @param {Packer} packer the packer to use.
 * @param {function} onError the error callback.
 */
function packDateTimeWithZoneId(value, packer, onError) {
  const epochSecond = localDateTimeToEpochSecond(value.localDateTime);
  const nano = int(value.localDateTime.localTime.nanosecond);
  const zoneId = value.zoneId;

  const packableStructFields = [
    packer.packable(epochSecond, onError),
    packer.packable(nano, onError),
    packer.packable(zoneId, onError)
  ];
  packer.packStruct(DATE_TIME_WITH_ZONE_ID, packableStructFields, onError);
}

/**
 * Unpack date time with zone id value using the given unpacker.
 * @param {Unpacker} unpacker the unpacker to use.
 * @param {number} structSize the retrieved struct size.
 * @param {BaseBuffer} buffer the buffer to unpack from.
 * @return {DateTimeWithZoneId} the unpacked date time with zone id value.
 */
function unpackDateTimeWithZoneId(unpacker, structSize, buffer) {
  unpacker._verifyStructSize('DateTimeWithZoneId', DATE_TIME_WITH_ZONE_ID_STRUCT_SIZE, structSize);

  const epochSecond = unpacker.unpack(buffer);
  const nano = unpacker.unpack(buffer);
  const zoneId = unpacker.unpack(buffer);

  const localDateTime = epochSecondAndNanoToLocalDateTime(epochSecond, nano);
  return new DateTimeWithZoneId(localDateTime, zoneId);
}

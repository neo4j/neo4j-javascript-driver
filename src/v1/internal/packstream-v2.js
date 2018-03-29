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
  CypherDate,
  CypherDateTimeWithZoneId,
  CypherDateTimeWithZoneOffset,
  CypherDuration,
  CypherTime,
  isCypherDate,
  isCypherDateTimeWithZoneId,
  isCypherDateTimeWithZoneOffset,
  isCypherDuration,
  isCypherLocalDateTime,
  isCypherLocalTime,
  isCypherTime
} from '../temporal-types';
import {int} from '../integer';
import {
  cypherDateToEpochDay,
  cypherLocalDateTimeToEpochSecond,
  cypherLocalTimeToNanoOfDay,
  epochDayToCypherDate,
  epochSecondAndNanoToCypherLocalDateTime,
  nanoOfDayToCypherLocalTime
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
    } else if (isCypherDuration(obj)) {
      return () => packDuration(obj, this, onError);
    } else if (isCypherLocalTime(obj)) {
      return () => packLocalTime(obj, this, onError);
    } else if (isCypherTime(obj)) {
      return () => packTime(obj, this, onError);
    } else if (isCypherDate(obj)) {
      return () => packDate(obj, this, onError);
    } else if (isCypherLocalDateTime(obj)) {
      return () => packLocalDateTime(obj, this, onError);
    } else if (isCypherDateTimeWithZoneOffset(obj)) {
      return () => packDateTimeWithZoneOffset(obj, this, onError);
    } else if (isCypherDateTimeWithZoneId(obj)) {
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

  return new CypherDuration(months, days, seconds, nanoseconds);
}

function packLocalTime(value, packer, onError) {
  const nanoOfDay = cypherLocalTimeToNanoOfDay(value);

  const packableStructFields = [
    packer.packable(nanoOfDay, onError)
  ];
  packer.packStruct(LOCAL_TIME, packableStructFields, onError);
}

function unpackLocalTime(unpacker, structSize, buffer) {
  unpacker._verifyStructSize('LocalTime', LOCAL_TIME_STRUCT_SIZE, structSize);

  const nanoOfDay = unpacker.unpack(buffer);
  return nanoOfDayToCypherLocalTime(nanoOfDay);
}

/**
 * Pack given cypher time.
 * @param {CypherTime} value the time value to pack.
 * @param {Packer} packer the packer to use.
 * @param {function} onError the error callback.
 */
function packTime(value, packer, onError) {
  const nanoOfDay = cypherLocalTimeToNanoOfDay(value.localTime);
  const offsetSeconds = int(value.offsetSeconds);

  const packableStructFields = [
    packer.packable(nanoOfDay, onError),
    packer.packable(offsetSeconds, onError)
  ];
  packer.packStruct(TIME, packableStructFields, onError);
}

/**
 * Unpack cypher time value using the given unpacker.
 * @param {Unpacker} unpacker the unpacker to use.
 * @param {number} structSize the retrieved struct size.
 * @param {BaseBuffer} buffer the buffer to unpack from.
 * @return {CypherTime} the unpacked cypher time value.
 */
function unpackTime(unpacker, structSize, buffer) {
  unpacker._verifyStructSize('Time', TIME_STRUCT_SIZE, structSize);

  const nanoOfDay = unpacker.unpack(buffer);
  const offsetSeconds = unpacker.unpack(buffer);

  const localTime = nanoOfDayToCypherLocalTime(nanoOfDay);
  return new CypherTime(localTime, offsetSeconds);
}

/**
 * Pack given cypher date.
 * @param {CypherDate} value the date value to pack.
 * @param {Packer} packer the packer to use.
 * @param {function} onError the error callback.
 */
function packDate(value, packer, onError) {
  const epochDay = cypherDateToEpochDay(value);

  const packableStructFields = [
    packer.packable(epochDay, onError)
  ];
  packer.packStruct(DATE, packableStructFields, onError);
}

/**
 * Unpack cypher date value using the given unpacker.
 * @param {Unpacker} unpacker the unpacker to use.
 * @param {number} structSize the retrieved struct size.
 * @param {BaseBuffer} buffer the buffer to unpack from.
 * @return {CypherDate} the unpacked cypher date value.
 */
function unpackDate(unpacker, structSize, buffer) {
  unpacker._verifyStructSize('Date', DATE_STRUCT_SIZE, structSize);

  const epochDay = unpacker.unpack(buffer);
  return epochDayToCypherDate(epochDay);
}

/**
 * Pack given cypher local date time.
 * @param {CypherLocalDateTime} value the local date time value to pack.
 * @param {Packer} packer the packer to use.
 * @param {function} onError the error callback.
 */
function packLocalDateTime(value, packer, onError) {
  const epochSecond = cypherLocalDateTimeToEpochSecond(value);
  const nano = int(value.localTime.nanosecond);

  const packableStructFields = [
    packer.packable(epochSecond, onError),
    packer.packable(nano, onError)
  ];
  packer.packStruct(LOCAL_DATE_TIME, packableStructFields, onError);
}

/**
 * Unpack cypher local date time value using the given unpacker.
 * @param {Unpacker} unpacker the unpacker to use.
 * @param {number} structSize the retrieved struct size.
 * @param {BaseBuffer} buffer the buffer to unpack from.
 * @return {CypherLocalDateTime} the unpacked cypher local date time value.
 */
function unpackLocalDateTime(unpacker, structSize, buffer) {
  unpacker._verifyStructSize('LocalDateTime', LOCAL_DATE_TIME_STRUCT_SIZE, structSize);

  const epochSecond = unpacker.unpack(buffer);
  const nano = unpacker.unpack(buffer);

  return epochSecondAndNanoToCypherLocalDateTime(epochSecond, nano);
}

/**
 * Pack given cypher date time with zone offset.
 * @param {CypherDateTimeWithZoneOffset} value the date time value to pack.
 * @param {Packer} packer the packer to use.
 * @param {function} onError the error callback.
 */
function packDateTimeWithZoneOffset(value, packer, onError) {
  const epochSecond = cypherLocalDateTimeToEpochSecond(value.localDateTime);
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
 * Unpack cypher date time with zone offset value using the given unpacker.
 * @param {Unpacker} unpacker the unpacker to use.
 * @param {number} structSize the retrieved struct size.
 * @param {BaseBuffer} buffer the buffer to unpack from.
 * @return {CypherDateTimeWithZoneOffset} the unpacked cypher date time with zone offset value.
 */
function unpackDateTimeWithZoneOffset(unpacker, structSize, buffer) {
  unpacker._verifyStructSize('DateTimeWithZoneOffset', DATE_TIME_WITH_ZONE_OFFSET_STRUCT_SIZE, structSize);

  const epochSecond = unpacker.unpack(buffer);
  const nano = unpacker.unpack(buffer);
  const offsetSeconds = unpacker.unpack(buffer);

  const localDateTime = epochSecondAndNanoToCypherLocalDateTime(epochSecond, nano);
  return new CypherDateTimeWithZoneOffset(localDateTime, offsetSeconds);
}

/**
 * Pack given cypher date time with zone id.
 * @param {CypherDateTimeWithZoneId} value the date time value to pack.
 * @param {Packer} packer the packer to use.
 * @param {function} onError the error callback.
 */
function packDateTimeWithZoneId(value, packer, onError) {
  const epochSecond = cypherLocalDateTimeToEpochSecond(value.localDateTime);
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
 * Unpack cypher date time with zone id value using the given unpacker.
 * @param {Unpacker} unpacker the unpacker to use.
 * @param {number} structSize the retrieved struct size.
 * @param {BaseBuffer} buffer the buffer to unpack from.
 * @return {CypherDateTimeWithZoneId} the unpacked cypher date time with zone id value.
 */
function unpackDateTimeWithZoneId(unpacker, structSize, buffer) {
  unpacker._verifyStructSize('DateTimeWithZoneId', DATE_TIME_WITH_ZONE_ID_STRUCT_SIZE, structSize);

  const epochSecond = unpacker.unpack(buffer);
  const nano = unpacker.unpack(buffer);
  const zoneId = unpacker.unpack(buffer);

  const localDateTime = epochSecondAndNanoToCypherLocalDateTime(epochSecond, nano);
  return new CypherDateTimeWithZoneId(localDateTime, zoneId);
}

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

 import {
   DateTime,
   isInt,
   int,
   internal
 } from 'neo4j-driver-core'
 
 
 import {
   epochSecondAndNanoToLocalDateTime
 } from './temporal-factory'
 
 const {
   temporalUtil: {
     localDateTimeToEpochSecond
   }
 } = internal
 
 export const DATE_TIME_WITH_ZONE_OFFSET = 0x49
 const DATE_TIME_WITH_ZONE_OFFSET_STRUCT_SIZE = 3
 
 export const DATE_TIME_WITH_ZONE_ID = 0x69
 const DATE_TIME_WITH_ZONE_ID_STRUCT_SIZE = 3

 /**
 * Unpack date time with zone offset value using the given unpacker.
 * @param {Unpacker} unpacker the unpacker to use.
 * @param {number} structSize the retrieved struct size.
 * @param {BaseBuffer} buffer the buffer to unpack from.
 * @param {boolean} disableLosslessIntegers if integer properties in the result date-time should be native JS numbers.
 * @return {DateTime} the unpacked date time with zone offset value.
 */
export function unpackDateTimeWithZoneOffset (
  unpacker,
  structSize,
  buffer,
  disableLosslessIntegers,
  useBigInt
) {
  unpacker._verifyStructSize(
    'DateTimeWithZoneOffset',
    DATE_TIME_WITH_ZONE_OFFSET_STRUCT_SIZE,
    structSize
  )

  const utcSecond = unpacker.unpackInteger(buffer)
  const nano = unpacker.unpackInteger(buffer)
  const timeZoneOffsetSeconds = unpacker.unpackInteger(buffer)

  const epochSecond = int(utcSecond).add(timeZoneOffsetSeconds)
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
 * Unpack date time with zone id value using the given unpacker.
 * @param {Unpacker} unpacker the unpacker to use.
 * @param {number} structSize the retrieved struct size.
 * @param {BaseBuffer} buffer the buffer to unpack from.
 * @param {boolean} disableLosslessIntegers if integer properties in the result date-time should be native JS numbers.
 * @return {DateTime} the unpacked date time with zone id value.
 */
 export function unpackDateTimeWithZoneId (
  unpacker,
  structSize,
  buffer,
  disableLosslessIntegers,
  useBigInt
) {
  unpacker._verifyStructSize(
    'DateTimeWithZoneId',
    DATE_TIME_WITH_ZONE_ID_STRUCT_SIZE,
    structSize
  )

  const epochSecond = unpacker.unpackInteger(buffer)
  const nano = unpacker.unpackInteger(buffer)
  const timeZoneId = unpacker.unpack(buffer)

  const localDateTime = getTimeInZoneId(timeZoneId, epochSecond, nano)
 
  const result = new DateTime(
    localDateTime.year,
    localDateTime.month,
    localDateTime.day,
    localDateTime.hour,
    localDateTime.minute,
    localDateTime.second,
    int(nano),
    localDateTime.timeZoneOffsetSeconds,
    timeZoneId
  )
  return convertIntegerPropsIfNeeded(result, disableLosslessIntegers, useBigInt)
}

/*
* Pack given date time.
* @param {DateTime} value the date time value to pack.
* @param {Packer} packer the packer to use.
*/
export function packDateTime (value, packer) {
 if (value.timeZoneId) {
   packDateTimeWithZoneId(value, packer)
 } else {
   packDateTimeWithZoneOffset(value, packer)
 }
}

/**
 * Pack given date time with zone id.
 * @param {DateTime} value the date time value to pack.
 * @param {Packer} packer the packer to use.
 */
 function packDateTimeWithZoneId (value, packer) {

  const epochSecond = localDateTimeToEpochSecond(
    value.year,
    value.month,
    value.day,
    value.hour,
    value.minute,
    value.second,
    value.nanosecond
  )

  const offset = value.timeZoneOffsetSeconds != null
    ? value.timeZoneOffsetSeconds
    : getOffsetFromZoneId(value.timeZoneId, epochSecond, value.nanosecond)

  const utc = epochSecond.subtract(offset)
  const nano = int(value.nanosecond)
  const timeZoneId = value.timeZoneId
  
  const packableStructFields = [
    packer.packable(utc),
    packer.packable(nano),
    packer.packable(timeZoneId)
  ]
  packer.packStruct(DATE_TIME_WITH_ZONE_ID, packableStructFields)
}

/**
 * Pack given date time with zone offset.
 * @param {DateTime} value the date time value to pack.
 * @param {Packer} packer the packer to use.
 */
 function packDateTimeWithZoneOffset (value, packer) {
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
  const utcSecond = epochSecond.subtract(timeZoneOffsetSeconds)

  const packableStructFields = [
    packer.packable(utcSecond),
    packer.packable(nano),
    packer.packable(timeZoneOffsetSeconds)
  ]
  packer.packStruct(DATE_TIME_WITH_ZONE_OFFSET, packableStructFields)
}
 
 
 /**
  * Returns the offset for a given timezone id
  *
  * Javascript doesn't have support for direct getting the timezone offset from a given
  * TimeZoneId and DateTime in the given TimeZoneId. For solving this issue,
  *
  * 1. The ZoneId is applied to the timestamp, so we could make the difference between the
  * given timestamp and the new calculated one. This is the offset for the timezone
  * in the utc is equal to epoch (some time in the future or past)
  * 2. The offset is subtracted from the timestamp, so we have an estimated utc timestamp.
  * 3. The ZoneId is applied to the new timestamp, se we could could make the difference
  * between the new timestamp and the calculated one. This is the offset for the given timezone.
  *
  * Example:
  *    Input: 2022-3-27 1:59:59 'Europe/Berlin'
  *    Apply 1, 2022-3-27 1:59:59 => 2022-3-27 3:59:59 'Europe/Berlin' +2:00
  *    Apply 2, 2022-3-27 1:59:59 - 2:00 => 2022-3-26 23:59:59
  *    Apply 3, 2022-3-26 23:59:59 => 2022-3-27 00:59:59 'Europe/Berlin' +1:00
  *  The offset is +1 hour.
  *
  * @param {string} timeZoneId The timezone id
  * @param {Integer} epochSecond The epoch second in the timezone id
  * @param {Integerable} nanosecond The nanoseconds in the timezone id
  * @returns The timezone offset
  */
 function getOffsetFromZoneId (timeZoneId, epochSecond, nanosecond) {
   const dateTimeWithZoneAppliedTwice = getTimeInZoneId(timeZoneId, epochSecond, nanosecond)
 
   // The wallclock form the current date time
   const epochWithZoneAppliedTwice = localDateTimeToEpochSecond(
     dateTimeWithZoneAppliedTwice.year,
     dateTimeWithZoneAppliedTwice.month,
     dateTimeWithZoneAppliedTwice.day,
     dateTimeWithZoneAppliedTwice.hour,
     dateTimeWithZoneAppliedTwice.minute,
     dateTimeWithZoneAppliedTwice.second,
     nanosecond)
 
   const offsetOfZoneInTheFutureUtc = epochWithZoneAppliedTwice.subtract(epochSecond)
   const guessedUtc = epochSecond.subtract(offsetOfZoneInTheFutureUtc)
 
   const zonedDateTimeFromGuessedUtc = getTimeInZoneId(timeZoneId, guessedUtc, nanosecond)
 
   const zonedEpochFromGuessedUtc = localDateTimeToEpochSecond(
     zonedDateTimeFromGuessedUtc.year,
     zonedDateTimeFromGuessedUtc.month,
     zonedDateTimeFromGuessedUtc.day,
     zonedDateTimeFromGuessedUtc.hour,
     zonedDateTimeFromGuessedUtc.minute,
     zonedDateTimeFromGuessedUtc.second,
     nanosecond)
 
   const offset = zonedEpochFromGuessedUtc.subtract(guessedUtc)
   return offset
 }
 
 function getTimeInZoneId (timeZoneId, epochSecond, nano) {
   const formatter = new Intl.DateTimeFormat('en-US', {
     timeZone: timeZoneId,
     year: 'numeric',
     month: 'numeric',
     day: 'numeric',
     hour: 'numeric',
     minute: 'numeric',
     second: 'numeric',
     hour12: false
   })
 
   const l = epochSecondAndNanoToLocalDateTime(epochSecond, nano)
   const utc = Date.UTC(
     int(l.year).toNumber(),
     int(l.month).toNumber() - 1,
     int(l.day).toNumber(),
     int(l.hour).toNumber(),
     int(l.minute).toNumber(),
     int(l.second).toNumber()
   )
 
   const formattedUtcParts = formatter.formatToParts(utc)
 
   const localDateTime = formattedUtcParts.reduce((obj, currentValue) => {
     if (currentValue.type !== 'literal') {
       obj[currentValue.type] = int(currentValue.value)
     }
     return obj
   }, {})
 
   const epochInTimeZone = localDateTimeToEpochSecond(
     localDateTime.year,
     localDateTime.month,
     localDateTime.day,
     localDateTime.hour,
     localDateTime.minute,
     localDateTime.second,
     localDateTime.nanosecond
   )
 
   localDateTime.timeZoneOffsetSeconds = epochInTimeZone.subtract(epochSecond)
   localDateTime.hour = localDateTime.hour.modulo(24)
 
   return localDateTime
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
 
 

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

import { structure } from '../packstream'
import {
  DateTime,
  isInt,
  int,
  internal
} from 'neo4j-driver-core'

import v4x4 from './bolt-protocol-v4x4.transformer'

import {
  epochSecondAndNanoToLocalDateTime
} from './temporal-factory'
import { identity } from '../lang/functional'

const {
  temporalUtil: {
    localDateTimeToEpochSecond
  }
} = internal

const DATE_TIME_WITH_ZONE_OFFSET = 0x49
const DATE_TIME_WITH_ZONE_OFFSET_STRUCT_SIZE = 3

const DATE_TIME_WITH_ZONE_ID = 0x69
const DATE_TIME_WITH_ZONE_ID_STRUCT_SIZE = 3

function createDateTimeWithZoneIdTransformer (config, logger) {
  const { disableLosslessIntegers, useBigInt } = config
  const dateTimeWithZoneIdTransformer = v4x4.createDateTimeWithZoneIdTransformer(config)
  return dateTimeWithZoneIdTransformer.extendsWith({
    signature: DATE_TIME_WITH_ZONE_ID,
    fromStructure: struct => {
      structure.verifyStructSize(
        'DateTimeWithZoneId',
        DATE_TIME_WITH_ZONE_ID_STRUCT_SIZE,
        struct.size
      )

      const [epochSecond, nano, timeZoneId] = struct.fields

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
    },
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

      const offset = value.timeZoneOffsetSeconds != null
        ? value.timeZoneOffsetSeconds
        : getOffsetFromZoneId(value.timeZoneId, epochSecond, value.nanosecond)

      if (value.timeZoneOffsetSeconds == null) {
        logger.warn('DateTime objects without "timeZoneOffsetSeconds" property ' +
          'are prune to bugs related to ambiguous times. For instance, ' +
          '2022-10-30T2:30:00[Europe/Berlin] could be GMT+1 or GMT+2.')
      }
      const utc = epochSecond.subtract(offset)

      const nano = int(value.nanosecond)
      const timeZoneId = value.timeZoneId

      return new structure.Structure(DATE_TIME_WITH_ZONE_ID, [utc, nano, timeZoneId])
    }
  })
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

const dateTimeFormatCache = new Map()

function getDateTimeFormatForZoneId (timeZoneId) {
  if (!dateTimeFormatCache.has(timeZoneId)) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZoneId,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
      era: 'narrow'
    })

    dateTimeFormatCache.set(timeZoneId, formatter)
  }

  return dateTimeFormatCache.get(timeZoneId)
}

function getTimeInZoneId (timeZoneId, epochSecond, nano) {
  const formatter = getDateTimeFormatForZoneId(timeZoneId)

  const utc = int(epochSecond)
    .multiply(1000)
    .add(int(nano).div(1_000_000))
    .toNumber()

  const formattedUtcParts = formatter.formatToParts(utc)

  const localDateTime = formattedUtcParts.reduce((obj, currentValue) => {
    if (currentValue.type === 'era') {
      obj.adjustEra =
        currentValue.value.toUpperCase() === 'B'
          ? year => year.subtract(1).negate() // 1BC equals to year 0 in astronomical year numbering
          : identity
    } else if (currentValue.type === 'hour') {
      obj.hour = int(currentValue.value).modulo(24)
    } else if (currentValue.type !== 'literal') {
      obj[currentValue.type] = int(currentValue.value)
    }
    return obj
  }, {})

  localDateTime.year = localDateTime.adjustEra(localDateTime.year)

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

function createDateTimeWithOffsetTransformer (config) {
  const { disableLosslessIntegers, useBigInt } = config
  const dateTimeWithOffsetTransformer = v4x4.createDateTimeWithOffsetTransformer(config)
  return dateTimeWithOffsetTransformer.extendsWith({
    signature: DATE_TIME_WITH_ZONE_OFFSET,
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
      const utcSecond = epochSecond.subtract(timeZoneOffsetSeconds)
      return new structure.Structure(DATE_TIME_WITH_ZONE_OFFSET, [utcSecond, nano, timeZoneOffsetSeconds])
    },
    fromStructure: struct => {
      structure.verifyStructSize(
        'DateTimeWithZoneOffset',
        DATE_TIME_WITH_ZONE_OFFSET_STRUCT_SIZE,
        struct.size
      )

      const [utcSecond, nano, timeZoneOffsetSeconds] = struct.fields

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
  createDateTimeWithZoneIdTransformer,
  createDateTimeWithOffsetTransformer
}

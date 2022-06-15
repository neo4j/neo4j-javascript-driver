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

const {
  temporalUtil: {
    localDateTimeToEpochSecond
  }
} = internal

const DATE_TIME_WITH_ZONE_OFFSET = 0x49
const DATE_TIME_WITH_ZONE_OFFSET_STRUCT_SIZE = 3

const DATE_TIME_WITH_ZONE_ID = 0x69
const DATE_TIME_WITH_ZONE_ID_STRUCT_SIZE = 3

function createDateTimeWithZoneIdTransformer (config) {
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
        null,
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

      const dateTimeWithZoneAppliedTwice = getTimeInZoneId(value.timeZoneId, epochSecond, value.nanosecond)

      // The wallclock form the current date time
      const epochWithZoneAppliedTwice = localDateTimeToEpochSecond(
        dateTimeWithZoneAppliedTwice.year,
        dateTimeWithZoneAppliedTwice.month,
        dateTimeWithZoneAppliedTwice.day,
        dateTimeWithZoneAppliedTwice.hour,
        dateTimeWithZoneAppliedTwice.minute,
        dateTimeWithZoneAppliedTwice.second,
        value.nanosecond)

      const offsetOfZoneInTheFutureUtc = epochSecond.subtract(epochWithZoneAppliedTwice)
      const guessedUtc = epochSecond.add(offsetOfZoneInTheFutureUtc)

      const zonedDateTimeFromGuessedUtc = getTimeInZoneId(value.timeZoneId, guessedUtc, value.nanosecond)

      const zonedEpochFromGuessedUtc = localDateTimeToEpochSecond(
        zonedDateTimeFromGuessedUtc.year,
        zonedDateTimeFromGuessedUtc.month,
        zonedDateTimeFromGuessedUtc.day,
        zonedDateTimeFromGuessedUtc.hour,
        zonedDateTimeFromGuessedUtc.minute,
        zonedDateTimeFromGuessedUtc.second,
        value.nanosecond)

      const offset = zonedEpochFromGuessedUtc.subtract(guessedUtc)
      const utc = epochSecond.subtract(offset)

      const nano = int(value.nanosecond)
      const timeZoneId = value.timeZoneId

      return new structure.Structure(DATE_TIME_WITH_ZONE_ID, [utc, nano, timeZoneId])
    }
  })
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
    hourCycle: 'h23'
  })

  const l = epochSecondAndNanoToLocalDateTime(epochSecond, nano)

  const formattedUtc = formatter.formatToParts(Date.UTC(
    int(l.year).toNumber(),
    int(l.month).toNumber() - 1,
    int(l.day).toNumber(),
    int(l.hour).toNumber(),
    int(l.minute).toNumber(),
    int(l.second).toNumber()
  ))

  const localDateTime = formattedUtc.reduce((obj, currentValue) => {
    if (currentValue.type !== 'literal') {
      obj[currentValue.type] = int(currentValue.value)
      return obj
    }
    return obj
  }, {})
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

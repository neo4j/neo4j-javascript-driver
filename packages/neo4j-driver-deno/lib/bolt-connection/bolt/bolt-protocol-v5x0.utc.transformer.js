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

import { structure } from '../packstream/index.js'
import {
  DateTime,
  isInt,
  int,
  internal
} from '../../core/index.ts'

import v4x4 from './bolt-protocol-v4x4.transformer.js'

import {
  epochSecondAndNanoToLocalDateTime
} from './temporal-factory.js'

const {
  temporalUtil: {
    localDateTimeToEpochSecond,
    getTimeInZoneId,
    getOffsetFromZoneId
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

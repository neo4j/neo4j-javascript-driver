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

import { internal } from 'neo4j-driver-core'

const {
  temporalUtil: {
    YEAR_RANGE,
    MONTH_OF_YEAR_RANGE,
    DAY_OF_MONTH_RANGE,
    HOUR_OF_DAY_RANGE,
    MINUTE_OF_HOUR_RANGE,
    SECOND_OF_MINUTE_RANGE,
    NANOSECOND_OF_SECOND_RANGE,
    MINUTES_PER_HOUR,
    SECONDS_PER_MINUTE,
    SECONDS_PER_HOUR,
    NANOS_PER_SECOND,
    NANOS_PER_MILLISECOND,
    NANOS_PER_MINUTE,
    NANOS_PER_HOUR,
    DAYS_0000_TO_1970,
    DAYS_PER_400_YEAR_CYCLE,
    SECONDS_PER_DAY,
    normalizeSecondsForDuration,
    normalizeNanosecondsForDuration,
    localTimeToNanoOfDay,
    localDateTimeToEpochSecond,
    dateToEpochDay,
    durationToIsoString,
    timeToIsoString,
    timeZoneOffsetToIsoString,
    dateToIsoString,
    totalNanoseconds,
    timeZoneOffsetInSeconds,
    assertValidYear,
    assertValidMonth,
    assertValidDay,
    assertValidHour,
    assertValidMinute,
    assertValidSecond,
    assertValidNanosecond,
    assertValidTemporalValue,
    floorDiv,
    floorMod
  }
} = internal

export {
  YEAR_RANGE,
  MONTH_OF_YEAR_RANGE,
  DAY_OF_MONTH_RANGE,
  HOUR_OF_DAY_RANGE,
  MINUTE_OF_HOUR_RANGE,
  SECOND_OF_MINUTE_RANGE,
  NANOSECOND_OF_SECOND_RANGE,
  MINUTES_PER_HOUR,
  SECONDS_PER_MINUTE,
  SECONDS_PER_HOUR,
  NANOS_PER_SECOND,
  NANOS_PER_MILLISECOND,
  NANOS_PER_MINUTE,
  NANOS_PER_HOUR,
  DAYS_0000_TO_1970,
  DAYS_PER_400_YEAR_CYCLE,
  SECONDS_PER_DAY,
  normalizeSecondsForDuration,
  normalizeNanosecondsForDuration,
  localTimeToNanoOfDay,
  localDateTimeToEpochSecond,
  dateToEpochDay,
  durationToIsoString,
  timeToIsoString,
  timeZoneOffsetToIsoString,
  dateToIsoString,
  totalNanoseconds,
  timeZoneOffsetInSeconds,
  assertValidYear,
  assertValidMonth,
  assertValidDay,
  assertValidHour,
  assertValidMinute,
  assertValidSecond,
  assertValidNanosecond,
  assertValidTemporalValue,
  floorDiv,
  floorMod
}

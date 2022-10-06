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
  int,
  Date,
  LocalDateTime,
  LocalTime,
  internal
} from '../../core/index.ts'
const {
  temporalUtil: {
    DAYS_0000_TO_1970,
    DAYS_PER_400_YEAR_CYCLE,
    NANOS_PER_HOUR,
    NANOS_PER_MINUTE,
    NANOS_PER_SECOND,
    SECONDS_PER_DAY,
    floorDiv,
    floorMod
  }
} = internal

/**
 * Converts given epoch day to a local date.
 * @param {Integer|number|string} epochDay the epoch day to convert.
 * @return {Date} the date representing the epoch day in years, months and days.
 */
export function epochDayToDate (epochDay) {
  epochDay = int(epochDay)

  let zeroDay = epochDay.add(DAYS_0000_TO_1970).subtract(60)
  let adjust = int(0)
  if (zeroDay.lessThan(0)) {
    const adjustCycles = zeroDay
      .add(1)
      .div(DAYS_PER_400_YEAR_CYCLE)
      .subtract(1)
    adjust = adjustCycles.multiply(400)
    zeroDay = zeroDay.add(adjustCycles.multiply(-DAYS_PER_400_YEAR_CYCLE))
  }
  let year = zeroDay
    .multiply(400)
    .add(591)
    .div(DAYS_PER_400_YEAR_CYCLE)
  let dayOfYearEst = zeroDay.subtract(
    year
      .multiply(365)
      .add(year.div(4))
      .subtract(year.div(100))
      .add(year.div(400))
  )
  if (dayOfYearEst.lessThan(0)) {
    year = year.subtract(1)
    dayOfYearEst = zeroDay.subtract(
      year
        .multiply(365)
        .add(year.div(4))
        .subtract(year.div(100))
        .add(year.div(400))
    )
  }
  year = year.add(adjust)
  const marchDayOfYear = dayOfYearEst

  const marchMonth = marchDayOfYear
    .multiply(5)
    .add(2)
    .div(153)
  const month = marchMonth
    .add(2)
    .modulo(12)
    .add(1)
  const day = marchDayOfYear
    .subtract(
      marchMonth
        .multiply(306)
        .add(5)
        .div(10)
    )
    .add(1)
  year = year.add(marchMonth.div(10))

  return new Date(year, month, day)
}

/**
 * Converts nanoseconds of the day into local time.
 * @param {Integer|number|string} nanoOfDay the nanoseconds of the day to convert.
 * @return {LocalTime} the local time representing given nanoseconds of the day.
 */
export function nanoOfDayToLocalTime (nanoOfDay) {
  nanoOfDay = int(nanoOfDay)

  const hour = nanoOfDay.div(NANOS_PER_HOUR)
  nanoOfDay = nanoOfDay.subtract(hour.multiply(NANOS_PER_HOUR))

  const minute = nanoOfDay.div(NANOS_PER_MINUTE)
  nanoOfDay = nanoOfDay.subtract(minute.multiply(NANOS_PER_MINUTE))

  const second = nanoOfDay.div(NANOS_PER_SECOND)
  const nanosecond = nanoOfDay.subtract(second.multiply(NANOS_PER_SECOND))

  return new LocalTime(hour, minute, second, nanosecond)
}

/**
 * Converts given epoch second and nanosecond adjustment into a local date time object.
 * @param {Integer|number|string} epochSecond the epoch second to use.
 * @param {Integer|number|string} nano the nanosecond to use.
 * @return {LocalDateTime} the local date time representing given epoch second and nano.
 */
export function epochSecondAndNanoToLocalDateTime (epochSecond, nano) {
  const epochDay = floorDiv(epochSecond, SECONDS_PER_DAY)
  const secondsOfDay = floorMod(epochSecond, SECONDS_PER_DAY)
  const nanoOfDay = secondsOfDay.multiply(NANOS_PER_SECOND).add(nano)

  const localDate = epochDayToDate(epochDay)
  const localTime = nanoOfDayToLocalTime(nanoOfDay)
  return new LocalDateTime(
    localDate.year,
    localDate.month,
    localDate.day,
    localTime.hour,
    localTime.minute,
    localTime.second,
    localTime.nanosecond
  )
}

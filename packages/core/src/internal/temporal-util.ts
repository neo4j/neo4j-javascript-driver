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

import Integer, { int, isInt } from '../integer'
import { newError } from '../error'
import { assertNumberOrInteger } from './util'
import { NumberOrInteger } from '../graph-types'

/*
  Code in this util should be compatible with code in the database that uses JSR-310 java.time APIs.

  It is based on a library called ThreeTen (https://github.com/ThreeTen/threetenbp) which was derived
  from JSR-310 reference implementation previously hosted on GitHub. Code uses `Integer` type everywhere
  to correctly handle large integer values that are greater than `Number.MAX_SAFE_INTEGER`.

  Please consult either ThreeTen or js-joda (https://github.com/js-joda/js-joda) when working with the
  conversion functions.
 */
class ValueRange {
  _minNumber: number
  _maxNumber: number
  _minInteger: Integer
  _maxInteger: Integer

  constructor (min: number, max: number) {
    this._minNumber = min
    this._maxNumber = max
    this._minInteger = int(min)
    this._maxInteger = int(max)
  }

  contains (value: number | Integer | bigint) {
    if (isInt(value) && value instanceof Integer) {
      return (
        value.greaterThanOrEqual(this._minInteger) &&
        value.lessThanOrEqual(this._maxInteger)
      )
    } else if (typeof value === 'bigint') {
      const intValue = int(value)
      return (
        intValue.greaterThanOrEqual(this._minInteger) &&
        intValue.lessThanOrEqual(this._maxInteger)
      )
    } else {
      return value >= this._minNumber && value <= this._maxNumber
    }
  }

  toString () {
    return `[${this._minNumber}, ${this._maxNumber}]`
  }
}

export const YEAR_RANGE = new ValueRange(-999999999, 999999999)
export const MONTH_OF_YEAR_RANGE = new ValueRange(1, 12)
export const DAY_OF_MONTH_RANGE = new ValueRange(1, 31)
export const HOUR_OF_DAY_RANGE = new ValueRange(0, 23)
export const MINUTE_OF_HOUR_RANGE = new ValueRange(0, 59)
export const SECOND_OF_MINUTE_RANGE = new ValueRange(0, 59)
export const NANOSECOND_OF_SECOND_RANGE = new ValueRange(0, 999999999)

export const MINUTES_PER_HOUR = 60
export const SECONDS_PER_MINUTE = 60
export const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR
export const NANOS_PER_SECOND = 1000000000
export const NANOS_PER_MILLISECOND = 1000000
export const NANOS_PER_MINUTE = NANOS_PER_SECOND * SECONDS_PER_MINUTE
export const NANOS_PER_HOUR = NANOS_PER_MINUTE * MINUTES_PER_HOUR
export const DAYS_0000_TO_1970 = 719528
export const DAYS_PER_400_YEAR_CYCLE = 146097
export const SECONDS_PER_DAY = 86400

export function normalizeSecondsForDuration (
  seconds: number | Integer | bigint,
  nanoseconds: number | Integer | bigint
): Integer {
  return int(seconds).add(floorDiv(nanoseconds, NANOS_PER_SECOND))
}

export function normalizeNanosecondsForDuration (
  nanoseconds: number | Integer | bigint
): Integer {
  return floorMod(nanoseconds, NANOS_PER_SECOND)
}

/**
 * Converts given local time into a single integer representing this same time in nanoseconds of the day.
 * @param {Integer|number|string} hour the hour of the local time to convert.
 * @param {Integer|number|string} minute the minute of the local time to convert.
 * @param {Integer|number|string} second the second of the local time to convert.
 * @param {Integer|number|string} nanosecond the nanosecond of the local time to convert.
 * @return {Integer} nanoseconds representing the given local time.
 */
export function localTimeToNanoOfDay (
  hour: NumberOrInteger | string,
  minute: NumberOrInteger | string,
  second: NumberOrInteger | string,
  nanosecond: NumberOrInteger | string
): Integer {
  hour = int(hour)
  minute = int(minute)
  second = int(second)
  nanosecond = int(nanosecond)

  let totalNanos = hour.multiply(NANOS_PER_HOUR)
  totalNanos = totalNanos.add(minute.multiply(NANOS_PER_MINUTE))
  totalNanos = totalNanos.add(second.multiply(NANOS_PER_SECOND))
  return totalNanos.add(nanosecond)
}

/**
 * Converts given local date time into a single integer representing this same time in epoch seconds UTC.
 * @param {Integer|number|string} year the year of the local date-time to convert.
 * @param {Integer|number|string} month the month of the local date-time to convert.
 * @param {Integer|number|string} day the day of the local date-time to convert.
 * @param {Integer|number|string} hour the hour of the local date-time to convert.
 * @param {Integer|number|string} minute the minute of the local date-time to convert.
 * @param {Integer|number|string} second the second of the local date-time to convert.
 * @param {Integer|number|string} nanosecond the nanosecond of the local date-time to convert.
 * @return {Integer} epoch second in UTC representing the given local date time.
 */
export function localDateTimeToEpochSecond (
  year: NumberOrInteger | string,
  month: NumberOrInteger | string,
  day: NumberOrInteger | string,
  hour: NumberOrInteger | string,
  minute: NumberOrInteger | string,
  second: NumberOrInteger | string,
  nanosecond: NumberOrInteger | string
): Integer {
  const epochDay = dateToEpochDay(year, month, day)
  const localTimeSeconds = localTimeToSecondOfDay(hour, minute, second)
  return epochDay.multiply(SECONDS_PER_DAY).add(localTimeSeconds)
}

/**
 * Converts given local date into a single integer representing it's epoch day.
 * @param {Integer|number|string} year the year of the local date to convert.
 * @param {Integer|number|string} month the month of the local date to convert.
 * @param {Integer|number|string} day the day of the local date to convert.
 * @return {Integer} epoch day representing the given date.
 */
export function dateToEpochDay (
  year: NumberOrInteger | string,
  month: NumberOrInteger | string,
  day: NumberOrInteger | string
): Integer {
  year = int(year)
  month = int(month)
  day = int(day)

  let epochDay = year.multiply(365)

  if (year.greaterThanOrEqual(0)) {
    epochDay = epochDay.add(
      year
        .add(3)
        .div(4)
        .subtract(year.add(99).div(100))
        .add(year.add(399).div(400))
    )
  } else {
    epochDay = epochDay.subtract(
      year
        .div(-4)
        .subtract(year.div(-100))
        .add(year.div(-400))
    )
  }

  epochDay = epochDay.add(
    month
      .multiply(367)
      .subtract(362)
      .div(12)
  )
  epochDay = epochDay.add(day.subtract(1))
  if (month.greaterThan(2)) {
    epochDay = epochDay.subtract(1)
    if (!isLeapYear(year)) {
      epochDay = epochDay.subtract(1)
    }
  }
  return epochDay.subtract(DAYS_0000_TO_1970)
}

/**
 * Format given duration to an ISO 8601 string.
 * @param {Integer|number|string} months the number of months.
 * @param {Integer|number|string} days the number of days.
 * @param {Integer|number|string} seconds the number of seconds.
 * @param {Integer|number|string} nanoseconds the number of nanoseconds.
 * @return {string} ISO string that represents given duration.
 */
export function durationToIsoString (
  months: NumberOrInteger | string,
  days: NumberOrInteger | string,
  seconds: NumberOrInteger | string,
  nanoseconds: NumberOrInteger | string
): string {
  const monthsString = formatNumber(months)
  const daysString = formatNumber(days)
  const secondsAndNanosecondsString = formatSecondsAndNanosecondsForDuration(
    seconds,
    nanoseconds
  )
  return `P${monthsString}M${daysString}DT${secondsAndNanosecondsString}S`
}

/**
 * Formats given time to an ISO 8601 string.
 * @param {Integer|number|string} hour the hour value.
 * @param {Integer|number|string} minute the minute value.
 * @param {Integer|number|string} second the second value.
 * @param {Integer|number|string} nanosecond the nanosecond value.
 * @return {string} ISO string that represents given time.
 */
export function timeToIsoString (
  hour: NumberOrInteger | string,
  minute: NumberOrInteger | string,
  second: NumberOrInteger | string,
  nanosecond: NumberOrInteger | string
): string {
  const hourString = formatNumber(hour, 2)
  const minuteString = formatNumber(minute, 2)
  const secondString = formatNumber(second, 2)
  const nanosecondString = formatNanosecond(nanosecond)
  return `${hourString}:${minuteString}:${secondString}${nanosecondString}`
}

/**
 * Formats given time zone offset in seconds to string representation like '±HH:MM', '±HH:MM:SS' or 'Z' for UTC.
 * @param {Integer|number|string} offsetSeconds the offset in seconds.
 * @return {string} ISO string that represents given offset.
 */
export function timeZoneOffsetToIsoString (
  offsetSeconds: NumberOrInteger | string
): string {
  offsetSeconds = int(offsetSeconds)
  if (offsetSeconds.equals(0)) {
    return 'Z'
  }

  const isNegative = offsetSeconds.isNegative()
  if (isNegative) {
    offsetSeconds = offsetSeconds.multiply(-1)
  }
  const signPrefix = isNegative ? '-' : '+'

  const hours = formatNumber(offsetSeconds.div(SECONDS_PER_HOUR), 2)
  const minutes = formatNumber(
    offsetSeconds.div(SECONDS_PER_MINUTE).modulo(MINUTES_PER_HOUR),
    2
  )
  const secondsValue = offsetSeconds.modulo(SECONDS_PER_MINUTE)
  const seconds = secondsValue.equals(0) ? null : formatNumber(secondsValue, 2)

  return seconds
    ? `${signPrefix}${hours}:${minutes}:${seconds}`
    : `${signPrefix}${hours}:${minutes}`
}

/**
 * Formats given date to an ISO 8601 string.
 * @param {Integer|number|string} year the date year.
 * @param {Integer|number|string} month the date month.
 * @param {Integer|number|string} day the date day.
 * @return {string} ISO string that represents given date.
 */
export function dateToIsoString (
  year: NumberOrInteger | string,
  month: NumberOrInteger | string,
  day: NumberOrInteger | string
): string {
  year = int(year)
  const isNegative = year.isNegative()
  if (isNegative) {
    year = year.multiply(-1)
  }
  let yearString = formatNumber(year, 4)
  if (isNegative) {
    yearString = '-' + yearString
  }

  const monthString = formatNumber(month, 2)
  const dayString = formatNumber(day, 2)
  return `${yearString}-${monthString}-${dayString}`
}

/**
 * Get the total number of nanoseconds from the milliseconds of the given standard JavaScript date and optional nanosecond part.
 * @param {global.Date} standardDate the standard JavaScript date.
 * @param {Integer|number|bigint|undefined} nanoseconds the optional number of nanoseconds.
 * @return {Integer|number|bigint} the total amount of nanoseconds.
 */
export function totalNanoseconds (
  standardDate: Date,
  nanoseconds?: NumberOrInteger
): NumberOrInteger {
  nanoseconds = nanoseconds || 0
  const nanosFromMillis = standardDate.getMilliseconds() * NANOS_PER_MILLISECOND
  return add(nanoseconds, nanosFromMillis)
}

/**
 * Get the time zone offset in seconds from the given standard JavaScript date.
 *
 * <b>Implementation note:</b>
 * Time zone offset returned by the standard JavaScript date is the difference, in minutes, from local time to UTC.
 * So positive value means offset is behind UTC and negative value means it is ahead.
 * For Neo4j temporal types, like `Time` or `DateTime` offset is in seconds and represents difference from UTC to local time.
 * This is different from standard JavaScript dates and that's why implementation negates the returned value.
 *
 * @param {global.Date} standardDate the standard JavaScript date.
 * @return {number} the time zone offset in seconds.
 */
export function timeZoneOffsetInSeconds (standardDate: Date): number {
  const offsetInMinutes = standardDate.getTimezoneOffset()
  if (offsetInMinutes === 0) {
    return 0
  }
  return -1 * offsetInMinutes * SECONDS_PER_MINUTE
}

/**
 * Assert that the year value is valid.
 * @param {Integer|number} year the value to check.
 * @return {Integer|number} the value of the year if it is valid. Exception is thrown otherwise.
 */
export function assertValidYear (year: NumberOrInteger): NumberOrInteger {
  return assertValidTemporalValue(year, YEAR_RANGE, 'Year')
}

/**
 * Assert that the month value is valid.
 * @param {Integer|number} month the value to check.
 * @return {Integer|number} the value of the month if it is valid. Exception is thrown otherwise.
 */
export function assertValidMonth (month: NumberOrInteger): NumberOrInteger {
  return assertValidTemporalValue(month, MONTH_OF_YEAR_RANGE, 'Month')
}

/**
 * Assert that the day value is valid.
 * @param {Integer|number} day the value to check.
 * @return {Integer|number} the value of the day if it is valid. Exception is thrown otherwise.
 */
export function assertValidDay (day: NumberOrInteger): NumberOrInteger {
  return assertValidTemporalValue(day, DAY_OF_MONTH_RANGE, 'Day')
}

/**
 * Assert that the hour value is valid.
 * @param {Integer|number} hour the value to check.
 * @return {Integer|number} the value of the hour if it is valid. Exception is thrown otherwise.
 */
export function assertValidHour (hour: NumberOrInteger): NumberOrInteger {
  return assertValidTemporalValue(hour, HOUR_OF_DAY_RANGE, 'Hour')
}

/**
 * Assert that the minute value is valid.
 * @param {Integer|number} minute the value to check.
 * @return {Integer|number} the value of the minute if it is valid. Exception is thrown otherwise.
 */
export function assertValidMinute (minute: NumberOrInteger): NumberOrInteger {
  return assertValidTemporalValue(minute, MINUTE_OF_HOUR_RANGE, 'Minute')
}

/**
 * Assert that the second value is valid.
 * @param {Integer|number} second the value to check.
 * @return {Integer|number} the value of the second if it is valid. Exception is thrown otherwise.
 */
export function assertValidSecond (second: NumberOrInteger): NumberOrInteger {
  return assertValidTemporalValue(second, SECOND_OF_MINUTE_RANGE, 'Second')
}

/**
 * Assert that the nanosecond value is valid.
 * @param {Integer|number} nanosecond the value to check.
 * @return {Integer|number} the value of the nanosecond if it is valid. Exception is thrown otherwise.
 */
export function assertValidNanosecond (
  nanosecond: NumberOrInteger
): NumberOrInteger {
  return assertValidTemporalValue(
    nanosecond,
    NANOSECOND_OF_SECOND_RANGE,
    'Nanosecond'
  )
}

/**
 * Check if the given value is of expected type and is in the expected range.
 * @param {Integer|number} value the value to check.
 * @param {ValueRange} range the range.
 * @param {string} name the name of the value.
 * @return {Integer|number} the value if valid. Exception is thrown otherwise.
 */
function assertValidTemporalValue (
  value: NumberOrInteger,
  range: ValueRange,
  name: string
): NumberOrInteger {
  assertNumberOrInteger(value, name)
  if (!range.contains(value)) {
    throw newError(
      `${name} is expected to be in range ${range} but was: ${value}`
    )
  }
  return value
}

/**
 * Converts given local time into a single integer representing this same time in seconds of the day. Nanoseconds are skipped.
 * @param {Integer|number|string} hour the hour of the local time.
 * @param {Integer|number|string} minute the minute of the local time.
 * @param {Integer|number|string} second the second of the local time.
 * @return {Integer} seconds representing the given local time.
 */
function localTimeToSecondOfDay (
  hour: NumberOrInteger | string,
  minute: NumberOrInteger | string,
  second: NumberOrInteger | string
): Integer {
  hour = int(hour)
  minute = int(minute)
  second = int(second)

  let totalSeconds = hour.multiply(SECONDS_PER_HOUR)
  totalSeconds = totalSeconds.add(minute.multiply(SECONDS_PER_MINUTE))
  return totalSeconds.add(second)
}

/**
 * Check if given year is a leap year. Uses algorithm described here {@link https://en.wikipedia.org/wiki/Leap_year#Algorithm}.
 * @param {Integer|number|string} year the year to check. Will be converted to {@link Integer} for all calculations.
 * @return {boolean} `true` if given year is a leap year, `false` otherwise.
 */
function isLeapYear (year: NumberOrInteger | string): boolean {
  year = int(year)

  if (!year.modulo(4).equals(0)) {
    return false
  } else if (!year.modulo(100).equals(0)) {
    return true
  } else if (!year.modulo(400).equals(0)) {
    return false
  } else {
    return true
  }
}

/**
 * @param {Integer|number|string} x the divident.
 * @param {Integer|number|string} y the divisor.
 * @return {Integer} the result.
 */
export function floorDiv (
  x: NumberOrInteger | string,
  y: NumberOrInteger | string
): Integer {
  x = int(x)
  y = int(y)

  let result = x.div(y)
  if (x.isPositive() !== y.isPositive() && result.multiply(y).notEquals(x)) {
    result = result.subtract(1)
  }
  return result
}

/**
 * @param {Integer|number|string} x the divident.
 * @param {Integer|number|string} y the divisor.
 * @return {Integer} the result.
 */
export function floorMod (
  x: NumberOrInteger | string,
  y: NumberOrInteger | string
): Integer {
  x = int(x)
  y = int(y)

  return x.subtract(floorDiv(x, y).multiply(y))
}

/**
 * @param {Integer|number|string} seconds the number of seconds to format.
 * @param {Integer|number|string} nanoseconds the number of nanoseconds to format.
 * @return {string} formatted value.
 */
function formatSecondsAndNanosecondsForDuration (
  seconds: NumberOrInteger | string,
  nanoseconds: NumberOrInteger | string
): string {
  seconds = int(seconds)
  nanoseconds = int(nanoseconds)

  let secondsString
  let nanosecondsString

  const secondsNegative = seconds.isNegative()
  const nanosecondsGreaterThanZero = nanoseconds.greaterThan(0)
  if (secondsNegative && nanosecondsGreaterThanZero) {
    if (seconds.equals(-1)) {
      secondsString = '-0'
    } else {
      secondsString = seconds.add(1).toString()
    }
  } else {
    secondsString = seconds.toString()
  }

  if (nanosecondsGreaterThanZero) {
    if (secondsNegative) {
      nanosecondsString = formatNanosecond(
        nanoseconds
          .negate()
          .add(2 * NANOS_PER_SECOND)
          .modulo(NANOS_PER_SECOND)
      )
    } else {
      nanosecondsString = formatNanosecond(
        nanoseconds.add(NANOS_PER_SECOND).modulo(NANOS_PER_SECOND)
      )
    }
  }

  return nanosecondsString ? secondsString + nanosecondsString : secondsString
}

/**
 * @param {Integer|number|string} value the number of nanoseconds to format.
 * @return {string} formatted and possibly left-padded nanoseconds part as string.
 */
function formatNanosecond (value: NumberOrInteger | string): string {
  value = int(value)
  return value.equals(0) ? '' : '.' + formatNumber(value, 9)
}

/**
 * @param {Integer|number|string} num the number to format.
 * @param {number} [stringLength=undefined] the string length to left-pad to.
 * @return {string} formatted and possibly left-padded number as string.
 */
function formatNumber (
  num: NumberOrInteger | string,
  stringLength?: number
): string {
  num = int(num)
  const isNegative = num.isNegative()
  if (isNegative) {
    num = num.negate()
  }

  let numString = num.toString()
  if (stringLength) {
    // left pad the string with zeroes
    while (numString.length < stringLength) {
      numString = '0' + numString
    }
  }
  return isNegative ? '-' + numString : numString
}

function add (x: NumberOrInteger, y: number): NumberOrInteger {
  if (x instanceof Integer) {
    return x.add(y)
  } else if (typeof x === 'bigint') {
    return x + BigInt(y)
  }
  return x + y
}

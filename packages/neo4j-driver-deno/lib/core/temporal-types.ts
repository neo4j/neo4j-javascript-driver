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

import * as util from './internal/temporal-util.ts'
import { NumberOrInteger, StandardDate } from './graph-types.ts'
import {
  assertNumberOrInteger,
  assertString,
  assertValidDate
} from './internal/util.ts'
import { newError } from './error.ts'
import Integer, { int, toNumber, isInt } from './integer.ts'

const IDENTIFIER_PROPERTY_ATTRIBUTES = {
  value: true,
  enumerable: false,
  configurable: false,
  writable: false
}

const DURATION_IDENTIFIER_PROPERTY: string = '__isDuration__'
const LOCAL_TIME_IDENTIFIER_PROPERTY: string = '__isLocalTime__'
const TIME_IDENTIFIER_PROPERTY: string = '__isTime__'
const DATE_IDENTIFIER_PROPERTY: string = '__isDate__'
const LOCAL_DATE_TIME_IDENTIFIER_PROPERTY: string = '__isLocalDateTime__'
const DATE_TIME_IDENTIFIER_PROPERTY: string = '__isDateTime__'

/**
 * Represents an ISO 8601 duration. Contains both date-based values (years, months, days) and time-based values (seconds, nanoseconds).
 * Created `Duration` objects are frozen with `Object.freeze()` in constructor and thus immutable.
 */
export class Duration<T extends NumberOrInteger = Integer> {
  readonly months: T
  readonly days: T
  readonly seconds: T
  readonly nanoseconds: T

  /**
   * @constructor
   * @param {NumberOrInteger} months - The number of months for the new duration.
   * @param {NumberOrInteger} days - The number of days for the new duration.
   * @param {NumberOrInteger} seconds - The number of seconds for the new duration.
   * @param {NumberOrInteger} nanoseconds - The number of nanoseconds for the new duration.
   */
  constructor (months: T, days: T, seconds: T, nanoseconds: T) {
    /**
     * The number of months.
     * @type {NumberOrInteger}
     */
    this.months = assertNumberOrInteger(months, 'Months') as T
    /**
     * The number of days.
     * @type {NumberOrInteger}
     */
    this.days = assertNumberOrInteger(days, 'Days') as T
    assertNumberOrInteger(seconds, 'Seconds')
    assertNumberOrInteger(nanoseconds, 'Nanoseconds')
    /**
     * The number of seconds.
     * @type {NumberOrInteger}
     */
    this.seconds = util.normalizeSecondsForDuration(seconds, nanoseconds) as T
    if (typeof seconds === 'number' && isInt(this.seconds)) {
      this.seconds = this.seconds.toNumber() as T
    }
    if (typeof seconds === 'bigint' && isInt(this.seconds)) {
      this.seconds = this.seconds.toBigInt() as T
    }
    /**
     * The number of nanoseconds.
     * @type {NumberOrInteger}
     */
    this.nanoseconds = util.normalizeNanosecondsForDuration(nanoseconds) as T
    if (typeof nanoseconds === 'number' && isInt(this.nanoseconds)) {
      this.nanoseconds = this.nanoseconds.toNumber() as T
    }
    if (typeof nanoseconds === 'bigint' && isInt(this.nanoseconds)) {
      this.nanoseconds = this.nanoseconds.toBigInt() as T
    }
    Object.freeze(this)
  }

  /**
   * Creates a {@link Duration} from an ISO 8601 string
   * NOTE: Bolt transmits durations as 4 integers: Months, Days, Seconds and Nanoseconds. Parsing strings like P1.5M4.3D will throw an error. P0.5Y can be sent as it can be simplified as 6 months.
   *
   * @param {string} str The string to convert
   * @returns {Duration<NumberOrInteger>}
   */
  static fromString (str: string): Duration<Integer> {
    const matches = String(str.replace(/,/g, '.')).match(/^([-|+]?)[P|p](?:(-?[\d]*\.?[\d]*)[Y|y])?(?:(-?[\d]*\.?[\d]*)[M|m])?(?:(-?[\d]*\.?[\d]*)[W|w])?(?:(-?[\d]*\.?[\d]*)[D|d])?([T|t](?:(-?[\d]*\.?[\d]*)[H|h])?(?:(-?[\d]*\.?[\d]*)[M|m])?(?:(-)?([\d]*)(\.[\d]*)?[S|s])?)?$/)
    if (matches !== null) {
      if (
        matches[2] == null && matches[3] == null && matches[4] == null && matches[5] == null &&
        matches[7] == null && matches[8] == null && matches[10] == null && matches[11] == null
      ) {
        throw newError(`Duration could not be parsed from string: ${str}`)
      }
      const negativeDuration = matches[1] === '-' ? -1 : 1
      const months = negativeDuration * parseTemporalFloat(matches[2], 'Years') * 12 + parseTemporalFloat(matches[3], 'Months')
      const days = negativeDuration * parseTemporalFloat(matches[4], 'Weeks') * 7 + parseTemporalFloat(matches[5], 'Days')
      const hoursAndMinutes = (parseTemporalFloat(matches[7], 'Hours') * 3600 + parseTemporalFloat(matches[8], 'Minutes') * 60)
      const seconds = parseTemporalInt((matches[9] ?? '') + (matches[10] ?? '0'), 'seconds')
      const nanos = negativeDuration * parseDurationNanos((matches[9] ?? '') + '0' + (matches[11] ?? ''))
      checkDurationFieldIsInt(months, 'Months')
      checkDurationFieldIsInt(days, 'Days')
      checkDurationFieldIsInt(hoursAndMinutes, 'Seconds')
      checkDurationFieldIsInt(nanos, 'Nanoseconds')
      return new Duration(int(months), int(days), int(BigInt(negativeDuration) * (BigInt(hoursAndMinutes) + seconds.toBigInt())), int(nanos))
    }
    throw newError(`Duration could not be parsed from string: ${str}`)
  }

  /**
   * @ignore
   */
  toString (): string {
    return util.durationToIsoString(
      this.months,
      this.days,
      this.seconds,
      this.nanoseconds
    )
  }
}

Object.defineProperty(
  Duration.prototype,
  DURATION_IDENTIFIER_PROPERTY,
  IDENTIFIER_PROPERTY_ATTRIBUTES
)

/**
 * Test if given object is an instance of {@link Duration} class.
 * @param {Object} obj the object to test.
 * @return {boolean} `true` if given object is a {@link Duration}, `false` otherwise.
 */
export function isDuration<T extends NumberOrInteger = Integer> (obj: unknown): obj is Duration<T> {
  return hasIdentifierProperty(obj, DURATION_IDENTIFIER_PROPERTY)
}

/**
 * Represents an instant capturing the time of day, but not the date, nor the timezone.
 * Created {@link LocalTime} objects are frozen with `Object.freeze()` in constructor and thus immutable.
 */
export class LocalTime<T extends NumberOrInteger = Integer> {
  readonly hour: T
  readonly minute: T
  readonly second: T
  readonly nanosecond: T
  /**
   * @constructor
   * @param {NumberOrInteger} hour - The hour for the new local time.
   * @param {NumberOrInteger} minute - The minute for the new local time.
   * @param {NumberOrInteger} second - The second for the new local time.
   * @param {NumberOrInteger} nanosecond - The nanosecond for the new local time.
   */
  constructor (hour: T, minute: T, second: T, nanosecond: T) {
    /**
     * The hour.
     * @type {NumberOrInteger}
     */
    this.hour = util.assertValidHour(hour) as T
    /**
     * The minute.
     * @type {NumberOrInteger}
     */
    this.minute = util.assertValidMinute(minute) as T
    /**
     * The second.
     * @type {NumberOrInteger}
     */
    this.second = util.assertValidSecond(second) as T
    /**
     * The nanosecond.
     * @type {NumberOrInteger}
     */
    this.nanosecond = util.assertValidNanosecond(nanosecond) as T
    Object.freeze(this)
  }

  /**
   * Create a {@link LocalTime} object from the given standard JavaScript `Date` and optional nanoseconds.
   * Year, month, day and time zone offset components of the given date are ignored.
   * @param {global.Date} standardDate - The standard JavaScript date to convert.
   * @param {NumberOrInteger|undefined} nanosecond - The optional amount of nanoseconds.
   * @return {LocalTime<number>} New LocalTime.
   */
  static fromStandardDate (
    standardDate: StandardDate,
    nanosecond?: NumberOrInteger
  ): LocalTime<number> {
    verifyStandardDateAndNanos(standardDate, nanosecond)

    const totalNanoseconds: number | Integer | bigint = util.totalNanoseconds(
      standardDate,
      nanosecond
    )

    return new LocalTime(
      standardDate.getHours(),
      standardDate.getMinutes(),
      standardDate.getSeconds(),
      totalNanoseconds instanceof Integer
        ? totalNanoseconds.toInt()
        : typeof totalNanoseconds === 'bigint'
          ? int(totalNanoseconds).toInt()
          : totalNanoseconds
    )
  }

  /**
   * @ignore
   */
  toString (): string {
    return util.timeToIsoString(
      this.hour,
      this.minute,
      this.second,
      this.nanosecond
    )
  }

  /**
   * Creates a {@link LocalTime} from an ISO 8601 string
   *
   * @param {string} str The string to convert
   * @returns {LocalTime<NumberOrInteger>}
   */
  static fromString (str: string): LocalTime<Integer> {
    const values = String(str.replace(/,/g, '.')).match(/^T?(\d{2}):?(\d{2})?:?(\d{2})?(\.\d+)?$/)
    if (values !== null) {
      const [hours, minutes, seconds, nanoseconds] = handleTimeDecimals(values[1], values[2], values[3], values[4])
      return new LocalTime(
        hours,
        minutes,
        seconds,
        nanoseconds
      )
    }
    throw newError('LocalTime could not be parsed from string')
  }
}

Object.defineProperty(
  LocalTime.prototype,
  LOCAL_TIME_IDENTIFIER_PROPERTY,
  IDENTIFIER_PROPERTY_ATTRIBUTES
)

/**
 * Test if given object is an instance of {@link LocalTime} class.
 * @param {Object} obj the object to test.
 * @return {boolean} `true` if given object is a {@link LocalTime}, `false` otherwise.
 */
export function isLocalTime<T extends NumberOrInteger = Integer> (obj: unknown): obj is LocalTime<T> {
  return hasIdentifierProperty(obj, LOCAL_TIME_IDENTIFIER_PROPERTY)
}

/**
 * Represents an instant capturing the time of day, and the timezone offset in seconds, but not the date.
 * Created {@link Time} objects are frozen with `Object.freeze()` in constructor and thus immutable.
 */
export class Time<T extends NumberOrInteger = Integer> {
  readonly hour: T
  readonly minute: T
  readonly second: T
  readonly nanosecond: T
  readonly timeZoneOffsetSeconds: T
  /**
   * @constructor
   * @param {NumberOrInteger} hour - The hour for the new local time.
   * @param {NumberOrInteger} minute - The minute for the new local time.
   * @param {NumberOrInteger} second - The second for the new local time.
   * @param {NumberOrInteger} nanosecond - The nanosecond for the new local time.
   * @param {NumberOrInteger} timeZoneOffsetSeconds - The time zone offset in seconds. Value represents the difference, in seconds, from UTC to local time.
   * This is different from standard JavaScript `Date.getTimezoneOffset()` which is the difference, in minutes, from local time to UTC.
   */
  constructor (
    hour: T,
    minute: T,
    second: T,
    nanosecond: T,
    timeZoneOffsetSeconds: T
  ) {
    /**
     * The hour.
     * @type {NumberOrInteger}
     */
    this.hour = util.assertValidHour(hour) as T
    /**
     * The minute.
     * @type {NumberOrInteger}
     */
    this.minute = util.assertValidMinute(minute) as T
    /**
     * The second.
     * @type {NumberOrInteger}
     */
    this.second = util.assertValidSecond(second) as T
    /**
     * The nanosecond.
     * @type {NumberOrInteger}
     */
    this.nanosecond = util.assertValidNanosecond(nanosecond) as T
    /**
     * The time zone offset in seconds.
     * @type {NumberOrInteger}
     */
    this.timeZoneOffsetSeconds = assertNumberOrInteger(
      timeZoneOffsetSeconds,
      'Time zone offset in seconds'
    ) as T
    Object.freeze(this)
  }

  /**
   * Create a {@link Time} object from the given standard JavaScript `Date` and optional nanoseconds.
   * Year, month and day components of the given date are ignored.
   * @param {global.Date} standardDate - The standard JavaScript date to convert.
   * @param {NumberOrInteger|undefined} nanosecond - The optional amount of nanoseconds.
   * @return {Time<number>} New Time.
   */
  static fromStandardDate (
    standardDate: StandardDate,
    nanosecond?: NumberOrInteger
  ): Time<number> {
    verifyStandardDateAndNanos(standardDate, nanosecond)

    return new Time(
      standardDate.getHours(),
      standardDate.getMinutes(),
      standardDate.getSeconds(),
      toNumber(util.totalNanoseconds(standardDate, nanosecond)),
      util.timeZoneOffsetInSeconds(standardDate)
    )
  }

  /**
   * @ignore
   */
  toString (): string {
    return (
      util.timeToIsoString(
        this.hour,
        this.minute,
        this.second,
        this.nanosecond
      ) + util.timeZoneOffsetToIsoString(this.timeZoneOffsetSeconds)
    )
  }

  /**
   * Creates a {@link Time} from an ISO 8601 string.
   *
   * @param {string} str The string to convert
   * @returns {Time<NumberOrInteger>}
   */
  static fromString (str: string): Time<Integer> {
    const values = String(str.replace(/,/g, '.')).match(/^[T|t]?(\d{2}):?(\d{2})?:?(\d{2})?(\.\d+)?(Z|\+|-)(\d{0,2}):?(\d{0,2}):?(\d{0,2})$/)
    if (values !== null) {
      const [hours, minutes, seconds, nanoseconds] = handleTimeDecimals(values[1], values[2], values[3], values[4])
      if (values[5] === 'Z') {
        return new Time(
          hours,
          minutes,
          seconds,
          nanoseconds,
          int(0)
        )
      }
      return new Time<Integer>(
        hours,
        minutes,
        seconds,
        nanoseconds,
        int((values[5] === '+' ? 1 : -1) * (
          parseTemporalInt(values[6], 'timezone offset hours').toInt() * 3600 +
          parseTemporalInt(values[7], 'timezone offset minutes').toInt() * 60 +
          parseTemporalInt(values[8], 'timezone offset seconds').toInt()
        ))
      )
    }
    throw newError('Time could not be parsed from string')
  }
}

Object.defineProperty(
  Time.prototype,
  TIME_IDENTIFIER_PROPERTY,
  IDENTIFIER_PROPERTY_ATTRIBUTES
)

/**
 * Test if given object is an instance of {@link Time} class.
 * @param {Object} obj the object to test.
 * @return {boolean} `true` if given object is a {@link Time}, `false` otherwise.
 */
export function isTime<T extends NumberOrInteger = Integer> (obj: unknown): obj is Time<T> {
  return hasIdentifierProperty(obj, TIME_IDENTIFIER_PROPERTY)
}

/**
 * Represents an instant capturing the date, but not the time, nor the timezone.
 * Created {@link Date} objects are frozen with `Object.freeze()` in constructor and thus immutable.
 */
export class Date<T extends NumberOrInteger = Integer> {
  readonly year: T
  readonly month: T
  readonly day: T
  /**
   * @constructor
   * @param {NumberOrInteger} year - The year for the new local date.
   * @param {NumberOrInteger} month - The month for the new local date.
   * @param {NumberOrInteger} day - The day for the new local date.
   */
  constructor (year: T, month: T, day: T) {
    /**
     * The year.
     * @type {NumberOrInteger}
     */
    this.year = util.assertValidYear(year) as T
    /**
     * The month.
     * @type {NumberOrInteger}
     */
    this.month = util.assertValidMonth(month) as T
    /**
     * The day.
     * @type {NumberOrInteger}
     */
    this.day = util.assertValidDay(day) as T
    Object.freeze(this)
  }

  /**
   * Create a {@link Date} object from the given standard JavaScript `Date`.
   * Hour, minute, second and millisecond components of the given date are ignored.
   *
   * NOTE: the function {@link toStandardDate} and {@link fromStandardDate} are not inverses of one another. {@link fromStandardDate} takes the Day, Month and Year in local time from the supplied JavaScript Date object, while {@link toStandardDate} creates a new JavaScript Date object at midnight UTC.
   *
   * @param {global.Date} standardDate - The standard JavaScript date to convert.
   * @return {Date} New Date.
   * @deprecated use {@link fromStandardDateLocal} which is a drop in replacement, or {@link fromStandardDateUTC} which takes the Year, Month and Date from UTC rather than Local time
   */
  static fromStandardDate (standardDate: StandardDate): Date<number> {
    return this.fromStandardDateLocal(standardDate)
  }

  /**
   * Create a {@link Date} object from the given standard JavaScript `Date` using the Year, Month and Date in Local Time.
   * Hour, minute, second and millisecond components of the given date are ignored.
   *
   * NOTE: this function and {@link toStandardDate} are not inverses of one another.
   * This takes the Day, Month and Year in local time from the supplied JavaScript Date object, while {@link toStandardDate} creates a new JavaScript Date object at midnight UTC.
   * For a more global approach, use {@link fromStandardDateUTC}, which reads the date in UTC time.
   *
   * @example
   * fromStandardDateLocal(new Date("2010-10-10T00:00:00")) // Will create a date at 2010-10-10 as JS Dates are created at local time by default
   * fromStandardDateLocal(new Date("2010-10-10T00:00:00Z")) // This may cause issues as this date is created at UTC with the trailing "Z"
   *
   * @param {global.Date} standardDate - The standard JavaScript date to convert.
   * @return {Date} New Date.
   */
  static fromStandardDateLocal (standardDate: StandardDate): Date<number> {
    verifyStandardDateAndNanos(standardDate)

    return new Date(
      standardDate.getFullYear(),
      standardDate.getMonth() + 1,
      standardDate.getDate()
    )
  }

  /**
   * Create a {@link Date} object from the given standard JavaScript `Date` using the Year, Month and Date in UTC time.
   * Hour, minute, second and millisecond components of the given date are ignored.
   *
   * @example
   * fromStandardDateUTC(new Date("2010-10-10T00:00:00")) // This may cause issues as JS Dates are created at local time by default
   * fromStandardDateUTC(new Date("2010-10-10T00:00:00Z")) // Will create a date at 2010-10-10 as this date is created at UTC with the trailing "Z"
   *
   * @param {global.Date} standardDate - The standard JavaScript date to convert.
   * @return {Date} New Date.
   */
  static fromStandardDateUTC (standardDate: StandardDate): Date<number> {
    verifyStandardDateAndNanos(standardDate)

    return new Date(
      standardDate.getUTCFullYear(),
      standardDate.getUTCMonth() + 1,
      standardDate.getUTCDate()
    )
  }

  /**
   * Convert date to standard JavaScript `Date`.
   *
   * The time component of the returned `Date` is set to midnight
   * and the time zone is set to UTC.
   *
   * @returns {StandardDate} Standard JavaScript `Date` at `00:00:00.000` UTC.
   */
  toStandardDate (): StandardDate {
    return util.isoStringToStandardDate(this.toString())
  }

  /**
   * @ignore
   */
  toString (): string {
    return util.dateToIsoString(this.year, this.month, this.day)
  }
}

Object.defineProperty(
  Date.prototype,
  DATE_IDENTIFIER_PROPERTY,
  IDENTIFIER_PROPERTY_ATTRIBUTES
)

/**
 * Test if given object is an instance of {@link Date} class.
 * @param {Object} obj - The object to test.
 * @return {boolean} `true` if given object is a {@link Date}, `false` otherwise.
 */
export function isDate<T extends NumberOrInteger = Integer> (obj: unknown): obj is Date<T> {
  return hasIdentifierProperty(obj, DATE_IDENTIFIER_PROPERTY)
}

/**
 * Represents an instant capturing the date and the time, but not the timezone.
 * Created {@link LocalDateTime} objects are frozen with `Object.freeze()` in constructor and thus immutable.
 */
export class LocalDateTime<T extends NumberOrInteger = Integer> {
  readonly year: T
  readonly month: T
  readonly day: T
  readonly hour: T
  readonly minute: T
  readonly second: T
  readonly nanosecond: T
  /**
   * @constructor
   * @param {NumberOrInteger} year - The year for the new local date.
   * @param {NumberOrInteger} month - The month for the new local date.
   * @param {NumberOrInteger} day - The day for the new local date.
   * @param {NumberOrInteger} hour - The hour for the new local time.
   * @param {NumberOrInteger} minute - The minute for the new local time.
   * @param {NumberOrInteger} second - The second for the new local time.
   * @param {NumberOrInteger} nanosecond - The nanosecond for the new local time.
   */
  constructor (
    year: T,
    month: T,
    day: T,
    hour: T,
    minute: T,
    second: T,
    nanosecond: T
  ) {
    /**
     * The year.
     * @type {NumberOrInteger}
     */
    this.year = util.assertValidYear(year) as T
    /**
     * The month.
     * @type {NumberOrInteger}
     */
    this.month = util.assertValidMonth(month) as T
    /**
     * The day.
     * @type {NumberOrInteger}
     */
    this.day = util.assertValidDay(day) as T
    /**
     * The hour.
     * @type {NumberOrInteger}
     */
    this.hour = util.assertValidHour(hour) as T
    /**
     * The minute.
     * @type {NumberOrInteger}
     */
    this.minute = util.assertValidMinute(minute) as T
    /**
     * The second.
     * @type {NumberOrInteger}
     */
    this.second = util.assertValidSecond(second) as T
    /**
     * The nanosecond.
     * @type {NumberOrInteger}
     */
    this.nanosecond = util.assertValidNanosecond(nanosecond) as T
    Object.freeze(this)
  }

  /**
   * Create a {@link LocalDateTime} object from the given standard JavaScript `Date` and optional nanoseconds.
   * Time zone offset component of the given date is ignored.
   * @param {global.Date} standardDate - The standard JavaScript date to convert.
   * @param {NumberOrInteger|undefined} nanosecond - The optional amount of nanoseconds.
   * @return {LocalDateTime} New LocalDateTime.
   */
  static fromStandardDate (
    standardDate: StandardDate,
    nanosecond?: NumberOrInteger
  ): LocalDateTime<number> {
    verifyStandardDateAndNanos(standardDate, nanosecond)

    return new LocalDateTime(
      standardDate.getFullYear(),
      standardDate.getMonth() + 1,
      standardDate.getDate(),
      standardDate.getHours(),
      standardDate.getMinutes(),
      standardDate.getSeconds(),
      toNumber(util.totalNanoseconds(standardDate, nanosecond))
    )
  }

  /**
   * Convert date to standard JavaScript `Date`.
   *
   * @returns {StandardDate} Standard JavaScript `Date` at the local timezone
   */
  toStandardDate (): StandardDate {
    return util.isoStringToStandardDate(this.toString())
  }

  /**
   * @ignore
   */
  toString (): string {
    return localDateTimeToString(
      this.year,
      this.month,
      this.day,
      this.hour,
      this.minute,
      this.second,
      this.nanosecond
    )
  }

  /**
   * Creates a {@link LocalDateTime} from an ISO 8601 string
   *
   * @param {string} str The string to convert
   * @returns {LocalDateTime<NumberOrInteger>}
   */
  static fromString (str: string): LocalDateTime<Integer> {
    const values = String(str.replace(/,/g, '.')).match(/^(\d+)-(\d+)-(\d+)[T|t](\d{2}):?(\d{2})?:?(\d{2})?(\.\d+)?$/)
    if (values !== null) {
      const [hours, minutes, seconds, nanoseconds] = handleTimeDecimals(values[4], values[5], values[6], values[7])
      return new LocalDateTime(
        parseTemporalInt(values[1], 'years'),
        parseTemporalInt(values[2], 'months'),
        parseTemporalInt(values[3], 'days'),
        hours,
        minutes,
        seconds,
        nanoseconds
      )
    }
    throw newError('LocalDateTime could not be parsed from string')
  }
}

Object.defineProperty(
  LocalDateTime.prototype,
  LOCAL_DATE_TIME_IDENTIFIER_PROPERTY,
  IDENTIFIER_PROPERTY_ATTRIBUTES
)

/**
 * Test if given object is an instance of {@link LocalDateTime} class.
 * @param {Object} obj - The object to test.
 * @return {boolean} `true` if given object is a {@link LocalDateTime}, `false` otherwise.
 */
export function isLocalDateTime<T extends NumberOrInteger = Integer> (obj: unknown): obj is LocalDateTime<T> {
  return hasIdentifierProperty(obj, LOCAL_DATE_TIME_IDENTIFIER_PROPERTY)
}

/**
 * Represents an instant capturing the date, the time and the timezone identifier.
 * Created {@ DateTime} objects are frozen with `Object.freeze()` in constructor and thus immutable.
 */
export class DateTime<T extends NumberOrInteger = Integer> {
  readonly year: T
  readonly month: T
  readonly day: T
  readonly hour: T
  readonly minute: T
  readonly second: T
  readonly nanosecond: T
  readonly timeZoneOffsetSeconds?: T
  readonly timeZoneId?: string
  /**
   * @constructor
   * @param {NumberOrInteger} year - The year for the new date-time.
   * @param {NumberOrInteger} month - The month for the new date-time.
   * @param {NumberOrInteger} day - The day for the new date-time.
   * @param {NumberOrInteger} hour - The hour for the new date-time.
   * @param {NumberOrInteger} minute - The minute for the new date-time.
   * @param {NumberOrInteger} second - The second for the new date-time.
   * @param {NumberOrInteger} nanosecond - The nanosecond for the new date-time.
   * @param {NumberOrInteger} timeZoneOffsetSeconds - The time zone offset in seconds. Either this argument or `timeZoneId` should be defined.
   * Value represents the difference, in seconds, from UTC to local time.
   * This is different from standard JavaScript `Date.getTimezoneOffset()` which is the difference, in minutes, from local time to UTC.
   * @param {string|null} timeZoneId - The time zone id for the new date-time. Either this argument or `timeZoneOffsetSeconds` should be defined.
   */
  constructor (
    year: T,
    month: T,
    day: T,
    hour: T,
    minute: T,
    second: T,
    nanosecond: T,
    timeZoneOffsetSeconds?: T,
    timeZoneId?: string | null
  ) {
    /**
     * The year.
     * @type {NumberOrInteger}
     */
    this.year = util.assertValidYear(year) as T
    /**
     * The month.
     * @type {NumberOrInteger}
     */
    this.month = util.assertValidMonth(month) as T
    /**
     * The day.
     * @type {NumberOrInteger}
     */
    this.day = util.assertValidDay(day) as T
    /**
     * The hour.
     * @type {NumberOrInteger}
     */
    this.hour = util.assertValidHour(hour) as T
    /**
     * The minute.
     * @type {NumberOrInteger}
     */
    this.minute = util.assertValidMinute(minute) as T
    /**
     * The second.
     * @type {NumberOrInteger}
     */
    this.second = util.assertValidSecond(second) as T
    /**
     * The nanosecond.
     * @type {NumberOrInteger}
     */
    this.nanosecond = util.assertValidNanosecond(nanosecond) as T

    const [offset, id] = verifyTimeZoneArguments(
      timeZoneOffsetSeconds,
      timeZoneId
    )
    /**
     * The time zone offset in seconds.
     *
     * *Either this or {@link timeZoneId} is defined.*
     *
     * @type {NumberOrInteger}
     */
    this.timeZoneOffsetSeconds = offset as T
    /**
     * The time zone id.
     *
     * *Either this or {@link timeZoneOffsetSeconds} is defined.*
     *
     * @type {string}
     */
    this.timeZoneId = id ?? undefined

    Object.freeze(this)
  }

  /**
   * Create a {@link DateTime} object from the given standard JavaScript `Date` and optional nanoseconds.
   * @param {global.Date} standardDate - The standard JavaScript date to convert.
   * @param {NumberOrInteger|undefined} nanosecond - The optional amount of nanoseconds.
   * @return {DateTime} New DateTime.
   */
  static fromStandardDate (
    standardDate: StandardDate,
    nanosecond?: NumberOrInteger
  ): DateTime<number> {
    verifyStandardDateAndNanos(standardDate, nanosecond)

    return new DateTime(
      standardDate.getFullYear(),
      standardDate.getMonth() + 1,
      standardDate.getDate(),
      standardDate.getHours(),
      standardDate.getMinutes(),
      standardDate.getSeconds(),
      toNumber(util.totalNanoseconds(standardDate, nanosecond)),
      util.timeZoneOffsetInSeconds(standardDate),
      null /* no time zone id */
    )
  }

  /**
   * Convert date to standard JavaScript `Date`.
   *
   * @returns {StandardDate} Standard JavaScript `Date` at the defined time zone offset
   * @throws {Error} If the time zone offset is not defined in the object.
   */
  toStandardDate (): StandardDate {
    return util.toStandardDate(this._toUTC())
  }

  /**
   * @ignore
   */
  toString (): string {
    const localDateTimeStr = localDateTimeToString(
      this.year,
      this.month,
      this.day,
      this.hour,
      this.minute,
      this.second,
      this.nanosecond
    )

    const timeOffset = this.timeZoneOffsetSeconds != null
      ? util.timeZoneOffsetToIsoString(this.timeZoneOffsetSeconds ?? 0)
      : ''

    const timeZoneStr = this.timeZoneId != null
      ? `[${this.timeZoneId}]`
      : ''

    return localDateTimeStr + timeOffset + timeZoneStr
  }

  /**
   * Creates a {@link DateTime} from an ISO 8601 string
   *
   * @param {string} str The string to convert
   * @returns {DateTime<NumberOrInteger>}
   */
  static fromString (str: string): DateTime<Integer> {
    const values = String(str.replace(/,/g, '.')).match(/^(\d+)-(\d+)-(\d+)[T|t](\d{2}):?(\d{2})?:?(\d{2})?(\.\d+)?(Z|\+|-)?(\d{0,2}):?(\d{0,2}):?(\d{0,2})?((\[)([^\]]*)(\]))?$/)
    if (values !== null) {
      const [hours, minutes, seconds, nanoseconds] = handleTimeDecimals(values[4], values[5], values[6], values[7])
      if (values[8] === 'Z') {
        return new DateTime(
          parseTemporalInt(values[1], 'years'),
          parseTemporalInt(values[2], 'months'),
          parseTemporalInt(values[3], 'days'),
          hours,
          minutes,
          seconds,
          nanoseconds,
          int(0)
        )
      }
      if (values[8] === '+' || values[8] === '-') {
        return new DateTime<Integer>(
          parseTemporalInt(values[1], 'years'),
          parseTemporalInt(values[2], 'months'),
          parseTemporalInt(values[3], 'days'),
          hours,
          minutes,
          seconds,
          nanoseconds,
          int((values[8] === '+' ? 1 : -1) * (parseInt(values[9]) * 3600 + parseInt(values[10]) * 60 + parseInt('0' + values[11])))
        )
      }
      if (values[14] !== undefined) {
        return new DateTime(
          parseTemporalInt(values[1], 'years'),
          parseTemporalInt(values[2], 'months'),
          parseTemporalInt(values[3], 'days'),
          hours,
          minutes,
          seconds,
          nanoseconds,
          undefined,
          values[14]
        )
      }
    }
    throw newError('DateTime could not be parsed from string')
  }

  /**
   * @private
   * @returns {number}
   */
  private _toUTC (): number {
    if (this.timeZoneOffsetSeconds === undefined) {
      throw new Error('Requires DateTime created with time zone offset')
    }
    const epochSecond = util.localDateTimeToEpochSecond(
      this.year,
      this.month,
      this.day,
      this.hour,
      this.minute,
      this.second,
      this.nanosecond
    )

    const utcSecond = epochSecond.subtract(this.timeZoneOffsetSeconds ?? 0)

    return int(utcSecond)
      .multiply(1000)
      .add(int(this.nanosecond).div(1_000_000))
      .toNumber()
  }
}

Object.defineProperty(
  DateTime.prototype,
  DATE_TIME_IDENTIFIER_PROPERTY,
  IDENTIFIER_PROPERTY_ATTRIBUTES
)

/**
 * Test if given object is an instance of {@link DateTime} class.
 * @param {Object} obj - The object to test.
 * @return {boolean} `true` if given object is a {@link DateTime}, `false` otherwise.
 */
export function isDateTime<T extends NumberOrInteger = Integer> (obj: unknown): obj is DateTime<T> {
  return hasIdentifierProperty(obj, DATE_TIME_IDENTIFIER_PROPERTY)
}

function hasIdentifierProperty (obj: any, property: string): boolean {
  return obj != null && obj[property] === true
}

function localDateTimeToString (
  year: NumberOrInteger,
  month: NumberOrInteger,
  day: NumberOrInteger,
  hour: NumberOrInteger,
  minute: NumberOrInteger,
  second: NumberOrInteger,
  nanosecond: NumberOrInteger
): string {
  return (
    util.dateToIsoString(year, month, day) +
    'T' +
    util.timeToIsoString(hour, minute, second, nanosecond)
  )
}

/**
 * @private
 * @param {NumberOrInteger} timeZoneOffsetSeconds
 * @param {string | null } timeZoneId
 * @returns {Array<NumberOrInteger | undefined | null, string | undefined | null>}
 */
function verifyTimeZoneArguments (
  timeZoneOffsetSeconds?: NumberOrInteger,
  timeZoneId?: string | null
): [NumberOrInteger | undefined | null, string | undefined | null] {
  const offsetDefined = timeZoneOffsetSeconds !== null && timeZoneOffsetSeconds !== undefined
  const idDefined = timeZoneId !== null && timeZoneId !== undefined && timeZoneId !== ''

  if (!offsetDefined && !idDefined) {
    throw newError(
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `Unable to create DateTime without either time zone offset or id. Please specify either of them. Given offset: ${timeZoneOffsetSeconds} and id: ${timeZoneId}`
    )
  }

  const result: [NumberOrInteger | undefined | null, string | undefined | null] = [undefined, undefined]
  if (offsetDefined) {
    assertNumberOrInteger(timeZoneOffsetSeconds, 'Time zone offset in seconds')
    result[0] = timeZoneOffsetSeconds
  }

  if (idDefined) {
    assertString(timeZoneId, 'Time zone ID')
    util.assertValidZoneId('Time zone ID', timeZoneId)
    result[1] = timeZoneId
  }

  return result
}

/**
 * @private
 * @param {StandardDate} standardDate
 * @param {NumberOrInteger} nanosecond
 * @returns {void}
 */
function verifyStandardDateAndNanos (
  standardDate: StandardDate,
  nanosecond?: NumberOrInteger
): void {
  assertValidDate(standardDate, 'Standard date')
  if (nanosecond !== null && nanosecond !== undefined) {
    assertNumberOrInteger(nanosecond, 'Nanosecond')
  }
}

function parseTemporalFloat (str: string, field: string, maxLength?: number): number {
  if (str === undefined || str.length === 0) {
    return 0
  } else {
    const value: number = parseFloat(str)
    if (isNaN(value)) {
      throw newError(`Failed to parse temporal field ${field}. Got string: ${str}.`)
    }
    return value
  }
}

function parseTemporalInt (str: string, field: string, maxLength?: number): Integer {
  if (str === undefined || str.length === 0 || str === 'undefined') {
    return int(0)
  } else if (maxLength != null && str.length > maxLength) {
    throw newError(`Failed to parse temporal field ${field}. Got string: ${str} which is longer than max length: ${maxLength}.`)
  }
  const result = int(str)
  return result
}

function handleTimeDecimals (hourString: string, minuteString: string, secondString: string, decimalString: string): [Integer, Integer, Integer, Integer] {
  let hours
  let minutes
  let seconds
  let nanoseconds
  if (minuteString === undefined || secondString === '') {
    hours = parseTemporalInt(hourString, 'hours')
    minutes = int(decimalString !== undefined ? Math.round(parseFloat('0' + decimalString) * 60) : 0)
    seconds = int(decimalString !== undefined ? Math.round(parseFloat('0' + decimalString) * 3600) % 60 : 0)
    nanoseconds = int(decimalString !== undefined ? Math.round(parseFloat('0' + decimalString) * 3600 * (10 ** 9)) % 10 ** 9 : 0)
  } else if (secondString === undefined || secondString === '') {
    hours = parseTemporalInt(hourString, 'hours')
    minutes = parseTemporalInt(minuteString, 'minutes')
    seconds = int(decimalString !== undefined ? Math.round(parseFloat('0' + decimalString) * 60) % 60 : 0)
    nanoseconds = int(decimalString !== undefined ? Math.round(parseFloat('0' + decimalString) * 60 * (10 ** 9)) % 10 ** 9 : 0)
  } else {
    hours = parseTemporalInt(hourString, 'hours')
    minutes = parseTemporalInt(minuteString, 'minutes')
    seconds = parseTemporalInt(secondString, 'seconds')
    nanoseconds = int(decimalString !== undefined ? Math.round(parseFloat('0' + decimalString) * 10 ** 9) : 0)
  }
  return [hours, minutes, seconds, nanoseconds]
}

function parseDurationNanos (str: string): number {
  return Math.round(parseTemporalFloat(str, 'nanoseconds') * 10 ** 9)
}

function checkDurationFieldIsInt (value: number, field: string): void {
  if (!Number.isInteger(value)) {
    throw newError(`Parsing Duration field: ${field} resulted in a non-integer value. Bolt protocol can only send durations which can be simplified to integer values of months, days, seconds and nanoseconds.`)
  }
}

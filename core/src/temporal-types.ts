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

import * as util from './internal/temporal-util'
import { NumberOrInteger, StandardDate } from './graph-types'
import {
  assertNumberOrInteger,
  assertString,
  assertValidDate
} from './internal/util'
import { newError } from './error'
import Integer, { int, toNumber } from './integer'

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
  constructor(months: T, days: T, seconds: T, nanoseconds: T) {
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
    /**
     * The number of nanoseconds.
     * @type {NumberOrInteger}
     */
    this.nanoseconds = util.normalizeNanosecondsForDuration(nanoseconds) as T
    Object.freeze(this)
  }

  /**
   * @ignore
   */
  toString() {
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
export function isDuration(obj: object): obj is Duration {
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
  constructor(hour: T, minute: T, second: T, nanosecond: T) {
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
  static fromStandardDate(
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
  toString(): string {
    return util.timeToIsoString(
      this.hour,
      this.minute,
      this.second,
      this.nanosecond
    )
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
export function isLocalTime(obj: object): boolean {
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
  constructor(
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
  static fromStandardDate(
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
  toString() {
    return (
      util.timeToIsoString(
        this.hour,
        this.minute,
        this.second,
        this.nanosecond
      ) + util.timeZoneOffsetToIsoString(this.timeZoneOffsetSeconds)
    )
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
export function isTime(obj: object): obj is Time {
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
  constructor(year: T, month: T, day: T) {
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
   * Hour, minute, second, millisecond and time zone offset components of the given date are ignored.
   * @param {global.Date} standardDate - The standard JavaScript date to convert.
   * @return {Date} New Date.
   */
  static fromStandardDate(standardDate: StandardDate): Date<number> {
    verifyStandardDateAndNanos(standardDate)

    return new Date(
      standardDate.getFullYear(),
      standardDate.getMonth() + 1,
      standardDate.getDate()
    )
  }

  /**
   * @ignore
   */
  toString() {
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
export function isDate(obj: object): boolean {
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
  constructor(
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
  static fromStandardDate(
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
   * @ignore
   */
  toString(): string {
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
export function isLocalDateTime(obj: any): obj is LocalDateTime {
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
  constructor(
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
    this.timeZoneId = id || undefined

    Object.freeze(this)
  }

  /**
   * Create a {@link DateTime} object from the given standard JavaScript `Date` and optional nanoseconds.
   * @param {global.Date} standardDate - The standard JavaScript date to convert.
   * @param {NumberOrInteger|undefined} nanosecond - The optional amount of nanoseconds.
   * @return {DateTime} New DateTime.
   */
  static fromStandardDate(
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
   * @ignore
   */
  toString(): string {
    const localDateTimeStr = localDateTimeToString(
      this.year,
      this.month,
      this.day,
      this.hour,
      this.minute,
      this.second,
      this.nanosecond
    )
    const timeZoneStr = this.timeZoneId
      ? `[${this.timeZoneId}]`
      : util.timeZoneOffsetToIsoString(this.timeZoneOffsetSeconds || 0)
    return localDateTimeStr + timeZoneStr
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
export function isDateTime(obj: object): boolean {
  return hasIdentifierProperty(obj, DATE_TIME_IDENTIFIER_PROPERTY)
}

function hasIdentifierProperty(obj: any, property: string) {
  return (obj && obj[property]) === true
}

function localDateTimeToString(
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
function verifyTimeZoneArguments(
  timeZoneOffsetSeconds?: NumberOrInteger,
  timeZoneId?: string | null
): [NumberOrInteger | undefined | null, string | undefined | null] {
  const offsetDefined = timeZoneOffsetSeconds || timeZoneOffsetSeconds === 0
  const idDefined = timeZoneId && timeZoneId !== ''

  if (offsetDefined && !idDefined) {
    assertNumberOrInteger(timeZoneOffsetSeconds, 'Time zone offset in seconds')
    return [timeZoneOffsetSeconds, undefined]
  } else if (!offsetDefined && idDefined) {
    assertString(timeZoneId, 'Time zone ID')
    return [undefined, timeZoneId]
  } else if (offsetDefined && idDefined) {
    throw newError(
      `Unable to create DateTime with both time zone offset and id. Please specify either of them. Given offset: ${timeZoneOffsetSeconds} and id: ${timeZoneId}`
    )
  } else {
    throw newError(
      `Unable to create DateTime without either time zone offset or id. Please specify either of them. Given offset: ${timeZoneOffsetSeconds} and id: ${timeZoneId}`
    )
  }
}

/**
 * @private
 * @param {StandardDate} standardDate
 * @param {NumberOrInteger} nanosecond
 * @returns {void}
 */
function verifyStandardDateAndNanos(
  standardDate: StandardDate,
  nanosecond?: NumberOrInteger
): void {
  assertValidDate(standardDate, 'Standard date')
  if (nanosecond !== null && nanosecond !== undefined) {
    assertNumberOrInteger(nanosecond, 'Nanosecond')
  }
}

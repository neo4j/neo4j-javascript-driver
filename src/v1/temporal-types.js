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

import {dateToIsoString, durationToIsoString, timeToIsoString, timeZoneOffsetToIsoString} from './internal/temporal-util';

const IDENTIFIER_PROPERTY_ATTRIBUTES = {
  value: true,
  enumerable: false,
  configurable: false
};

const DURATION_IDENTIFIER_PROPERTY = '__isDuration__';
const LOCAL_TIME_IDENTIFIER_PROPERTY = '__isLocalTime__';
const TIME_IDENTIFIER_PROPERTY = '__isTime__';
const DATE_IDENTIFIER_PROPERTY = '__isDate__';
const LOCAL_DATE_TIME_IDENTIFIER_PROPERTY = '__isLocalDateTime__';
const DATE_TIME_WITH_ZONE_OFFSET_IDENTIFIER_PROPERTY = '__isDateTimeWithZoneOffset__';
const DATE_TIME_WITH_ZONE_ID_IDENTIFIER_PROPERTY = '__isDateTimeWithZoneId__';

/**
 * Represents an ISO 8601 duration. Contains both date-based values (years, months, days) and time-based values (seconds, nanoseconds).
 * Created <code>Duration</code> objects are frozen with {@link Object#freeze()} in constructor and thus immutable.
 */
export class Duration {

  /**
   * @constructor
   * @param {Integer|number} months the number of months for the new duration.
   * @param {Integer|number} days the number of days for the new duration.
   * @param {Integer|number} seconds the number of seconds for the new duration.
   * @param {Integer|number} nanoseconds the number of nanoseconds for the new duration.
   */
  constructor(months, days, seconds, nanoseconds) {
    this.months = months;
    this.days = days;
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
    Object.freeze(this);
  }

  toString() {
    return durationToIsoString(this.months, this.days, this.seconds, this.nanoseconds);
  }
}

Object.defineProperty(Duration.prototype, DURATION_IDENTIFIER_PROPERTY, IDENTIFIER_PROPERTY_ATTRIBUTES);

/**
 * Test if given object is an instance of {@link Duration} class.
 * @param {object} obj the object to test.
 * @return {boolean} <code>true</code> if given object is a {@link Duration}, <code>false</code> otherwise.
 */
export function isDuration(obj) {
  return hasIdentifierProperty(obj, DURATION_IDENTIFIER_PROPERTY);
}

/**
 * Represents an instant capturing the time of day, but not the date, nor the timezone.
 * Created <code>LocalTime</code> objects are frozen with {@link Object#freeze()} in constructor and thus immutable.
 */
export class LocalTime {

  /**
   * @constructor
   * @param {Integer|number} hour the hour for the new local time.
   * @param {Integer|number} minute the minute for the new local time.
   * @param {Integer|number} second the second for the new local time.
   * @param {Integer|number} nanosecond the nanosecond for the new local time.
   */
  constructor(hour, minute, second, nanosecond) {
    this.hour = hour;
    this.minute = minute;
    this.second = second;
    this.nanosecond = nanosecond;
    Object.freeze(this);
  }

  toString() {
    return timeToIsoString(this.hour, this.minute, this.second, this.nanosecond);
  }
}

Object.defineProperty(LocalTime.prototype, LOCAL_TIME_IDENTIFIER_PROPERTY, IDENTIFIER_PROPERTY_ATTRIBUTES);

/**
 * Test if given object is an instance of {@link LocalTime} class.
 * @param {object} obj the object to test.
 * @return {boolean} <code>true</code> if given object is a {@link LocalTime}, <code>false</code> otherwise.
 */
export function isLocalTime(obj) {
  return hasIdentifierProperty(obj, LOCAL_TIME_IDENTIFIER_PROPERTY);
}

/**
 * Represents an instant capturing the time of day, and the timezone offset in seconds, but not the date.
 * Created <code>Time</code> objects are frozen with {@link Object#freeze()} in constructor and thus immutable.
 */
export class Time {

  /**
   * @constructor
   * @param {LocalTime} localTime the local time for the new time with offset.
   * @param {Integer|number} offsetSeconds the time zone offset in seconds.
   */
  constructor(localTime, offsetSeconds) {
    this.localTime = localTime;
    this.offsetSeconds = offsetSeconds;
    Object.freeze(this);
  }

  toString() {
    return this.localTime.toString() + timeZoneOffsetToIsoString(this.offsetSeconds);
  }
}

Object.defineProperty(Time.prototype, TIME_IDENTIFIER_PROPERTY, IDENTIFIER_PROPERTY_ATTRIBUTES);

/**
 * Test if given object is an instance of {@link Time} class.
 * @param {object} obj the object to test.
 * @return {boolean} <code>true</code> if given object is a {@link Time}, <code>false</code> otherwise.
 */
export function isTime(obj) {
  return hasIdentifierProperty(obj, TIME_IDENTIFIER_PROPERTY);
}

/**
 * Represents an instant capturing the date, but not the time, nor the timezone.
 * Created <code>Date</code> objects are frozen with {@link Object#freeze()} in constructor and thus immutable.
 */
export class Date {

  /**
   * @constructor
   * @param {Integer|number} year the year for the new local date.
   * @param {Integer|number} month the month for the new local date.
   * @param {Integer|number} day the day for the new local date.
   */
  constructor(year, month, day) {
    this.year = year;
    this.month = month;
    this.day = day;
    Object.freeze(this);
  }

  toString() {
    return dateToIsoString(this.year, this.month, this.day);
  }
}

Object.defineProperty(Date.prototype, DATE_IDENTIFIER_PROPERTY, IDENTIFIER_PROPERTY_ATTRIBUTES);

/**
 * Test if given object is an instance of {@link Date} class.
 * @param {object} obj the object to test.
 * @return {boolean} <code>true</code> if given object is a {@link Date}, <code>false</code> otherwise.
 */
export function isDate(obj) {
  return hasIdentifierProperty(obj, DATE_IDENTIFIER_PROPERTY);
}

/**
 * Represents an instant capturing the date and the time, but not the timezone.
 * Created <code>LocalDateTime</code> objects are frozen with {@link Object#freeze()} in constructor and thus immutable.
 */
export class LocalDateTime {

  /**
   * @constructor
   * @param {Date} localDate the local date part for the new local date-time.
   * @param {LocalTime} localTime the local time part for the new local date-time.
   */
  constructor(localDate, localTime) {
    this.localDate = localDate;
    this.localTime = localTime;
    Object.freeze(this);
  }

  toString() {
    return `${this.localDate.toString()}T${this.localTime.toString()}`;
  }
}

Object.defineProperty(LocalDateTime.prototype, LOCAL_DATE_TIME_IDENTIFIER_PROPERTY, IDENTIFIER_PROPERTY_ATTRIBUTES);

/**
 * Test if given object is an instance of {@link LocalDateTime} class.
 * @param {object} obj the object to test.
 * @return {boolean} <code>true</code> if given object is a {@link LocalDateTime}, <code>false</code> otherwise.
 */
export function isLocalDateTime(obj) {
  return hasIdentifierProperty(obj, LOCAL_DATE_TIME_IDENTIFIER_PROPERTY);
}

/**
 * Represents an instant capturing the date, the time and the timezone identifier.
 * Created <code>DateTimeWithZoneOffset</code> objects are frozen with {@link Object#freeze()} in constructor and thus immutable.
 */
export class DateTimeWithZoneOffset {

  /**
   * @constructor
   * @param {LocalDateTime} localDateTime the local date-time part for the new timezone-aware date-time.
   * @param {Integer|number} offsetSeconds the timezone offset in seconds for the new timezone-aware date-time.
   */
  constructor(localDateTime, offsetSeconds) {
    this.localDateTime = localDateTime;
    this.offsetSeconds = offsetSeconds;
    Object.freeze(this);
  }

  toString() {
    return this.localDateTime.toString() + timeZoneOffsetToIsoString(this.offsetSeconds);
  }
}

Object.defineProperty(DateTimeWithZoneOffset.prototype, DATE_TIME_WITH_ZONE_OFFSET_IDENTIFIER_PROPERTY, IDENTIFIER_PROPERTY_ATTRIBUTES);

/**
 * Test if given object is an instance of {@link DateTimeWithZoneOffset} class.
 * @param {object} obj the object to test.
 * @return {boolean} <code>true</code> if given object is a {@link DateTimeWithZoneOffset}, <code>false</code> otherwise.
 */
export function isDateTimeWithZoneOffset(obj) {
  return hasIdentifierProperty(obj, DATE_TIME_WITH_ZONE_OFFSET_IDENTIFIER_PROPERTY);
}

/**
 * Represents an instant capturing the date, the time and the timezone identifier.
 * Created <code>DateTimeWithZoneId</code> objects are frozen with {@link Object#freeze()} in constructor and thus immutable.
 */
export class DateTimeWithZoneId {

  /**
   * @constructor
   * @param {LocalDateTime} localDateTime the local date-time part for the new timezone-aware date-time.
   * @param {string} zoneId the timezone identifier for the new timezone-aware date-time.
   */
  constructor(localDateTime, zoneId) {
    this.localDateTime = localDateTime;
    this.zoneId = zoneId;
    Object.freeze(this);
  }

  toString() {
    return `${this.localDateTime.toString()}[${this.zoneId}]`;
  }
}

Object.defineProperty(DateTimeWithZoneId.prototype, DATE_TIME_WITH_ZONE_ID_IDENTIFIER_PROPERTY, IDENTIFIER_PROPERTY_ATTRIBUTES);

/**
 * Test if given object is an instance of {@link DateTimeWithZoneId} class.
 * @param {object} obj the object to test.
 * @return {boolean} <code>true</code> if given object is a {@link DateTimeWithZoneId}, <code>false</code> otherwise.
 */
export function isDateTimeWithZoneId(obj) {
  return hasIdentifierProperty(obj, DATE_TIME_WITH_ZONE_ID_IDENTIFIER_PROPERTY);
}

function hasIdentifierProperty(obj, property) {
  return (obj && obj[property]) === true;
}

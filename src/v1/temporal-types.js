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

const CYPHER_DURATION_IDENTIFIER_PROPERTY = '__isCypherDuration__';
const CYPHER_LOCAL_TIME_IDENTIFIER_PROPERTY = '__isCypherLocalTime__';
const CYPHER_TIME_IDENTIFIER_PROPERTY = '__isCypherTime__';
const CYPHER_DATE_IDENTIFIER_PROPERTY = '__isCypherDate__';
const CYPHER_LOCAL_DATE_TIME_IDENTIFIER_PROPERTY = '__isCypherLocalDateTime__';
const CYPHER_DATE_TIME_WITH_ZONE_OFFSET_IDENTIFIER_PROPERTY = '__isCypherDateTimeWithZoneOffset__';
const CYPHER_DATE_TIME_WITH_ZONE_ID_IDENTIFIER_PROPERTY = '__isCypherDateTimeWithZoneId__';

/**
 * Represents an ISO 8601 duration. Contains both date-based values (years, months, days) and time-based values (seconds, nanoseconds).
 * Created <code>CypherDuration</code> objects are frozen with {@link Object#freeze()} in constructor and thus immutable.
 */
export class CypherDuration {

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

Object.defineProperty(CypherDuration.prototype, CYPHER_DURATION_IDENTIFIER_PROPERTY, IDENTIFIER_PROPERTY_ATTRIBUTES);

/**
 * Test if given object is an instance of {@link CypherDuration} class.
 * @param {object} obj the object to test.
 * @return {boolean} <code>true</code> if given object is a {@link CypherDuration}, <code>false</code> otherwise.
 */
export function isCypherDuration(obj) {
  return hasIdentifierProperty(obj, CYPHER_DURATION_IDENTIFIER_PROPERTY);
}

/**
 * Represents an instant capturing the time of day, but not the date, nor the timezone.
 * Created <code>CypherLocalTime</code> objects are frozen with {@link Object#freeze()} in constructor and thus immutable.
 */
export class CypherLocalTime {

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

Object.defineProperty(CypherLocalTime.prototype, CYPHER_LOCAL_TIME_IDENTIFIER_PROPERTY, IDENTIFIER_PROPERTY_ATTRIBUTES);

/**
 * Test if given object is an instance of {@link CypherLocalTime} class.
 * @param {object} obj the object to test.
 * @return {boolean} <code>true</code> if given object is a {@link CypherLocalTime}, <code>false</code> otherwise.
 */
export function isCypherLocalTime(obj) {
  return hasIdentifierProperty(obj, CYPHER_LOCAL_TIME_IDENTIFIER_PROPERTY);
}

/**
 * Represents an instant capturing the time of day, and the timezone offset in seconds, but not the date.
 * Created <code>CypherTime</code> objects are frozen with {@link Object#freeze()} in constructor and thus immutable.
 */
export class CypherTime {

  /**
   * @constructor
   * @param {CypherLocalTime} localTime the local time for the new time with offset.
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

Object.defineProperty(CypherTime.prototype, CYPHER_TIME_IDENTIFIER_PROPERTY, IDENTIFIER_PROPERTY_ATTRIBUTES);

/**
 * Test if given object is an instance of {@link CypherTime} class.
 * @param {object} obj the object to test.
 * @return {boolean} <code>true</code> if given object is a {@link CypherTime}, <code>false</code> otherwise.
 */
export function isCypherTime(obj) {
  return hasIdentifierProperty(obj, CYPHER_TIME_IDENTIFIER_PROPERTY);
}

/**
 * Represents an instant capturing the date, but not the time, nor the timezone.
 * Created <code>CypherDate</code> objects are frozen with {@link Object#freeze()} in constructor and thus immutable.
 */
export class CypherDate {

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

Object.defineProperty(CypherDate.prototype, CYPHER_DATE_IDENTIFIER_PROPERTY, IDENTIFIER_PROPERTY_ATTRIBUTES);

/**
 * Test if given object is an instance of {@link CypherDate} class.
 * @param {object} obj the object to test.
 * @return {boolean} <code>true</code> if given object is a {@link CypherDate}, <code>false</code> otherwise.
 */
export function isCypherDate(obj) {
  return hasIdentifierProperty(obj, CYPHER_DATE_IDENTIFIER_PROPERTY);
}

/**
 * Represents an instant capturing the date and the time, but not the timezone.
 * Created <code>CypherLocalDateTime</code> objects are frozen with {@link Object#freeze()} in constructor and thus immutable.
 */
export class CypherLocalDateTime {

  /**
   * @constructor
   * @param {CypherDate} localDate the local date part for the new local date-time.
   * @param {CypherLocalTime} localTime the local time part for the new local date-time.
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

Object.defineProperty(CypherLocalDateTime.prototype, CYPHER_LOCAL_DATE_TIME_IDENTIFIER_PROPERTY, IDENTIFIER_PROPERTY_ATTRIBUTES);

/**
 * Test if given object is an instance of {@link CypherLocalDateTime} class.
 * @param {object} obj the object to test.
 * @return {boolean} <code>true</code> if given object is a {@link CypherLocalDateTime}, <code>false</code> otherwise.
 */
export function isCypherLocalDateTime(obj) {
  return hasIdentifierProperty(obj, CYPHER_LOCAL_DATE_TIME_IDENTIFIER_PROPERTY);
}

/**
 * Represents an instant capturing the date, the time and the timezone identifier.
 * Created <code>CypherDateTimeWithZoneOffset</code> objects are frozen with {@link Object#freeze()} in constructor and thus immutable.
 */
export class CypherDateTimeWithZoneOffset {

  /**
   * @constructor
   * @param {CypherLocalDateTime} localDateTime the local date-time part for the new timezone-aware date-time.
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

Object.defineProperty(CypherDateTimeWithZoneOffset.prototype, CYPHER_DATE_TIME_WITH_ZONE_OFFSET_IDENTIFIER_PROPERTY, IDENTIFIER_PROPERTY_ATTRIBUTES);

/**
 * Test if given object is an instance of {@link CypherDateTimeWithZoneOffset} class.
 * @param {object} obj the object to test.
 * @return {boolean} <code>true</code> if given object is a {@link CypherDateTimeWithZoneOffset}, <code>false</code> otherwise.
 */
export function isCypherDateTimeWithZoneOffset(obj) {
  return hasIdentifierProperty(obj, CYPHER_DATE_TIME_WITH_ZONE_OFFSET_IDENTIFIER_PROPERTY);
}

/**
 * Represents an instant capturing the date, the time and the timezone identifier.
 * Created <code>CypherDateTimeWithZoneId</code> objects are frozen with {@link Object#freeze()} in constructor and thus immutable.
 */
export class CypherDateTimeWithZoneId {

  /**
   * @constructor
   * @param {CypherLocalDateTime} localDateTime the local date-time part for the new timezone-aware date-time.
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

Object.defineProperty(CypherDateTimeWithZoneId.prototype, CYPHER_DATE_TIME_WITH_ZONE_ID_IDENTIFIER_PROPERTY, IDENTIFIER_PROPERTY_ATTRIBUTES);

/**
 * Test if given object is an instance of {@link CypherDateTimeWithZoneId} class.
 * @param {object} obj the object to test.
 * @return {boolean} <code>true</code> if given object is a {@link CypherDateTimeWithZoneId}, <code>false</code> otherwise.
 */
export function isCypherDateTimeWithZoneId(obj) {
  return hasIdentifierProperty(obj, CYPHER_DATE_TIME_WITH_ZONE_ID_IDENTIFIER_PROPERTY);
}

function hasIdentifierProperty(obj, property) {
  return (obj && obj[property]) === true;
}

/**
 * Copyright (c) 2002-2018 "Neo4j,"
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

import {int} from '../../src/v1/integer';
import * as util from '../../src/v1/internal/temporal-util';
import {types} from '../../src/v1';

describe('temporal-util', () => {

  it('should normalize seconds for duration', () => {
    expect(util.normalizeSecondsForDuration(1, 0)).toEqual(int(1));
    expect(util.normalizeSecondsForDuration(3, 0)).toEqual(int(3));
    expect(util.normalizeSecondsForDuration(424242, 0)).toEqual(int(424242));

    expect(util.normalizeSecondsForDuration(-1, 0)).toEqual(int(-1));
    expect(util.normalizeSecondsForDuration(-9, 0)).toEqual(int(-9));
    expect(util.normalizeSecondsForDuration(-42, 0)).toEqual(int(-42));

    expect(util.normalizeSecondsForDuration(1, 19)).toEqual(int(1));
    expect(util.normalizeSecondsForDuration(42, 42)).toEqual(int(42));
    expect(util.normalizeSecondsForDuration(12345, 6789)).toEqual(int(12345));

    expect(util.normalizeSecondsForDuration(-1, 42)).toEqual(int(-1));
    expect(util.normalizeSecondsForDuration(-42, 4242)).toEqual(int(-42));
    expect(util.normalizeSecondsForDuration(-123, 999)).toEqual(int(-123));

    expect(util.normalizeSecondsForDuration(1, 1000000000)).toEqual(int(2));
    expect(util.normalizeSecondsForDuration(40, 2000000001)).toEqual(int(42));
    expect(util.normalizeSecondsForDuration(583, 7999999999)).toEqual(int(590));

    expect(util.normalizeSecondsForDuration(1, -1000000000)).toEqual(int(0));
    expect(util.normalizeSecondsForDuration(1, -5000000000)).toEqual(int(-4));
    expect(util.normalizeSecondsForDuration(85, -42000000123)).toEqual(int(42));

    expect(util.normalizeSecondsForDuration(-19, -1000000000)).toEqual(int(-20));
    expect(util.normalizeSecondsForDuration(-19, -11123456789)).toEqual(int(-31));
    expect(util.normalizeSecondsForDuration(-42, -2000000001)).toEqual(int(-45));
  });

  it('should normalize nanoseconds for duration', () => {
    expect(util.normalizeNanosecondsForDuration(0)).toEqual(int(0));

    expect(util.normalizeNanosecondsForDuration(1)).toEqual(int(1));
    expect(util.normalizeNanosecondsForDuration(42)).toEqual(int(42));
    expect(util.normalizeNanosecondsForDuration(123456789)).toEqual(int(123456789));
    expect(util.normalizeNanosecondsForDuration(999999999)).toEqual(int(999999999));

    expect(util.normalizeNanosecondsForDuration(1000000000)).toEqual(int(0));
    expect(util.normalizeNanosecondsForDuration(1000000001)).toEqual(int(1));
    expect(util.normalizeNanosecondsForDuration(1000000042)).toEqual(int(42));
    expect(util.normalizeNanosecondsForDuration(1123456789)).toEqual(int(123456789));
    expect(util.normalizeNanosecondsForDuration(42999999999)).toEqual(int(999999999));

    expect(util.normalizeNanosecondsForDuration(-1)).toEqual(int(999999999));
    expect(util.normalizeNanosecondsForDuration(-3)).toEqual(int(999999997));
    expect(util.normalizeNanosecondsForDuration(-100)).toEqual(int(999999900));
    expect(util.normalizeNanosecondsForDuration(-999999999)).toEqual(int(1));
    expect(util.normalizeNanosecondsForDuration(-1999999999)).toEqual(int(1));
    expect(util.normalizeNanosecondsForDuration(-1123456789)).toEqual(int(876543211));
  });

  it('should convert date to ISO string', () => {
    expect(util.dateToIsoString(90, 2, 5)).toEqual('0090-02-05');
    expect(util.dateToIsoString(int(1), 1, int(1))).toEqual('0001-01-01');
    expect(util.dateToIsoString(-123, int(12), int(23))).toEqual('-0123-12-23');
    expect(util.dateToIsoString(int(-999), int(9), int(10))).toEqual('-0999-09-10');
    expect(util.dateToIsoString(1999, 12, 19)).toEqual('1999-12-19');
    expect(util.dateToIsoString(int(2023), int(8), int(16))).toEqual('2023-08-16');
    expect(util.dateToIsoString(12345, 12, 31)).toEqual('12345-12-31');
    expect(util.dateToIsoString(int(19191919), int(11), int(30))).toEqual('19191919-11-30');
    expect(util.dateToIsoString(-909090, 9, 9)).toEqual('-909090-09-09');
    expect(util.dateToIsoString(int(-888999777), int(7), int(26))).toEqual('-888999777-07-26');
  });

  it('should convert time zone offset to ISO string', () => {
    expect(util.timeZoneOffsetToIsoString(0)).toEqual('Z');
    expect(util.timeZoneOffsetToIsoString(-0)).toEqual('Z');
    expect(util.timeZoneOffsetToIsoString(1)).toEqual('+00:00:01');
    expect(util.timeZoneOffsetToIsoString(-1)).toEqual('-00:00:01');
    expect(util.timeZoneOffsetToIsoString(20 * 60)).toEqual('+00:20');
    expect(util.timeZoneOffsetToIsoString(-12 * 60)).toEqual('-00:12');
    expect(util.timeZoneOffsetToIsoString(8 * 60 * 60)).toEqual('+08:00');
    expect(util.timeZoneOffsetToIsoString(-13 * 60 * 60)).toEqual('-13:00');
    expect(util.timeZoneOffsetToIsoString(8 * 60 * 60 + 59 * 60)).toEqual('+08:59');
    expect(util.timeZoneOffsetToIsoString(-12 * 60 * 60 - 31 * 60)).toEqual('-12:31');
    expect(util.timeZoneOffsetToIsoString(2 * 60 * 60 + 9 * 60 + 17)).toEqual('+02:09:17');
    expect(util.timeZoneOffsetToIsoString(-7 * 60 * 60 - 18 * 60 - 54)).toEqual('-07:18:54');
  });

  it('should convert time to ISO string', () => {
    expect(util.timeToIsoString(8, 9, 1, 0)).toEqual('08:09:01');
    expect(util.timeToIsoString(1, 23, 45, 600000000)).toEqual('01:23:45.600000000');
    expect(util.timeToIsoString(int(2), int(4), int(6), int(7))).toEqual('02:04:06.000000007');
    expect(util.timeToIsoString(22, 19, 7, 999)).toEqual('22:19:07.000000999');
    expect(util.timeToIsoString(int(17), int(2), int(59), int(909090))).toEqual('17:02:59.000909090');
    expect(util.timeToIsoString(23, 59, 59, 999999991)).toEqual('23:59:59.999999991');
    expect(util.timeToIsoString(int(23), int(22), int(21), int(111222333))).toEqual('23:22:21.111222333');
  });

  it('should convert duration to ISO string', () => {
    expect(util.durationToIsoString(0, 0, 0, 0)).toEqual('P0M0DT0S');
    expect(util.durationToIsoString(0, 0, 0, 123)).toEqual('P0M0DT0.000000123S');
    expect(util.durationToIsoString(11, 99, 100, 99901)).toEqual('P11M99DT100.000099901S');
    expect(util.durationToIsoString(int(3), int(9191), int(17), int(123456789))).toEqual('P3M9191DT17.123456789S');
    expect(util.durationToIsoString(-5, 2, -13, 123)).toEqual('P-5M2DT-12.999999877S');
  });

  it('should convert epoch day to cypher date', () => {
    expect(util.epochDayToDate(-719528)).toEqual(date(0, 1, 1));
    expect(util.epochDayToDate(-135153)).toEqual(date(1599, 12, 19));
    expect(util.epochDayToDate(7905)).toEqual(date(1991, 8, 24));
    expect(util.epochDayToDate(int(48210))).toEqual(date(2101, 12, 30));
    expect(util.epochDayToDate(int(-4310226))).toEqual(date(-9831, 1, 1));
  });

  it('should convert cypher date to epoch day', () => {
    expect(util.dateToEpochDay(-13, 12, 31)).toEqual(int(-723912));
    expect(util.dateToEpochDay(9, 9, 9)).toEqual(int(-715989));
    expect(util.dateToEpochDay(2015, 2, 17)).toEqual(int(16483));
    expect(util.dateToEpochDay(2189, 7, 19)).toEqual(int(80188));
    expect(util.dateToEpochDay(19999, 9, 28)).toEqual(int(6585227));
  });

  it('should convert epoch second with nano to cypher local date-time', () => {
    expect(util.epochSecondAndNanoToLocalDateTime(653165977, 999)).toEqual(localDateTime(1990, 9, 12, 18, 59, 37, 999));
    expect(util.epochSecondAndNanoToLocalDateTime(-62703676801, 12345)).toEqual(localDateTime(-18, 12, 31, 23, 59, 59, 12345));
    expect(util.epochSecondAndNanoToLocalDateTime(2678400, int(1))).toEqual(localDateTime(1970, 2, 1, 0, 0, 0, 1));
    expect(util.epochSecondAndNanoToLocalDateTime(int(3065493882737), int(1794673))).toEqual(localDateTime(99111, 8, 21, 6, 32, 17, 1794673));
    expect(util.epochSecondAndNanoToLocalDateTime(int(-37428234001), 999999111)).toEqual(localDateTime(783, 12, 12, 20, 19, 59, 999999111));
  });

  it('should convert cypher local date-time to epoch second', () => {
    expect(util.localDateTimeToEpochSecond(1990, 9, 12, 18, 59, 37, 999)).toEqual(int(653165977));
    expect(util.localDateTimeToEpochSecond(-18, 12, 31, 23, 59, 59, 12345)).toEqual(int(-62703676801));
    expect(util.localDateTimeToEpochSecond(1970, 2, 1, 0, 0, 0, 1)).toEqual(int(2678400));
    expect(util.localDateTimeToEpochSecond(99111, 8, 21, 6, 32, 17, 1794673)).toEqual(int(3065493882737));
    expect(util.localDateTimeToEpochSecond(783, 12, 12, 20, 19, 59, 999999111)).toEqual(int(-37428234001));
  });

  it('should convert nanosecond of the day to cypher local time', () => {
    expect(util.nanoOfDayToLocalTime(68079000012399)).toEqual(localTime(18, 54, 39, 12399));
    expect(util.nanoOfDayToLocalTime(0)).toEqual(localTime(0, 0, 0, 0));
    expect(util.nanoOfDayToLocalTime(1)).toEqual(localTime(0, 0, 0, 1));
    expect(util.nanoOfDayToLocalTime(int(86399999999999))).toEqual(localTime(23, 59, 59, 999999999));
    expect(util.nanoOfDayToLocalTime(int(46277000808080))).toEqual(localTime(12, 51, 17, 808080));
  });

  it('should convert cypher local time to nanosecond of the day', () => {
    expect(util.localTimeToNanoOfDay(18, 54, 39, 12399)).toEqual(int(68079000012399));
    expect(util.localTimeToNanoOfDay(0, 0, 0, 0)).toEqual(int(0));
    expect(util.localTimeToNanoOfDay(0, 0, 0, 1)).toEqual(int(1));
    expect(util.localTimeToNanoOfDay(23, 59, 59, 999999999)).toEqual(int(86399999999999));
    expect(util.localTimeToNanoOfDay(12, 51, 17, 808080)).toEqual(int(46277000808080));
  });

});

function date(year, month, day) {
  return new types.Date(int(year), int(month), int(day));
}

function localTime(hour, minute, second, nanosecond) {
  return new types.LocalTime(int(hour), int(minute), int(second), int(nanosecond));
}

function localDateTime(year, month, day, hour, minute, second, nanosecond) {
  return new types.LocalDateTime(int(year), int(month), int(day), int(hour), int(minute), int(second), int(nanosecond));
}

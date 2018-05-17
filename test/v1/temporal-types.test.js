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

import neo4j from '../../src';
import sharedNeo4j from '../internal/shared-neo4j';
import {ServerVersion, VERSION_3_4_0} from '../../src/v1/internal/server-version';
import timesSeries from 'async/timesSeries';
import _ from 'lodash';

const RANDOM_VALUES_TO_TEST = 2000;
const MIN_TEMPORAL_ARRAY_LENGTH = 20;
const MAX_TEMPORAL_ARRAY_LENGTH = 1000;
const MAX_NANO_OF_SECOND = 999999999;
const MAX_YEAR = 999999999;
const MIN_YEAR = -MAX_YEAR;
const MAX_TIME_ZONE_OFFSET = 64800;
const MIN_TIME_ZONE_OFFSET = -MAX_TIME_ZONE_OFFSET;
const SECONDS_PER_MINUTE = 60;
const MIN_ZONE_ID = 'Etc/GMT+12';
const MAX_ZONE_ID = 'Etc/GMT-14';
const ZONE_IDS = ['Europe/Zaporozhye', 'Europe/London', 'UTC', 'Africa/Cairo'];

describe('temporal-types', () => {

  let originalTimeout;
  let driver;
  let driverWithNativeNumbers;
  let session;
  let serverVersion;

  beforeAll(done => {
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;

    driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken);
    driverWithNativeNumbers = neo4j.driver('bolt://localhost', sharedNeo4j.authToken, {disableLosslessIntegers: true});

    ServerVersion.fromDriver(driver).then(version => {
      serverVersion = version;
      done();
    });
  });

  afterAll(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;

    if (driver) {
      driver.close();
      driver = null;
    }

    if (driverWithNativeNumbers) {
      driverWithNativeNumbers.close();
      driverWithNativeNumbers = null;
    }
  });

  beforeEach(done => {
    session = driver.session();
    session.run('MATCH (n) DETACH DELETE n').then(() => {
      done();
    }).catch(error => {
      done.fail(error);
    });
  });

  afterEach(() => {
    if (session) {
      session.close();
      session = null;
    }
  });

  it('should receive Duration', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const expectedValue = duration(27, 17, 91, 999);
    testReceiveTemporalValue('RETURN duration({years: 2, months: 3, days: 17, seconds: 91, nanoseconds: 999})', expectedValue, done);
  });

  it('should send and receive random Duration', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    testSendAndReceiveRandomTemporalValues(() => randomDuration(), done);
  });

  it('should send and receive Duration when disableLosslessIntegers=true', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }
    session = driverWithNativeNumbers.session();

    testSendReceiveTemporalValue(new neo4j.types.Duration(4, 15, 931, 99953), done);
  });

  it('should send and receive array of Duration', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    testSendAndReceiveArrayOfRandomTemporalValues(() => randomDuration(), done);
  });

  it('should receive LocalTime', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const expectedValue = localTime(22, 59, 10, 999999);
    testReceiveTemporalValue('RETURN localtime({hour: 22, minute: 59, second: 10, nanosecond: 999999})', expectedValue, done);
  });

  it('should send and receive max LocalTime', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const maxLocalTime = localTime(23, 59, 59, MAX_NANO_OF_SECOND);
    testSendReceiveTemporalValue(maxLocalTime, done);
  });

  it('should send and receive min LocalTime', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const minLocalTime = localTime(0, 0, 0, 0);
    testSendReceiveTemporalValue(minLocalTime, done);
  });

  it('should send and receive LocalTime when disableLosslessIntegers=true', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }
    session = driverWithNativeNumbers.session();

    testSendReceiveTemporalValue(new neo4j.types.LocalTime(12, 32, 56, 12345), done);
  });

  it('should send and receive random LocalTime', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    testSendAndReceiveRandomTemporalValues(() => randomLocalTime(), done);
  });

  it('should send and receive array of LocalTime', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    testSendAndReceiveArrayOfRandomTemporalValues(() => randomLocalTime(), done);
  });

  it('should receive Time', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const expectedValue = time(11, 42, 59, 9999, -30600);
    testReceiveTemporalValue('RETURN time({hour: 11, minute: 42, second: 59, nanosecond: 9999, timezone:"-08:30"})', expectedValue, done);
  });

  it('should send and receive max Time', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const maxTime = time(23, 59, 59, MAX_NANO_OF_SECOND, MAX_TIME_ZONE_OFFSET);
    testSendReceiveTemporalValue(maxTime, done);
  });

  it('should send and receive min Time', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const minTime = time(0, 0, 0, 0, MIN_TIME_ZONE_OFFSET);
    testSendReceiveTemporalValue(minTime, done);
  });

  it('should send and receive Time when disableLosslessIntegers=true', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }
    session = driverWithNativeNumbers.session();

    testSendReceiveTemporalValue(new neo4j.types.Time(22, 19, 32, 18381, MAX_TIME_ZONE_OFFSET), done);
  });

  it('should send and receive random Time', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    testSendAndReceiveRandomTemporalValues(() => randomTime(), done);
  });

  it('should send and receive array of Time', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    testSendAndReceiveArrayOfRandomTemporalValues(() => randomTime(), done);
  });

  it('should receive Date', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const expectedValue = date(1995, 7, 28);
    testReceiveTemporalValue('RETURN date({year: 1995, month: 7, day: 28})', expectedValue, done);
  });

  it('should send and receive max Date', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const maxDate = date(MAX_YEAR, 12, 31);
    testSendReceiveTemporalValue(maxDate, done);
  });

  it('should send and receive min Date', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const minDate = date(MIN_YEAR, 1, 1);
    testSendReceiveTemporalValue(minDate, done);
  });

  it('should send and receive Date when disableLosslessIntegers=true', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }
    session = driverWithNativeNumbers.session();

    testSendReceiveTemporalValue(new neo4j.types.Date(1923, 8, 14), done);
  });

  it('should send and receive random Date', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    testSendAndReceiveRandomTemporalValues(() => randomDate(), done);
  });

  it('should send and receive array of Date', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    testSendAndReceiveArrayOfRandomTemporalValues(() => randomDate(), done);
  });

  it('should receive LocalDateTime', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const expectedValue = localDateTime(1869, 9, 23, 18, 29, 59, 12349);
    testReceiveTemporalValue('RETURN localdatetime({year: 1869, month: 9, day: 23, hour: 18, minute: 29, second: 59, nanosecond: 12349})', expectedValue, done);
  });

  it('should send and receive max LocalDateTime', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const maxLocalDateTime = localDateTime(MAX_YEAR, 12, 31, 23, 59, 59, MAX_NANO_OF_SECOND);
    testSendReceiveTemporalValue(maxLocalDateTime, done);
  });

  it('should send and receive min LocalDateTime', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const minLocalDateTime = localDateTime(MIN_YEAR, 1, 1, 0, 0, 0, 0);
    testSendReceiveTemporalValue(minLocalDateTime, done);
  });

  it('should send and receive LocalDateTime when disableLosslessIntegers=true', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }
    session = driverWithNativeNumbers.session();

    testSendReceiveTemporalValue(new neo4j.types.LocalDateTime(2045, 9, 1, 11, 25, 25, 911), done);
  });

  it('should send and receive random LocalDateTime', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    testSendAndReceiveRandomTemporalValues(() => randomLocalDateTime(), done);
  });

  it('should send and receive random LocalDateTime', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    testSendAndReceiveArrayOfRandomTemporalValues(() => randomLocalDateTime(), done);
  });

  it('should receive DateTime with time zone offset', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const expectedValue = dateTimeWithZoneOffset(1992, 11, 24, 9, 55, 42, 999, 18000);
    testReceiveTemporalValue('RETURN datetime({year: 1992, month: 11, day: 24, hour: 9, minute: 55, second: 42, nanosecond: 999, timezone: "+05:00"})', expectedValue, done);
  });

  it('should send and receive max DateTime with zone offset', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const maxDateTime = dateTimeWithZoneOffset(MAX_YEAR, 12, 31, 23, 59, 59, MAX_NANO_OF_SECOND, MAX_TIME_ZONE_OFFSET);
    testSendReceiveTemporalValue(maxDateTime, done);
  });

  it('should send and receive min DateTime with zone offset', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const minDateTime = dateTimeWithZoneOffset(MIN_YEAR, 1, 1, 0, 0, 0, 0, MAX_TIME_ZONE_OFFSET);
    testSendReceiveTemporalValue(minDateTime, done);
  });

  it('should send and receive DateTime with zone offset when disableLosslessIntegers=true', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }
    session = driverWithNativeNumbers.session();

    testSendReceiveTemporalValue(new neo4j.types.DateTime(2022, 2, 7, 17, 15, 59, 12399, MAX_TIME_ZONE_OFFSET, null), done);
  });

  it('should send and receive random DateTime with zone offset', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    testSendAndReceiveRandomTemporalValues(() => randomDateTimeWithZoneOffset(), done);
  });

  it('should send and receive array of DateTime with zone offset', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    testSendAndReceiveArrayOfRandomTemporalValues(() => randomDateTimeWithZoneOffset(), done);
  });

  it('should receive DateTime with zone id', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const expectedValue = dateTimeWithZoneId(1992, 11, 24, 9, 55, 42, 999, 'Europe/Stockholm');
    testReceiveTemporalValue('RETURN datetime({year: 1992, month: 11, day: 24, hour: 9, minute: 55, second: 42, nanosecond: 999, timezone: "Europe/Stockholm"})', expectedValue, done);
  });

  it('should send and receive max DateTime with zone id', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const maxDateTime = dateTimeWithZoneId(MAX_YEAR, 12, 31, 23, 59, 59, MAX_NANO_OF_SECOND, MAX_ZONE_ID);
    testSendReceiveTemporalValue(maxDateTime, done);
  });

  it('should send and receive min DateTime with zone id', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const minDateTime = dateTimeWithZoneId(MIN_YEAR, 1, 1, 0, 0, 0, 0, MIN_ZONE_ID);
    testSendReceiveTemporalValue(minDateTime, done);
  });

  it('should send and receive DateTime with zone id when disableLosslessIntegers=true', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }
    session = driverWithNativeNumbers.session();

    testSendReceiveTemporalValue(new neo4j.types.DateTime(2011, 11, 25, 23, 59, 59, 192378, null, 'Europe/Stockholm'), done);
  });

  it('should send and receive random DateTime with zone id', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    testSendAndReceiveRandomTemporalValues(() => randomDateTimeWithZoneId(), done);
  });

  it('should send and receive array of DateTime with zone id', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    testSendAndReceiveArrayOfRandomTemporalValues(() => randomDateTimeWithZoneId(), done);
  });

  it('should convert Duration to ISO string', () => {
    expect(duration(13, 62, 3, 999111999).toString()).toEqual('P13M62DT3.999111999S');
    expect(duration(0, 0, 0, 0).toString()).toEqual('P0M0DT0S');
    expect(duration(-1, -2, 10, 10).toString()).toEqual('P-1M-2DT10.000000010S');
  });

  it('should convert LocalTime to ISO string', () => {
    expect(localTime(12, 19, 39, 111222333).toString()).toEqual('12:19:39.111222333');
    expect(localTime(3, 59, 2, 17).toString()).toEqual('03:59:02.000000017');
    expect(localTime(0, 0, 0, 0).toString()).toEqual('00:00:00');
  });

  it('should convert Time to ISO string', () => {
    expect(time(11, 45, 22, 333222111, 9015).toString()).toEqual('11:45:22.333222111+02:30:15');
    expect(time(23, 2, 1, 10, 0).toString()).toEqual('23:02:01.000000010Z');
    expect(time(0, 12, 59, 0, -40500).toString()).toEqual('00:12:59-11:15');
    expect(time(21, 59, 0, 123, -25200).toString()).toEqual('21:59:00.000000123-07:00');
  });

  it('should convert Date to ISO string', () => {
    expect(date(2015, 10, 12).toString()).toEqual('2015-10-12');
    expect(date(881, 1, 1).toString()).toEqual('0881-01-01');
    expect(date(-999, 12, 24).toString()).toEqual('-0999-12-24');
    expect(date(-9, 1, 1).toString()).toEqual('-0009-01-01');
  });

  it('should convert LocalDateTime to ISO string', () => {
    expect(localDateTime(1992, 11, 8, 9, 42, 17, 22).toString()).toEqual('1992-11-08T09:42:17.000000022');
    expect(localDateTime(-10, 7, 15, 8, 15, 33, 500).toString()).toEqual('-0010-07-15T08:15:33.000000500');
    expect(localDateTime(0, 0, 0, 0, 0, 0, 1).toString()).toEqual('0000-00-00T00:00:00.000000001');
  });

  it('should convert DateTime with time zone offset to ISO string', () => {
    expect(dateTimeWithZoneOffset(2025, 9, 17, 23, 22, 21, 999888, 37800).toString()).toEqual('2025-09-17T23:22:21.000999888+10:30');
    expect(dateTimeWithZoneOffset(1, 2, 3, 4, 5, 6, 7, -49376).toString()).toEqual('0001-02-03T04:05:06.000000007-13:42:56');
    expect(dateTimeWithZoneOffset(-3, 3, 9, 9, 33, 27, 999000, 15300).toString()).toEqual('-0003-03-09T09:33:27.000999000+04:15');
  });

  it('should convert DateTime with time zone id to ISO-like string', () => {
    expect(dateTimeWithZoneId(1949, 10, 7, 6, 10, 15, 15000000, 'Europe/Zaporozhye').toString()).toEqual('1949-10-07T06:10:15.015000000[Europe/Zaporozhye]');
    expect(dateTimeWithZoneId(-30455, 5, 5, 12, 24, 10, 123, 'Asia/Yangon').toString()).toEqual('-30455-05-05T12:24:10.000000123[Asia/Yangon]');
    expect(dateTimeWithZoneId(248, 12, 30, 23, 59, 59, 3, 'CET').toString()).toEqual('0248-12-30T23:59:59.000000003[CET]');
  });

  it('should expose local time components in time', () => {
    const offsetTime = time(22, 12, 58, 999111222, 42);

    expect(offsetTime.hour).toEqual(neo4j.int(22));
    expect(offsetTime.minute).toEqual(neo4j.int(12));
    expect(offsetTime.second).toEqual(neo4j.int(58));
    expect(offsetTime.nanosecond).toEqual(neo4j.int(999111222));
  });

  it('should expose local date and time components in local date-time', () => {
    const dateTime = localDateTime(2025, 9, 18, 23, 22, 21, 2020);

    expect(dateTime.year).toEqual(neo4j.int(2025));
    expect(dateTime.month).toEqual(neo4j.int(9));
    expect(dateTime.day).toEqual(neo4j.int(18));

    expect(dateTime.hour).toEqual(neo4j.int(23));
    expect(dateTime.minute).toEqual(neo4j.int(22));
    expect(dateTime.second).toEqual(neo4j.int(21));
    expect(dateTime.nanosecond).toEqual(neo4j.int(2020));
  });

  it('should expose local date-time components in date-time with zone offset', () => {
    const zonedDateTime = dateTimeWithZoneOffset(1799, 5, 19, 18, 37, 59, 875387, 3600);

    expect(zonedDateTime.year).toEqual(neo4j.int(1799));
    expect(zonedDateTime.month).toEqual(neo4j.int(5));
    expect(zonedDateTime.day).toEqual(neo4j.int(19));

    expect(zonedDateTime.hour).toEqual(neo4j.int(18));
    expect(zonedDateTime.minute).toEqual(neo4j.int(37));
    expect(zonedDateTime.second).toEqual(neo4j.int(59));
    expect(zonedDateTime.nanosecond).toEqual(neo4j.int(875387));
  });

  it('should expose local date-time components in date-time with zone ID', () => {
    const zonedDateTime = dateTimeWithZoneId(2356, 7, 29, 23, 32, 11, 9346458, 3600, randomZoneId());

    expect(zonedDateTime.year).toEqual(neo4j.int(2356));
    expect(zonedDateTime.month).toEqual(neo4j.int(7));
    expect(zonedDateTime.day).toEqual(neo4j.int(29));

    expect(zonedDateTime.hour).toEqual(neo4j.int(23));
    expect(zonedDateTime.minute).toEqual(neo4j.int(32));
    expect(zonedDateTime.second).toEqual(neo4j.int(11));
    expect(zonedDateTime.nanosecond).toEqual(neo4j.int(9346458));
  });

  it('should format duration to string', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    testDurationToString([
      {duration: duration(0, 0, 0, 0), expectedString: 'P0M0DT0S'},

      {duration: duration(0, 0, 42, 0), expectedString: 'P0M0DT42S'},
      {duration: duration(0, 0, -42, 0), expectedString: 'P0M0DT-42S'},
      {duration: duration(0, 0, 1, 0), expectedString: 'P0M0DT1S'},
      {duration: duration(0, 0, -1, 0), expectedString: 'P0M0DT-1S'},

      {duration: duration(0, 0, 0, 5), expectedString: 'P0M0DT0.000000005S'},
      {duration: duration(0, 0, 0, -5), expectedString: 'P0M0DT-0.000000005S'},
      {duration: duration(0, 0, 0, 999999999), expectedString: 'P0M0DT0.999999999S'},
      {duration: duration(0, 0, 0, -999999999), expectedString: 'P0M0DT-0.999999999S'},

      {duration: duration(0, 0, 1, 5), expectedString: 'P0M0DT1.000000005S'},
      {duration: duration(0, 0, -1, -5), expectedString: 'P0M0DT-1.000000005S'},
      {duration: duration(0, 0, 1, -5), expectedString: 'P0M0DT0.999999995S'},
      {duration: duration(0, 0, -1, 5), expectedString: 'P0M0DT-0.999999995S'},
      {duration: duration(0, 0, 1, 999999999), expectedString: 'P0M0DT1.999999999S'},
      {duration: duration(0, 0, -1, -999999999), expectedString: 'P0M0DT-1.999999999S'},
      {duration: duration(0, 0, 1, -999999999), expectedString: 'P0M0DT0.000000001S'},
      {duration: duration(0, 0, -1, 999999999), expectedString: 'P0M0DT-0.000000001S'},

      {duration: duration(0, 0, 28, 9), expectedString: 'P0M0DT28.000000009S'},
      {duration: duration(0, 0, -28, 9), expectedString: 'P0M0DT-27.999999991S'},
      {duration: duration(0, 0, 28, -9), expectedString: 'P0M0DT27.999999991S'},
      {duration: duration(0, 0, -28, -9), expectedString: 'P0M0DT-28.000000009S'},

      {duration: duration(0, 0, -78036, -143000000), expectedString: 'P0M0DT-78036.143000000S'},

      {duration: duration(0, 0, 0, 1000000000), expectedString: 'P0M0DT1S'},
      {duration: duration(0, 0, 0, -1000000000), expectedString: 'P0M0DT-1S'},
      {duration: duration(0, 0, 0, 1000000007), expectedString: 'P0M0DT1.000000007S'},
      {duration: duration(0, 0, 0, -1000000007), expectedString: 'P0M0DT-1.000000007S'},

      {duration: duration(0, 0, 40, 2123456789), expectedString: 'P0M0DT42.123456789S'},
      {duration: duration(0, 0, -40, 2123456789), expectedString: 'P0M0DT-37.876543211S'},
      {duration: duration(0, 0, 40, -2123456789), expectedString: 'P0M0DT37.876543211S'},
      {duration: duration(0, 0, -40, -2123456789), expectedString: 'P0M0DT-42.123456789S'}
    ], done);
  });

  it('should normalize created duration', () => {
    const duration1 = duration(0, 0, 1, 1000000000);
    expect(duration1.seconds).toEqual(neo4j.int(2));
    expect(duration1.nanoseconds).toEqual(neo4j.int(0));

    const duration2 = duration(0, 0, 42, 1000000001);
    expect(duration2.seconds).toEqual(neo4j.int(43));
    expect(duration2.nanoseconds).toEqual(neo4j.int(1));

    const duration3 = duration(0, 0, 42, 42999111222);
    expect(duration3.seconds).toEqual(neo4j.int(84));
    expect(duration3.nanoseconds).toEqual(neo4j.int(999111222));

    const duration4 = duration(0, 0, 1, -1000000000);
    expect(duration4.seconds).toEqual(neo4j.int(0));
    expect(duration4.nanoseconds).toEqual(neo4j.int(0));

    const duration5 = duration(0, 0, 1, -1000000001);
    expect(duration5.seconds).toEqual(neo4j.int(-1));
    expect(duration5.nanoseconds).toEqual(neo4j.int(999999999));

    const duration6 = duration(0, 0, 40, -12123456999);
    expect(duration6.seconds).toEqual(neo4j.int(27));
    expect(duration6.nanoseconds).toEqual(neo4j.int(876543001));
  });

  function testSendAndReceiveRandomTemporalValues(valueGenerator, done) {
    const asyncFunction = (index, callback) => {
      const next = () => callback();
      next.fail = error => callback(error);
      testSendReceiveTemporalValue(valueGenerator(), next);
    };

    const doneFunction = error => {
      if (error) {
        done.fail(error);
      } else {
        done();
      }
    };

    timesSeries(RANDOM_VALUES_TO_TEST, asyncFunction, doneFunction);
  }

  function testSendAndReceiveArrayOfRandomTemporalValues(valueGenerator, done) {
    const arrayLength = _.random(MIN_TEMPORAL_ARRAY_LENGTH, MAX_TEMPORAL_ARRAY_LENGTH);
    const values = _.range(arrayLength).map(() => valueGenerator());
    testSendReceiveTemporalValue(values, done);
  }

  function testReceiveTemporalValue(query, expectedValue, done) {
    session.run(query).then(result => {
      const records = result.records;
      expect(records.length).toEqual(1);

      const value = records[0].get(0);
      expect(value).toEqual(expectedValue);

      session.close();
      done();
    }).catch(error => {
      done.fail(error);
    });
  }

  function testSendReceiveTemporalValue(value, done) {
    session.run('CREATE (n:Node {value: $value}) RETURN n.value', {value: value}).then(result => {
      const records = result.records;
      expect(records.length).toEqual(1);

      const receivedValue = records[0].get(0);
      expect(receivedValue).toEqual(value);

      session.close();
      done();
    }).catch(error => {
      done.fail(error);
    });
  }

  function testDurationToString(values, done) {
    const durations = values.map(value => value.duration);
    const expectedDurationStrings = values.map(value => value.expectedString);

    session.run('UNWIND $durations AS d RETURN d', {durations: durations}).then(result => {
      const receivedDurationStrings = result.records
        .map(record => record.get(0))
        .map(duration => duration.toString());

      expect(expectedDurationStrings).toEqual(receivedDurationStrings);
      done();
    }).catch(error => {
      done.fail(error);
    });
  }

  function neo4jDoesNotSupportTemporalTypes(done) {
    if (serverVersion.compareTo(VERSION_3_4_0) < 0) {
      done();
      return true;
    }
    return false;
  }

  function randomDuration() {
    const sign = _.sample([true, false]) ? 1 : -1; // duration can be negative
    return duration(
      sign * _.random(0, Number.MAX_SAFE_INTEGER),
      sign * _.random(0, Number.MAX_SAFE_INTEGER),
      sign * _.random(0, Number.MAX_SAFE_INTEGER),
      _.random(0, MAX_NANO_OF_SECOND),
    );
  }

  function randomDateTimeWithZoneOffset() {
    const dateTime = randomDstSafeLocalDateTime();
    return new neo4j.types.DateTime(dateTime.year, dateTime.month, dateTime.day, dateTime.hour, dateTime.minute, dateTime.second, dateTime.nanosecond,
      randomZoneOffsetSeconds(), null);
  }

  function randomDateTimeWithZoneId() {
    const dateTime = randomDstSafeLocalDateTime();
    return new neo4j.types.DateTime(dateTime.year, dateTime.month, dateTime.day, dateTime.hour, dateTime.minute, dateTime.second, dateTime.nanosecond,
      null, randomZoneId());
  }

  function randomDstSafeLocalDateTime() {
    const date = randomDate();
    const time = randomDstSafeLocalTime();
    return new neo4j.types.LocalDateTime(date.year, date.month, date.day, time.hour, time.minute, time.second, time.nanosecond);
  }

  function randomLocalDateTime() {
    const date = randomDate();
    const time = randomLocalTime();
    return new neo4j.types.LocalDateTime(date.year, date.month, date.day, time.hour, time.minute, time.second, time.nanosecond);
  }

  function randomDate() {
    return new neo4j.types.Date(
      randomInt(MIN_YEAR, MAX_YEAR),
      randomInt(1, 12),
      randomInt(1, 28)
    );
  }

  function randomTime() {
    const localTime = randomLocalTime();
    return new neo4j.types.Time(localTime.hour, localTime.minute, localTime.second, localTime.nanosecond, randomZoneOffsetSeconds());
  }

  function randomLocalTime() {
    return new neo4j.types.LocalTime(
      randomInt(0, 23),
      randomInt(0, 59),
      randomInt(0, 59),
      randomInt(0, MAX_NANO_OF_SECOND)
    );
  }

  function randomDstSafeLocalTime() {
    return new neo4j.types.LocalTime(
      randomInt(4, 23), // do not generate hours in range where DST adjustment happens
      randomInt(0, 59),
      randomInt(0, 59),
      randomInt(0, MAX_NANO_OF_SECOND)
    );
  }

  function randomZoneOffsetSeconds() {
    const randomOffsetWithSeconds = neo4j.int(randomInt(MIN_TIME_ZONE_OFFSET, MAX_TIME_ZONE_OFFSET));
    return randomOffsetWithSeconds.div(SECONDS_PER_MINUTE).multiply(SECONDS_PER_MINUTE); // truncate seconds
  }

  function randomZoneId() {
    return _.sample(ZONE_IDS);
  }

  function duration(months, days, seconds, nanoseconds) {
    return new neo4j.types.Duration(neo4j.int(months), neo4j.int(days), neo4j.int(seconds), neo4j.int(nanoseconds));
  }

  function localTime(hour, minute, second, nanosecond) {
    return new neo4j.types.LocalTime(neo4j.int(hour), neo4j.int(minute), neo4j.int(second), neo4j.int(nanosecond));
  }

  function time(hour, minute, second, nanosecond, offsetSeconds) {
    return new neo4j.types.Time(neo4j.int(hour), neo4j.int(minute), neo4j.int(second), neo4j.int(nanosecond), neo4j.int(offsetSeconds));
  }

  function date(year, month, day) {
    return new neo4j.types.Date(neo4j.int(year), neo4j.int(month), neo4j.int(day));
  }

  function localDateTime(year, month, day, hour, minute, second, nanosecond) {
    return new neo4j.types.LocalDateTime(neo4j.int(year), neo4j.int(month), neo4j.int(day),
      neo4j.int(hour), neo4j.int(minute), neo4j.int(second), neo4j.int(nanosecond));
  }

  function dateTimeWithZoneOffset(year, month, day, hour, minute, second, nanosecond, offsetSeconds) {
    return new neo4j.types.DateTime(neo4j.int(year), neo4j.int(month), neo4j.int(day),
      neo4j.int(hour), neo4j.int(minute), neo4j.int(second), neo4j.int(nanosecond), neo4j.int(offsetSeconds), null);
  }

  function dateTimeWithZoneId(year, month, day, hour, minute, second, nanosecond, zoneId) {
    return new neo4j.types.DateTime(neo4j.int(year), neo4j.int(month), neo4j.int(day),
      neo4j.int(hour), neo4j.int(minute), neo4j.int(second), neo4j.int(nanosecond), null, zoneId);
  }

  function randomInt(lower, upper) {
    return neo4j.int(_.random(lower, upper));
  }
});

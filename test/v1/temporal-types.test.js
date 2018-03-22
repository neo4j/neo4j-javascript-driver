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

import neo4j from '../../src/v1';
import {int} from '../../src/v1/integer';
import sharedNeo4j from '../internal/shared-neo4j';
import {ServerVersion, VERSION_3_4_0} from '../../src/v1/internal/server-version';
import timesSeries from 'async/timesSeries';
import _ from 'lodash';
import {
  CypherDate,
  CypherDateTimeWithZoneId,
  CypherDateTimeWithZoneOffset,
  CypherDuration,
  CypherLocalDateTime,
  CypherLocalTime,
  CypherTime
} from '../../src/v1/temporal-types';

const RANDOM_VALUES_TO_TEST = 2000;
const MAX_NANO_OF_SECOND = 999999999;
const MAX_YEAR = 999999999;
const MIN_YEAR = -MAX_YEAR;
const MAX_TIME_ZONE_OFFSET = 64800;
const MIN_TIME_ZONE_OFFSET = -MAX_TIME_ZONE_OFFSET;
const SECONDS_PER_MINUTE = 60;
const MIN_ZONE_ID = 'Etc/GMT+12';
const MAX_ZONE_ID = 'Etc/GMT-14';
const ZONE_IDS = ['Europe/Zaporozhye', 'America/Argentina/Mendoza', 'Etc/GMT-12', 'Asia/Jayapura', 'Pacific/Auckland', 'America/Argentina/Rio_Gallegos',
  'America/Tegucigalpa', 'Europe/Skopje', 'Africa/Lome', 'America/Eirunepe', 'Pacific/Port_Moresby', 'America/Merida', 'Asia/Qyzylorda', 'Hongkong',
  'America/Paramaribo', 'Pacific/Wallis', 'Antarctica/Mawson', 'America/Metlakatla', 'Indian/Reunion', 'Asia/Chungking', 'Canada/Central', 'Etc/GMT-6',
  'UCT', 'America/Belem', 'Europe/Belgrade', 'Singapore', 'Israel', 'Europe/London', 'America/Yellowknife', 'Europe/Uzhgorod', 'Etc/GMT+7',
  'America/Indiana/Winamac', 'Asia/Kuala_Lumpur', 'America/Cuiaba', 'Europe/Sofia', 'Asia/Kuching', 'Australia/Lord_Howe', 'America/Porto_Acre',
  'America/Indiana/Indianapolis', 'Africa/Windhoek', 'Atlantic/Cape_Verde', 'Asia/Kuwait', 'America/Barbados', 'Egypt', 'GB-Eire', 'Antarctica/South_Pole',
  'America/Kentucky/Louisville', 'Asia/Yangon', 'CET', 'Etc/GMT+11', 'Asia/Dubai', 'Europe/Stockholm'];

describe('temporal-types', () => {

  let originalTimeout;
  let driver;
  let session;
  let serverVersion;

  beforeAll(done => {
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;

    driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken);
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

    const valueGenerator = () => {
      const sign = _.sample([true, false]) ? 1 : -1; // duration can be negative
      return duration(
        sign * _.random(0, Number.MAX_SAFE_INTEGER),
        sign * _.random(0, Number.MAX_SAFE_INTEGER),
        sign * _.random(0, Number.MAX_SAFE_INTEGER),
        sign * _.random(0, MAX_NANO_OF_SECOND),
      );
    };

    testSendAndReceiveRandomTemporalValues(valueGenerator, done);
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

  it('should send and receive random LocalTime', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const valueGenerator = () => randomLocalTime();

    testSendAndReceiveRandomTemporalValues(valueGenerator, done);
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

  it('should send and receive random Time', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const valueGenerator = () => randomTime();

    testSendAndReceiveRandomTemporalValues(valueGenerator, done);
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

  it('should send and receive random Date', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const valueGenerator = () => randomDate();

    testSendAndReceiveRandomTemporalValues(valueGenerator, done);
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

  it('should send and receive random LocalDateTime', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const valueGenerator = () => randomLocalDateTime();

    testSendAndReceiveRandomTemporalValues(valueGenerator, done);
  });

  it('should receive DateTimeWithZoneOffset', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const expectedValue = dateTimeWithZoneOffset(1992, 11, 24, 9, 55, 42, 999, 18000);
    testReceiveTemporalValue('RETURN datetime({year: 1992, month: 11, day: 24, hour: 9, minute: 55, second: 42, nanosecond: 999, timezone: "+05:00"})', expectedValue, done);
  });

  it('should send and receive max DateTimeWithZoneOffset', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const maxDateTime = dateTimeWithZoneOffset(MAX_YEAR, 12, 31, 23, 59, 59, MAX_NANO_OF_SECOND, MAX_TIME_ZONE_OFFSET);
    testSendReceiveTemporalValue(maxDateTime, done);
  });

  it('should send and receive min DateTimeWithZoneOffset', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const minDateTime = dateTimeWithZoneOffset(MIN_YEAR, 1, 1, 0, 0, 0, 0, MAX_TIME_ZONE_OFFSET);
    testSendReceiveTemporalValue(minDateTime, done);
  });

  it('should send and receive random DateTimeWithZoneOffset', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const valueGenerator = () => randomDateTimeWithZoneOffset();

    testSendAndReceiveRandomTemporalValues(valueGenerator, done);
  });

  it('should receive DateTimeWithZoneId', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const expectedValue = dateTimeWithZoneId(1992, 11, 24, 9, 55, 42, 999, 'Europe/Stockholm');
    testReceiveTemporalValue('RETURN datetime({year: 1992, month: 11, day: 24, hour: 9, minute: 55, second: 42, nanosecond: 999, timezone: "Europe/Stockholm"})', expectedValue, done);
  });

  it('should send and receive max DateTimeWithZoneId', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const maxDateTime = dateTimeWithZoneId(MAX_YEAR, 12, 31, 23, 59, 59, MAX_NANO_OF_SECOND, MAX_ZONE_ID);
    testSendReceiveTemporalValue(maxDateTime, done);
  });

  it('should send and receive min DateTimeWithZoneId', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const minDateTime = dateTimeWithZoneId(MIN_YEAR, 1, 1, 0, 0, 0, 0, MIN_ZONE_ID);
    testSendReceiveTemporalValue(minDateTime, done);
  });

  it('should send and receive random DateTimeWithZoneId', done => {
    if (neo4jDoesNotSupportTemporalTypes(done)) {
      return;
    }

    const valueGenerator = () => randomDateTimeWithZoneId();

    testSendAndReceiveRandomTemporalValues(valueGenerator, done);
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

  function neo4jDoesNotSupportTemporalTypes(done) {
    if (serverVersion.compareTo(VERSION_3_4_0) < 0) {
      done();
      return true;
    }
    return false;
  }

  function randomDateTimeWithZoneOffset() {
    return new CypherDateTimeWithZoneOffset(
      randomLocalDateTime(),
      randomZoneOffsetSeconds()
    );
  }

  function randomDateTimeWithZoneId() {
    return new CypherDateTimeWithZoneId(
      randomLocalDateTime(),
      randomZoneId()
    );
  }

  function randomLocalDateTime() {
    return new CypherLocalDateTime(randomDate(), randomLocalTime());
  }

  function randomDate() {
    return new CypherDate(
      randomInt(MIN_YEAR, MAX_YEAR),
      randomInt(1, 12),
      randomInt(1, 28)
    );
  }

  function randomTime() {
    return new CypherTime(
      randomLocalTime(),
      randomZoneOffsetSeconds(),
    );
  }

  function randomLocalTime() {
    return new CypherLocalTime(
      randomInt(0, 23),
      randomInt(0, 59),
      randomInt(0, 59),
      randomInt(0, MAX_NANO_OF_SECOND)
    );
  }

  function randomZoneOffsetSeconds() {
    const randomOffsetWithSeconds = int(randomInt(MIN_TIME_ZONE_OFFSET, MAX_TIME_ZONE_OFFSET));
    return randomOffsetWithSeconds.div(SECONDS_PER_MINUTE).multiply(SECONDS_PER_MINUTE); // truncate seconds
  }

  function randomZoneId() {
    return _.sample(ZONE_IDS);
  }

  function duration(months, days, seconds, nanoseconds) {
    return new CypherDuration(int(months), int(days), int(seconds), int(nanoseconds));
  }

  function localTime(hour, minute, second, nanosecond) {
    return new CypherLocalTime(int(hour), int(minute), int(second), int(nanosecond));
  }

  function time(hour, minute, second, nanosecond, offsetSeconds) {
    return new CypherTime(localTime(hour, minute, second, nanosecond), int(offsetSeconds));
  }

  function date(year, month, day) {
    return new CypherDate(int(year), int(month), int(day));
  }

  function localDateTime(year, month, day, hour, minute, second, nanosecond) {
    return new CypherLocalDateTime(date(year, month, day), localTime(hour, minute, second, nanosecond));
  }

  function dateTimeWithZoneOffset(year, month, day, hour, minute, second, nanosecond, offsetSeconds) {
    return new CypherDateTimeWithZoneOffset(localDateTime(year, month, day, hour, minute, second, nanosecond), int(offsetSeconds));
  }

  function dateTimeWithZoneId(year, month, day, hour, minute, second, nanosecond, zoneId) {
    return new CypherDateTimeWithZoneId(localDateTime(year, month, day, hour, minute, second, nanosecond), zoneId);
  }

  function randomInt(lower, upper) {
    return int(_.random(lower, upper));
  }
});

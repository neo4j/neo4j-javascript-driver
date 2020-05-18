/**
 * Copyright (c) 2002-2020 "Neo4j,"
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

import neo4j from '../src'
import sharedNeo4j from './internal/shared-neo4j'
import {
  timeZoneOffsetInSeconds,
  totalNanoseconds
} from '../src/internal/temporal-util'
import timesSeries from 'async/timesSeries'
import _ from 'lodash'
import testUtils from './internal/test-utils'

const RANDOM_VALUES_TO_TEST = 2000
const MIN_TEMPORAL_ARRAY_LENGTH = 20
const MAX_TEMPORAL_ARRAY_LENGTH = 1000
/**
 * Duration in neo4j is limited to `Long.MAX_VALUE` when converted to seconds.
 * This bound should be used for all components of duration, except nanoseconds.
 * It's a fairly random large value that allows created duration to not overflow.
 * @type {number}
 */
const MAX_DURATION_COMPONENT = 3000000000000
const MAX_NANO_OF_SECOND = 999999999
const MAX_YEAR = 999999999
const MIN_YEAR = -MAX_YEAR
const MAX_TIME_ZONE_OFFSET = 64800
const MIN_TIME_ZONE_OFFSET = -MAX_TIME_ZONE_OFFSET
const SECONDS_PER_MINUTE = 60
const MIN_ZONE_ID = 'Etc/GMT+12'
const MAX_ZONE_ID = 'Etc/GMT-14'
const ZONE_IDS = ['Europe/Zaporozhye', 'Europe/London', 'UTC', 'Africa/Cairo']

describe('#integration temporal-types', () => {
  let originalTimeout
  let driver
  let driverWithNativeNumbers
  let session
  let protocolVersion

  beforeAll(() => {
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000

    driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken)
    driverWithNativeNumbers = neo4j.driver(
      'bolt://localhost',
      sharedNeo4j.authToken,
      { disableLosslessIntegers: true }
    )
  })

  afterAll(async () => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout

    if (driver) {
      await driver.close()
      driver = null
    }

    if (driverWithNativeNumbers) {
      await driverWithNativeNumbers.close()
      driverWithNativeNumbers = null
    }
  })

  beforeEach(async () => {
    session = driver.session()
    protocolVersion = await sharedNeo4j.cleanupAndGetProtocolVersion(driver)
  })

  afterEach(async () => {
    if (session) {
      await session.close()
      session = null
    }
  })

  it('should receive Duration', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    const expectedValue = duration(27, 17, 91, 999)
    await testReceiveTemporalValue(
      'RETURN duration({years: 2, months: 3, days: 17, seconds: 91, nanoseconds: 999})',
      expectedValue
    )
  })

  it('should send and receive random Duration', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    await testSendAndReceiveRandomTemporalValues(() => randomDuration())
  })

  it('should send and receive Duration when disableLosslessIntegers=true', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }
    session = driverWithNativeNumbers.session()

    await testSendReceiveTemporalValue(
      new neo4j.types.Duration(4, 15, 931, 99953)
    )
  })

  it('should send and receive array of Duration', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    await testSendAndReceiveArrayOfRandomTemporalValues(() => randomDuration())
  })

  it('should receive LocalTime', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    const expectedValue = localTime(22, 59, 10, 999999)
    await testReceiveTemporalValue(
      'RETURN localtime({hour: 22, minute: 59, second: 10, nanosecond: 999999})',
      expectedValue
    )
  })

  it('should send and receive max LocalTime', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    const maxLocalTime = localTime(23, 59, 59, MAX_NANO_OF_SECOND)
    await testSendReceiveTemporalValue(maxLocalTime)
  })

  it('should send and receive min LocalTime', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    const minLocalTime = localTime(0, 0, 0, 0)
    await testSendReceiveTemporalValue(minLocalTime)
  })

  it('should send and receive LocalTime when disableLosslessIntegers=true', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }
    session = driverWithNativeNumbers.session()

    await testSendReceiveTemporalValue(
      new neo4j.types.LocalTime(12, 32, 56, 12345)
    )
  })

  it('should send and receive random LocalTime', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    await testSendAndReceiveRandomTemporalValues(() => randomLocalTime())
  })

  it('should send and receive array of LocalTime', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    await testSendAndReceiveArrayOfRandomTemporalValues(() => randomLocalTime())
  })

  it('should receive Time', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    const expectedValue = time(11, 42, 59, 9999, -30600)
    await testReceiveTemporalValue(
      'RETURN time({hour: 11, minute: 42, second: 59, nanosecond: 9999, timezone:"-08:30"})',
      expectedValue
    )
  })

  it('should send and receive max Time', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    const maxTime = time(23, 59, 59, MAX_NANO_OF_SECOND, MAX_TIME_ZONE_OFFSET)
    await testSendReceiveTemporalValue(maxTime)
  })

  it('should send and receive min Time', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    const minTime = time(0, 0, 0, 0, MIN_TIME_ZONE_OFFSET)
    await testSendReceiveTemporalValue(minTime)
  })

  it('should send and receive Time when disableLosslessIntegers=true', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }
    session = driverWithNativeNumbers.session()

    await testSendReceiveTemporalValue(
      new neo4j.types.Time(22, 19, 32, 18381, MAX_TIME_ZONE_OFFSET)
    )
  })

  it('should send and receive random Time', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    await testSendAndReceiveRandomTemporalValues(() => randomTime())
  })

  it('should send and receive array of Time', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    await testSendAndReceiveArrayOfRandomTemporalValues(() => randomTime())
  })

  it('should receive Date', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    const expectedValue = date(1995, 7, 28)
    await testReceiveTemporalValue(
      'RETURN date({year: 1995, month: 7, day: 28})',
      expectedValue
    )
  })

  it('should send and receive max Date', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    const maxDate = date(MAX_YEAR, 12, 31)
    await testSendReceiveTemporalValue(maxDate)
  })

  it('should send and receive min Date', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    const minDate = date(MIN_YEAR, 1, 1)
    await testSendReceiveTemporalValue(minDate)
  })

  it('should send and receive Date when disableLosslessIntegers=true', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }
    session = driverWithNativeNumbers.session()

    await testSendReceiveTemporalValue(new neo4j.types.Date(1923, 8, 14))
  })

  it('should send and receive random Date', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    await testSendAndReceiveRandomTemporalValues(() => randomDate())
  })

  it('should send and receive array of Date', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    await testSendAndReceiveArrayOfRandomTemporalValues(() => randomDate())
  })

  it('should receive LocalDateTime', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    const expectedValue = localDateTime(1869, 9, 23, 18, 29, 59, 12349)
    await testReceiveTemporalValue(
      'RETURN localdatetime({year: 1869, month: 9, day: 23, hour: 18, minute: 29, second: 59, nanosecond: 12349})',
      expectedValue
    )
  })

  it('should send and receive max LocalDateTime', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    const maxLocalDateTime = localDateTime(
      MAX_YEAR,
      12,
      31,
      23,
      59,
      59,
      MAX_NANO_OF_SECOND
    )
    await testSendReceiveTemporalValue(maxLocalDateTime)
  })

  it('should send and receive min LocalDateTime', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    const minLocalDateTime = localDateTime(MIN_YEAR, 1, 1, 0, 0, 0, 0)
    await testSendReceiveTemporalValue(minLocalDateTime)
  })

  it('should send and receive LocalDateTime when disableLosslessIntegers=true', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }
    session = driverWithNativeNumbers.session()

    await testSendReceiveTemporalValue(
      new neo4j.types.LocalDateTime(2045, 9, 1, 11, 25, 25, 911)
    )
  })

  it('should send and receive random LocalDateTime', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    await testSendAndReceiveRandomTemporalValues(() => randomLocalDateTime())
  })

  it('should send and receive random LocalDateTime', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    await testSendAndReceiveArrayOfRandomTemporalValues(() =>
      randomLocalDateTime()
    )
  })

  it('should receive DateTime with time zone offset', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    const expectedValue = dateTimeWithZoneOffset(
      1992,
      11,
      24,
      9,
      55,
      42,
      999,
      18000
    )
    await testReceiveTemporalValue(
      'RETURN datetime({year: 1992, month: 11, day: 24, hour: 9, minute: 55, second: 42, nanosecond: 999, timezone: "+05:00"})',
      expectedValue
    )
  })

  it('should send and receive max DateTime with zone offset', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    const maxDateTime = dateTimeWithZoneOffset(
      MAX_YEAR,
      12,
      31,
      23,
      59,
      59,
      MAX_NANO_OF_SECOND,
      MAX_TIME_ZONE_OFFSET
    )
    await testSendReceiveTemporalValue(maxDateTime)
  })

  it('should send and receive min DateTime with zone offset', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    const minDateTime = dateTimeWithZoneOffset(
      MIN_YEAR,
      1,
      1,
      0,
      0,
      0,
      0,
      MAX_TIME_ZONE_OFFSET
    )
    await testSendReceiveTemporalValue(minDateTime)
  })

  it('should send and receive DateTime with zone offset when disableLosslessIntegers=true', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }
    session = driverWithNativeNumbers.session()

    await testSendReceiveTemporalValue(
      new neo4j.types.DateTime(
        2022,
        2,
        7,
        17,
        15,
        59,
        12399,
        MAX_TIME_ZONE_OFFSET,
        null
      )
    )
  })

  it('should send and receive random DateTime with zone offset', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    await testSendAndReceiveRandomTemporalValues(() =>
      randomDateTimeWithZoneOffset()
    )
  })

  it('should send and receive array of DateTime with zone offset', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    await testSendAndReceiveArrayOfRandomTemporalValues(() =>
      randomDateTimeWithZoneOffset()
    )
  })

  it('should receive DateTime with zone id', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    const expectedValue = dateTimeWithZoneId(
      1992,
      11,
      24,
      9,
      55,
      42,
      999,
      'Europe/Stockholm'
    )
    await testReceiveTemporalValue(
      'RETURN datetime({year: 1992, month: 11, day: 24, hour: 9, minute: 55, second: 42, nanosecond: 999, timezone: "Europe/Stockholm"})',
      expectedValue
    )
  })

  it('should send and receive max DateTime with zone id', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    const maxDateTime = dateTimeWithZoneId(
      MAX_YEAR,
      12,
      31,
      23,
      59,
      59,
      MAX_NANO_OF_SECOND,
      MAX_ZONE_ID
    )
    await testSendReceiveTemporalValue(maxDateTime)
  })

  it('should send and receive min DateTime with zone id', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    const minDateTime = dateTimeWithZoneId(
      MIN_YEAR,
      1,
      1,
      0,
      0,
      0,
      0,
      MIN_ZONE_ID
    )
    await testSendReceiveTemporalValue(minDateTime)
  })

  it('should send and receive DateTime with zone id when disableLosslessIntegers=true', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }
    session = driverWithNativeNumbers.session()

    await testSendReceiveTemporalValue(
      new neo4j.types.DateTime(
        2011,
        11,
        25,
        23,
        59,
        59,
        192378,
        null,
        'Europe/Stockholm'
      )
    )
  })

  it('should send and receive random DateTime with zone id', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    await testSendAndReceiveRandomTemporalValues(() =>
      randomDateTimeWithZoneId()
    )
  })

  it('should send and receive array of DateTime with zone id', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    await testSendAndReceiveArrayOfRandomTemporalValues(() =>
      randomDateTimeWithZoneId()
    )
  })

  it('should convert Duration to ISO string', () => {
    expect(duration(13, 62, 3, 999111999).toString()).toEqual(
      'P13M62DT3.999111999S'
    )
    expect(duration(0, 0, 0, 0).toString()).toEqual('P0M0DT0S')
    expect(duration(-1, -2, 10, 10).toString()).toEqual('P-1M-2DT10.000000010S')
  })

  it('should convert LocalTime to ISO string', () => {
    expect(localTime(12, 19, 39, 111222333).toString()).toEqual(
      '12:19:39.111222333'
    )
    expect(localTime(3, 59, 2, 17).toString()).toEqual('03:59:02.000000017')
    expect(localTime(0, 0, 0, 0).toString()).toEqual('00:00:00')
  })

  it('should convert Time to ISO string', () => {
    expect(time(11, 45, 22, 333222111, 9015).toString()).toEqual(
      '11:45:22.333222111+02:30:15'
    )
    expect(time(23, 2, 1, 10, 0).toString()).toEqual('23:02:01.000000010Z')
    expect(time(0, 12, 59, 0, -40500).toString()).toEqual('00:12:59-11:15')
    expect(time(21, 59, 0, 123, -25200).toString()).toEqual(
      '21:59:00.000000123-07:00'
    )
  })

  it('should convert Date to ISO string', () => {
    expect(date(2015, 10, 12).toString()).toEqual('2015-10-12')
    expect(date(881, 1, 1).toString()).toEqual('0881-01-01')
    expect(date(-999, 12, 24).toString()).toEqual('-0999-12-24')
    expect(date(-9, 1, 1).toString()).toEqual('-0009-01-01')
  })

  it('should convert LocalDateTime to ISO string', () => {
    expect(localDateTime(1992, 11, 8, 9, 42, 17, 22).toString()).toEqual(
      '1992-11-08T09:42:17.000000022'
    )
    expect(localDateTime(-10, 7, 15, 8, 15, 33, 500).toString()).toEqual(
      '-0010-07-15T08:15:33.000000500'
    )
    expect(localDateTime(0, 1, 1, 0, 0, 0, 1).toString()).toEqual(
      '0000-01-01T00:00:00.000000001'
    )
  })

  it('should convert DateTime with time zone offset to ISO string', () => {
    expect(
      dateTimeWithZoneOffset(2025, 9, 17, 23, 22, 21, 999888, 37800).toString()
    ).toEqual('2025-09-17T23:22:21.000999888+10:30')
    expect(
      dateTimeWithZoneOffset(1, 2, 3, 4, 5, 6, 7, -49376).toString()
    ).toEqual('0001-02-03T04:05:06.000000007-13:42:56')
    expect(
      dateTimeWithZoneOffset(-3, 3, 9, 9, 33, 27, 999000, 15300).toString()
    ).toEqual('-0003-03-09T09:33:27.000999000+04:15')
  })

  it('should convert DateTime with time zone id to ISO-like string', () => {
    expect(
      dateTimeWithZoneId(
        1949,
        10,
        7,
        6,
        10,
        15,
        15000000,
        'Europe/Zaporozhye'
      ).toString()
    ).toEqual('1949-10-07T06:10:15.015000000[Europe/Zaporozhye]')
    expect(
      dateTimeWithZoneId(
        -30455,
        5,
        5,
        12,
        24,
        10,
        123,
        'Asia/Yangon'
      ).toString()
    ).toEqual('-30455-05-05T12:24:10.000000123[Asia/Yangon]')
    expect(
      dateTimeWithZoneId(248, 12, 30, 23, 59, 59, 3, 'CET').toString()
    ).toEqual('0248-12-30T23:59:59.000000003[CET]')
  })

  it('should expose local time components in time', () => {
    const offsetTime = time(22, 12, 58, 999111222, 42)

    expect(offsetTime.hour).toEqual(neo4j.int(22))
    expect(offsetTime.minute).toEqual(neo4j.int(12))
    expect(offsetTime.second).toEqual(neo4j.int(58))
    expect(offsetTime.nanosecond).toEqual(neo4j.int(999111222))
  })

  it('should expose local date and time components in local date-time', () => {
    const dateTime = localDateTime(2025, 9, 18, 23, 22, 21, 2020)

    expect(dateTime.year).toEqual(neo4j.int(2025))
    expect(dateTime.month).toEqual(neo4j.int(9))
    expect(dateTime.day).toEqual(neo4j.int(18))

    expect(dateTime.hour).toEqual(neo4j.int(23))
    expect(dateTime.minute).toEqual(neo4j.int(22))
    expect(dateTime.second).toEqual(neo4j.int(21))
    expect(dateTime.nanosecond).toEqual(neo4j.int(2020))
  })

  it('should expose local date-time components in date-time with zone offset', () => {
    const zonedDateTime = dateTimeWithZoneOffset(
      1799,
      5,
      19,
      18,
      37,
      59,
      875387,
      3600
    )

    expect(zonedDateTime.year).toEqual(neo4j.int(1799))
    expect(zonedDateTime.month).toEqual(neo4j.int(5))
    expect(zonedDateTime.day).toEqual(neo4j.int(19))

    expect(zonedDateTime.hour).toEqual(neo4j.int(18))
    expect(zonedDateTime.minute).toEqual(neo4j.int(37))
    expect(zonedDateTime.second).toEqual(neo4j.int(59))
    expect(zonedDateTime.nanosecond).toEqual(neo4j.int(875387))
  })

  it('should expose local date-time components in date-time with zone ID', () => {
    const zonedDateTime = dateTimeWithZoneId(
      2356,
      7,
      29,
      23,
      32,
      11,
      9346458,
      randomZoneId()
    )

    expect(zonedDateTime.year).toEqual(neo4j.int(2356))
    expect(zonedDateTime.month).toEqual(neo4j.int(7))
    expect(zonedDateTime.day).toEqual(neo4j.int(29))

    expect(zonedDateTime.hour).toEqual(neo4j.int(23))
    expect(zonedDateTime.minute).toEqual(neo4j.int(32))
    expect(zonedDateTime.second).toEqual(neo4j.int(11))
    expect(zonedDateTime.nanosecond).toEqual(neo4j.int(9346458))
  })

  it('should format duration to string', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    await testDurationToString([
      { duration: duration(0, 0, 0, 0), expectedString: 'P0M0DT0S' },

      { duration: duration(0, 0, 42, 0), expectedString: 'P0M0DT42S' },
      { duration: duration(0, 0, -42, 0), expectedString: 'P0M0DT-42S' },
      { duration: duration(0, 0, 1, 0), expectedString: 'P0M0DT1S' },
      { duration: duration(0, 0, -1, 0), expectedString: 'P0M0DT-1S' },

      {
        duration: duration(0, 0, 0, 5),
        expectedString: 'P0M0DT0.000000005S'
      },
      {
        duration: duration(0, 0, 0, -5),
        expectedString: 'P0M0DT-0.000000005S'
      },
      {
        duration: duration(0, 0, 0, 999999999),
        expectedString: 'P0M0DT0.999999999S'
      },
      {
        duration: duration(0, 0, 0, -999999999),
        expectedString: 'P0M0DT-0.999999999S'
      },

      {
        duration: duration(0, 0, 1, 5),
        expectedString: 'P0M0DT1.000000005S'
      },
      {
        duration: duration(0, 0, -1, -5),
        expectedString: 'P0M0DT-1.000000005S'
      },
      {
        duration: duration(0, 0, 1, -5),
        expectedString: 'P0M0DT0.999999995S'
      },
      {
        duration: duration(0, 0, -1, 5),
        expectedString: 'P0M0DT-0.999999995S'
      },
      {
        duration: duration(0, 0, 1, 999999999),
        expectedString: 'P0M0DT1.999999999S'
      },
      {
        duration: duration(0, 0, -1, -999999999),
        expectedString: 'P0M0DT-1.999999999S'
      },
      {
        duration: duration(0, 0, 1, -999999999),
        expectedString: 'P0M0DT0.000000001S'
      },
      {
        duration: duration(0, 0, -1, 999999999),
        expectedString: 'P0M0DT-0.000000001S'
      },

      {
        duration: duration(0, 0, 28, 9),
        expectedString: 'P0M0DT28.000000009S'
      },
      {
        duration: duration(0, 0, -28, 9),
        expectedString: 'P0M0DT-27.999999991S'
      },
      {
        duration: duration(0, 0, 28, -9),
        expectedString: 'P0M0DT27.999999991S'
      },
      {
        duration: duration(0, 0, -28, -9),
        expectedString: 'P0M0DT-28.000000009S'
      },

      {
        duration: duration(0, 0, -78036, -143000000),
        expectedString: 'P0M0DT-78036.143000000S'
      },

      { duration: duration(0, 0, 0, 1000000000), expectedString: 'P0M0DT1S' },
      {
        duration: duration(0, 0, 0, -1000000000),
        expectedString: 'P0M0DT-1S'
      },
      {
        duration: duration(0, 0, 0, 1000000007),
        expectedString: 'P0M0DT1.000000007S'
      },
      {
        duration: duration(0, 0, 0, -1000000007),
        expectedString: 'P0M0DT-1.000000007S'
      },

      {
        duration: duration(0, 0, 40, 2123456789),
        expectedString: 'P0M0DT42.123456789S'
      },
      {
        duration: duration(0, 0, -40, 2123456789),
        expectedString: 'P0M0DT-37.876543211S'
      },
      {
        duration: duration(0, 0, 40, -2123456789),
        expectedString: 'P0M0DT37.876543211S'
      },
      {
        duration: duration(0, 0, -40, -2123456789),
        expectedString: 'P0M0DT-42.123456789S'
      }
    ])
  })

  it('should normalize created duration', () => {
    const duration1 = duration(0, 0, 1, 1000000000)
    expect(duration1.seconds).toEqual(neo4j.int(2))
    expect(duration1.nanoseconds).toEqual(neo4j.int(0))

    const duration2 = duration(0, 0, 42, 1000000001)
    expect(duration2.seconds).toEqual(neo4j.int(43))
    expect(duration2.nanoseconds).toEqual(neo4j.int(1))

    const duration3 = duration(0, 0, 42, 42999111222)
    expect(duration3.seconds).toEqual(neo4j.int(84))
    expect(duration3.nanoseconds).toEqual(neo4j.int(999111222))

    const duration4 = duration(0, 0, 1, -1000000000)
    expect(duration4.seconds).toEqual(neo4j.int(0))
    expect(duration4.nanoseconds).toEqual(neo4j.int(0))

    const duration5 = duration(0, 0, 1, -1000000001)
    expect(duration5.seconds).toEqual(neo4j.int(-1))
    expect(duration5.nanoseconds).toEqual(neo4j.int(999999999))

    const duration6 = duration(0, 0, 40, -12123456999)
    expect(duration6.seconds).toEqual(neo4j.int(27))
    expect(duration6.nanoseconds).toEqual(neo4j.int(876543001))
  })

  it('should validate types of constructor arguments for Duration', () => {
    expect(() => new neo4j.types.Duration('1', 2, 3, 4)).toThrowError(TypeError)
    expect(() => new neo4j.types.Duration(1, '2', 3, 4)).toThrowError(TypeError)
    expect(() => new neo4j.types.Duration(1, 2, [3], 4)).toThrowError(TypeError)
    expect(() => new neo4j.types.Duration(1, 2, 3, { value: 4 })).toThrowError(
      TypeError
    )
    expect(
      () =>
        new neo4j.types.Duration({
          months: 1,
          days: 2,
          seconds: 3,
          nanoseconds: 4
        })
    ).toThrowError(TypeError)
  })

  it('should validate types of constructor arguments for LocalTime', () => {
    expect(() => new neo4j.types.LocalTime('1', 2, 3, 4)).toThrowError(
      TypeError
    )
    expect(() => new neo4j.types.LocalTime(1, '2', 3, 4)).toThrowError(
      TypeError
    )
    expect(() => new neo4j.types.LocalTime(1, 2, [3], 4)).toThrowError(
      TypeError
    )
    expect(() => new neo4j.types.LocalTime(1, 2, 3, { value: 4 })).toThrowError(
      TypeError
    )
    expect(
      () =>
        new neo4j.types.LocalTime({
          hour: 1,
          minute: 2,
          seconds: 3,
          nanosecond: 4
        })
    ).toThrowError(TypeError)
  })

  it('should validate types of constructor arguments for Time', () => {
    expect(() => new neo4j.types.Time('1', 2, 3, 4, 5)).toThrowError(TypeError)
    expect(() => new neo4j.types.Time(1, '2', 3, 4, 5)).toThrowError(TypeError)
    expect(() => new neo4j.types.Time(1, 2, [3], 4, 5)).toThrowError(TypeError)
    expect(() => new neo4j.types.Time(1, 2, 3, { value: 4 }, 5)).toThrowError(
      TypeError
    )
    expect(() => new neo4j.types.Time(1, 2, 3, 4, () => 5)).toThrowError(
      TypeError
    )
    expect(
      () =>
        new neo4j.types.Time({
          hour: 1,
          minute: 2,
          seconds: 3,
          nanosecond: 4,
          timeZoneOffsetSeconds: 5
        })
    ).toThrowError(TypeError)
  })

  it('should validate types of constructor arguments for Date', () => {
    expect(() => new neo4j.types.Date('1', 2, 3)).toThrowError(TypeError)
    expect(() => new neo4j.types.Date(1, [2], 3)).toThrowError(TypeError)
    expect(() => new neo4j.types.Date(1, 2, () => 3)).toThrowError(TypeError)
    expect(
      () => new neo4j.types.Date({ year: 1, month: 2, day: 3 })
    ).toThrowError(TypeError)
  })

  it('should validate types of constructor arguments for LocalDateTime', () => {
    expect(
      () => new neo4j.types.LocalDateTime('1', 2, 3, 4, 5, 6, 7)
    ).toThrowError(TypeError)
    expect(
      () => new neo4j.types.LocalDateTime(1, '2', 3, 4, 5, 6, 7)
    ).toThrowError(TypeError)
    expect(
      () => new neo4j.types.LocalDateTime(1, 2, [3], 4, 5, 6, 7)
    ).toThrowError(TypeError)
    expect(
      () => new neo4j.types.LocalDateTime(1, 2, 3, [4], 5, 6, 7)
    ).toThrowError(TypeError)
    expect(
      () => new neo4j.types.LocalDateTime(1, 2, 3, 4, () => 5, 6, 7)
    ).toThrowError(TypeError)
    expect(
      () => new neo4j.types.LocalDateTime(1, 2, 3, 4, 5, () => 6, 7)
    ).toThrowError(TypeError)
    expect(
      () => new neo4j.types.LocalDateTime(1, 2, 3, 4, 5, 6, { value: 7 })
    ).toThrowError(TypeError)
    expect(
      () =>
        new neo4j.types.LocalDateTime({
          year: 1,
          month: 2,
          day: 3,
          hour: 4,
          minute: 5,
          second: 6,
          nanosecond: 7
        })
    ).toThrowError(TypeError)
  })

  it('should validate types of constructor arguments for DateTime', () => {
    expect(
      () => new neo4j.types.DateTime('1', 2, 3, 4, 5, 6, 7, 8)
    ).toThrowError(TypeError)
    expect(
      () => new neo4j.types.DateTime(1, '2', 3, 4, 5, 6, 7, 8)
    ).toThrowError(TypeError)
    expect(
      () => new neo4j.types.DateTime(1, 2, [3], 4, 5, 6, 7, 8)
    ).toThrowError(TypeError)
    expect(
      () => new neo4j.types.DateTime(1, 2, 3, [4], 5, 6, 7, 8)
    ).toThrowError(TypeError)
    expect(
      () => new neo4j.types.DateTime(1, 2, 3, 4, () => 5, 6, 7, 8)
    ).toThrowError(TypeError)
    expect(
      () => new neo4j.types.DateTime(1, 2, 3, 4, 5, () => 6, 7, 8)
    ).toThrowError(TypeError)
    expect(
      () => new neo4j.types.DateTime(1, 2, 3, 4, 5, 6, { value: 7 }, 8)
    ).toThrowError(TypeError)
    expect(
      () => new neo4j.types.DateTime(1, 2, 3, 4, 5, 6, 7, { value: 8 })
    ).toThrowError(TypeError)

    expect(
      () =>
        new neo4j.types.DateTime(1, 2, 3, 4, 5, 6, 7, null, {
          timeZoneId: 'UK'
        })
    ).toThrowError(TypeError)
    expect(
      () => new neo4j.types.DateTime(1, 2, 3, 4, 5, 6, 7, null, ['UK'])
    ).toThrowError(TypeError)

    expect(() => new neo4j.types.DateTime(1, 2, 3, 4, 5, 6, 7)).toThrow()
    expect(
      () => new neo4j.types.DateTime(1, 2, 3, 4, 5, 6, 7, null, null)
    ).toThrow()
    expect(
      () => new neo4j.types.DateTime(1, 2, 3, 4, 5, 6, 7, 8, 'UK')
    ).toThrow()
  })

  it('should convert standard Date to neo4j LocalTime', () => {
    testStandardDateToLocalTimeConversion(new Date(2000, 1, 1, 0, 0, 0, 0))
    testStandardDateToLocalTimeConversion(new Date(1456, 7, 12, 12, 0, 0, 0))
    testStandardDateToLocalTimeConversion(new Date(2121, 11, 27, 21, 56, 0, 0))
    testStandardDateToLocalTimeConversion(new Date(1392, 2, 2, 3, 14, 59, 0))
    testStandardDateToLocalTimeConversion(new Date(1102, 6, 5, 17, 12, 32, 99))
    testStandardDateToLocalTimeConversion(new Date(2019, 2, 7, 0, 0, 0, 1))

    testStandardDateToLocalTimeConversion(
      new Date(1351, 4, 7, 0, 0, 0, 0),
      neo4j.int(1)
    )
    testStandardDateToLocalTimeConversion(
      new Date(3841, 1, 19, 0, 0, 0, 0),
      neo4j.int(99)
    )
    testStandardDateToLocalTimeConversion(
      new Date(2222, 3, 29, 0, 0, 0, 0),
      neo4j.int(999999999)
    )
  })

  it('should fail to convert invalid standard Date to neo4j LocalTime', () => {
    const LocalTime = neo4j.types.LocalTime

    expect(() => LocalTime.fromStandardDate()).toThrowError(TypeError)
    expect(() =>
      LocalTime.fromStandardDate('2007-04-05T12:30-02:00')
    ).toThrowError(TypeError)
    expect(() => LocalTime.fromStandardDate({})).toThrowError(TypeError)

    expect(() => LocalTime.fromStandardDate(new Date({}))).toThrowError(
      TypeError
    )
    expect(() => LocalTime.fromStandardDate(new Date([]))).toThrowError(
      TypeError
    )
    expect(() => LocalTime.fromStandardDate(new Date(NaN))).toThrowError(
      TypeError
    )

    expect(() => LocalTime.fromStandardDate(new Date(), '1')).toThrowError(
      TypeError
    )
    expect(() =>
      LocalTime.fromStandardDate(new Date(), { nanosecond: 1 })
    ).toThrowError(TypeError)
    expect(() => LocalTime.fromStandardDate(new Date(), [1])).toThrowError(
      TypeError
    )
  })

  it('should convert standard Date to neo4j Time', () => {
    testStandardDateToTimeConversion(new Date(2000, 1, 1, 0, 0, 0, 0))
    testStandardDateToTimeConversion(new Date(1456, 7, 12, 12, 0, 0, 0))
    testStandardDateToTimeConversion(new Date(2121, 11, 27, 21, 56, 0, 0))
    testStandardDateToTimeConversion(new Date(1392, 2, 2, 3, 14, 59, 0))
    testStandardDateToTimeConversion(new Date(1102, 6, 5, 17, 12, 32, 99))
    testStandardDateToTimeConversion(new Date(2019, 2, 7, 0, 0, 0, 1))

    testStandardDateToTimeConversion(
      new Date(1351, 4, 7, 0, 0, 0, 0),
      neo4j.int(1)
    )
    testStandardDateToTimeConversion(
      new Date(3841, 1, 19, 0, 0, 0, 0),
      neo4j.int(99)
    )
    testStandardDateToTimeConversion(
      new Date(2222, 3, 29, 0, 0, 0, 0),
      neo4j.int(999999999)
    )
  })

  it('should fail to convert invalid standard Date to neo4j Time', () => {
    const Time = neo4j.types.Time

    expect(() => Time.fromStandardDate()).toThrowError(TypeError)
    expect(() => Time.fromStandardDate('2007-04-05T12:30-02:00')).toThrowError(
      TypeError
    )
    expect(() => Time.fromStandardDate({})).toThrowError(TypeError)

    expect(() => Time.fromStandardDate(new Date({}))).toThrowError(TypeError)
    expect(() => Time.fromStandardDate(new Date([]))).toThrowError(TypeError)
    expect(() => Time.fromStandardDate(new Date(NaN))).toThrowError(TypeError)

    expect(() => Time.fromStandardDate(new Date(), '1')).toThrowError(TypeError)
    expect(() =>
      Time.fromStandardDate(new Date(), { nanosecond: 1 })
    ).toThrowError(TypeError)
    expect(() => Time.fromStandardDate(new Date(), [1])).toThrowError(TypeError)
  })

  it('should convert standard Date to neo4j Date', () => {
    testStandardDateToNeo4jDateConversion(new Date(2000, 1, 1))
    testStandardDateToNeo4jDateConversion(new Date(1456, 7, 12))
    testStandardDateToNeo4jDateConversion(new Date(2121, 11, 27))
    testStandardDateToNeo4jDateConversion(new Date(1392, 2, 2))
    testStandardDateToNeo4jDateConversion(new Date(1102, 6, 5))
    testStandardDateToNeo4jDateConversion(new Date(2019, 2, 7))

    testStandardDateToNeo4jDateConversion(new Date(1351, 4, 7))
    testStandardDateToNeo4jDateConversion(new Date(3841, 1, 19))
    testStandardDateToNeo4jDateConversion(new Date(2222, 3, 29))

    testStandardDateToNeo4jDateConversion(new Date(1567, 0, 29))
  })

  it('should fail to convert invalid standard Date to neo4j Date', () => {
    const Neo4jDate = neo4j.types.Date

    expect(() => Neo4jDate.fromStandardDate()).toThrowError(TypeError)
    expect(() =>
      Neo4jDate.fromStandardDate('2007-04-05T12:30-02:00')
    ).toThrowError(TypeError)
    expect(() => Neo4jDate.fromStandardDate({})).toThrowError(TypeError)

    expect(() => Neo4jDate.fromStandardDate(new Date({}))).toThrowError(
      TypeError
    )
    expect(() => Neo4jDate.fromStandardDate(new Date([]))).toThrowError(
      TypeError
    )
    expect(() => Neo4jDate.fromStandardDate(new Date(NaN))).toThrowError(
      TypeError
    )
  })

  it('should convert standard Date to neo4j LocalDateTime', () => {
    testStandardDateToLocalDateTimeConversion(new Date(2011, 9, 18))
    testStandardDateToLocalDateTimeConversion(new Date(1455, 0, 1))
    testStandardDateToLocalDateTimeConversion(new Date(0))
    testStandardDateToLocalDateTimeConversion(
      new Date(2056, 5, 22, 21, 59, 12, 999)
    )

    testStandardDateToLocalDateTimeConversion(new Date(0), 1)
    testStandardDateToLocalDateTimeConversion(new Date(0), 999999999)
    testStandardDateToLocalDateTimeConversion(
      new Date(1922, 1, 22, 23, 23, 45, 123),
      456789
    )

    testStandardDateToLocalDateTimeConversion(
      new Date(1999, 1, 1, 10, 10, 10),
      neo4j.int(999)
    )

    testStandardDateToLocalDateTimeConversion(new Date(2192, 0, 17, 20, 30, 40))
    testStandardDateToLocalDateTimeConversion(new Date(2239, 0, 9, 1, 2, 3), 4)
  })

  it('should fail to convert invalid standard Date to neo4j LocalDateTime', () => {
    const LocalDateTime = neo4j.types.LocalDateTime

    expect(() => LocalDateTime.fromStandardDate()).toThrowError(TypeError)
    expect(() =>
      LocalDateTime.fromStandardDate('2007-04-05T12:30-02:00')
    ).toThrowError(TypeError)
    expect(() => LocalDateTime.fromStandardDate({})).toThrowError(TypeError)

    expect(() => LocalDateTime.fromStandardDate(new Date({}))).toThrowError(
      TypeError
    )
    expect(() => LocalDateTime.fromStandardDate(new Date([]))).toThrowError(
      TypeError
    )
    expect(() => LocalDateTime.fromStandardDate(new Date(NaN))).toThrowError(
      TypeError
    )

    expect(() => LocalDateTime.fromStandardDate(new Date(), '1')).toThrowError(
      TypeError
    )
    expect(() =>
      LocalDateTime.fromStandardDate(new Date(), { nanosecond: 1 })
    ).toThrowError(TypeError)
    expect(() => LocalDateTime.fromStandardDate(new Date(), [1])).toThrowError(
      TypeError
    )
  })

  it('should convert standard Date to neo4j DateTime', () => {
    testStandardDateToDateTimeConversion(new Date(2011, 9, 18))
    testStandardDateToDateTimeConversion(new Date(1455, 0, 1))
    testStandardDateToDateTimeConversion(new Date(0))
    testStandardDateToDateTimeConversion(new Date(2056, 5, 22, 21, 59, 12, 999))

    testStandardDateToDateTimeConversion(new Date(0), 1)
    testStandardDateToDateTimeConversion(new Date(0), 999999999)

    testStandardDateToDateTimeConversion(
      new Date(1922, 1, 22, 23, 23, 45, 123),
      456789
    )
    testStandardDateToDateTimeConversion(
      new Date(1999, 1, 1, 10, 10, 10),
      neo4j.int(999)
    )

    testStandardDateToDateTimeConversion(new Date(1899, 0, 7, 7, 7, 7, 7))
    testStandardDateToDateTimeConversion(new Date(2005, 0, 1, 2, 3, 4, 5), 100)
  })

  it('should fail to convert invalid standard Date to neo4j DateTime', () => {
    const DateTime = neo4j.types.DateTime

    expect(() => DateTime.fromStandardDate()).toThrowError(TypeError)
    expect(() =>
      DateTime.fromStandardDate('2007-04-05T12:30-02:00')
    ).toThrowError(TypeError)
    expect(() => DateTime.fromStandardDate({})).toThrowError(TypeError)

    expect(() => DateTime.fromStandardDate(new Date({}))).toThrowError(
      TypeError
    )
    expect(() => DateTime.fromStandardDate(new Date([]))).toThrowError(
      TypeError
    )
    expect(() => DateTime.fromStandardDate(new Date(NaN))).toThrowError(
      TypeError
    )

    expect(() => DateTime.fromStandardDate(new Date(), '1')).toThrowError(
      TypeError
    )
    expect(() =>
      DateTime.fromStandardDate(new Date(), { nanosecond: 1 })
    ).toThrowError(TypeError)
    expect(() => DateTime.fromStandardDate(new Date(), [1])).toThrowError(
      TypeError
    )
  })

  it('should send and receive neo4j Date created from standard Date with zero month', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    // return numbers and not integers to simplify the equality comparison
    session = driverWithNativeNumbers.session()

    const standardDate = new Date(2000, 0, 1)
    const neo4jDate = neo4j.types.Date.fromStandardDate(standardDate)
    await testSendReceiveTemporalValue(neo4jDate)
  })

  it('should send and receive neo4j LocalDateTime created from standard Date with zero month', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    // return numbers and not integers to simplify the equality comparison
    session = driverWithNativeNumbers.session()

    const standardDate = new Date(2121, 0, 7, 10, 20, 30, 40)
    const neo4jLocalDateTime = neo4j.types.LocalDateTime.fromStandardDate(
      standardDate
    )
    await testSendReceiveTemporalValue(neo4jLocalDateTime)
  })

  it('should send and receive neo4j DateTime created from standard Date with zero month', async () => {
    if (neo4jDoesNotSupportTemporalTypes()) {
      return
    }

    // return numbers and not integers to simplify the equality comparison
    session = driverWithNativeNumbers.session()

    const standardDate = new Date(1756, 0, 29, 23, 15, 59, 12)
    const neo4jDateTime = neo4j.types.DateTime.fromStandardDate(standardDate)
    await testSendReceiveTemporalValue(neo4jDateTime)
  })

  it('should fail to create LocalTime with out of range values', () => {
    expect(() => localTime(999, 1, 1, 1)).toThrow()
    expect(() => localTime(1, 999, 1, 1)).toThrow()
    expect(() => localTime(1, 1, 999, 1)).toThrow()
    expect(() => localTime(1, 1, 1, -999)).toThrow()
    expect(() => localTime(1, 1, 1, 1000000000)).toThrow()
  })

  it('should fail to create Time with out of range values', () => {
    expect(() => time(999, 1, 1, 1, 1)).toThrow()
    expect(() => time(1, 999, 1, 1, 1)).toThrow()
    expect(() => time(1, 1, 999, 1, 1)).toThrow()
    expect(() => time(1, 1, 1, -999, 1)).toThrow()
    expect(() => time(1, 1, 1, 1000000000, 1)).toThrow()
  })

  it('should fail to create Date with out of range values', () => {
    expect(() => date(1000000000, 1, 1)).toThrow()
    expect(() => date(1, 0, 1)).toThrow()
    expect(() => date(1, 13, 1)).toThrow()
    expect(() => date(1, 1, 0)).toThrow()
    expect(() => date(1, 1, -1)).toThrow()
    expect(() => date(1, 1, 33)).toThrow()
  })

  it('should fail to create LocalDateTime with out of range values', () => {
    expect(() => localDateTime(1000000000, 1, 1, 1, 1, 1, 1)).toThrow()
    expect(() => localDateTime(1, 0, 1, 1, 1, 1, 1)).toThrow()
    expect(() => localDateTime(1, 13, 1, 1, 1, 1, 1)).toThrow()
    expect(() => localDateTime(1, -1, 1, 1, 1, 1, 1)).toThrow()
    expect(() => localDateTime(1, 1, 0, 1, 1, 1, 1)).toThrow()
    expect(() => localDateTime(1, 1, -1, 1, 1, 1, 1)).toThrow()
    expect(() => localDateTime(1, 1, 33, 1, 1, 1, 1)).toThrow()
    expect(() => localDateTime(1, 1, 1, -1, 1, 1, 1)).toThrow()
    expect(() => localDateTime(1, 1, 1, 24, 1, 1, 1)).toThrow()
    expect(() => localDateTime(1, 1, 1, 42, 1, 1, 1)).toThrow()
    expect(() => localDateTime(1, 1, 1, 1, -1, 1, 1)).toThrow()
    expect(() => localDateTime(1, 1, 1, 1, 60, 1, 1)).toThrow()
    expect(() => localDateTime(1, 1, 1, 1, 999, 1, 1)).toThrow()
    expect(() => localDateTime(1, 1, 1, 1, 1, -1, 1)).toThrow()
    expect(() => localDateTime(1, 1, 1, 1, 1, 60, 1)).toThrow()
    expect(() => localDateTime(1, 1, 1, 1, 1, 99, 1)).toThrow()
    expect(() => localDateTime(1, 1, 1, 1, 1, 1, -1)).toThrow()
    expect(() => localDateTime(1, 1, 1, 1, 1, 1, 1000000000)).toThrow()
  })

  it('should fail to create DateTime with out of range values', () => {
    expect(() =>
      dateTimeWithZoneOffset(1000000000, 1, 1, 1, 1, 1, 1, 0)
    ).toThrow()
    expect(() => dateTimeWithZoneOffset(1, 0, 1, 1, 1, 1, 1, 0)).toThrow()
    expect(() => dateTimeWithZoneOffset(1, 13, 1, 1, 1, 1, 1, 0)).toThrow()
    expect(() => dateTimeWithZoneOffset(1, -1, 1, 1, 1, 1, 1, 0)).toThrow()
    expect(() => dateTimeWithZoneOffset(1, 1, 0, 1, 1, 1, 1, 0)).toThrow()
    expect(() => dateTimeWithZoneOffset(1, 1, -1, 1, 1, 1, 1, 0)).toThrow()
    expect(() => dateTimeWithZoneOffset(1, 1, 33, 1, 1, 1, 1, 0)).toThrow()
    expect(() => dateTimeWithZoneOffset(1, 1, 1, -1, 1, 1, 1, 0)).toThrow()
    expect(() => dateTimeWithZoneOffset(1, 1, 1, 24, 1, 1, 1, 0)).toThrow()
    expect(() => dateTimeWithZoneOffset(1, 1, 1, 42, 1, 1, 1, 0)).toThrow()
    expect(() => dateTimeWithZoneOffset(1, 1, 1, 1, -1, 1, 1, 0)).toThrow()
    expect(() => dateTimeWithZoneOffset(1, 1, 1, 1, 60, 1, 1, 0)).toThrow()
    expect(() => dateTimeWithZoneOffset(1, 1, 1, 1, 999, 1, 1, 0)).toThrow()
    expect(() => dateTimeWithZoneOffset(1, 1, 1, 1, 1, -1, 1, 0)).toThrow()
    expect(() => dateTimeWithZoneOffset(1, 1, 1, 1, 1, 60, 1, 0)).toThrow()
    expect(() => dateTimeWithZoneOffset(1, 1, 1, 1, 1, 99, 1, 0)).toThrow()
    expect(() => dateTimeWithZoneOffset(1, 1, 1, 1, 1, 1, -1, 0)).toThrow()
    expect(() =>
      dateTimeWithZoneOffset(1, 1, 1, 1, 1, 1, 1000000000, 0)
    ).toThrow()
  })

  it('should convert standard Date with offset to neo4j Time', () => {
    const standardDate1 = testUtils.fakeStandardDateWithOffset(0)
    const neo4jTime1 = neo4j.types.Time.fromStandardDate(standardDate1)
    verifyTimeZoneOffset(neo4jTime1, 0, 'Z')

    const standardDate2 = testUtils.fakeStandardDateWithOffset(-600)
    const neo4jTime2 = neo4j.types.Time.fromStandardDate(standardDate2)
    verifyTimeZoneOffset(neo4jTime2, 600 * 60, '+10:00')

    const standardDate3 = testUtils.fakeStandardDateWithOffset(480)
    const neo4jTime3 = neo4j.types.Time.fromStandardDate(standardDate3)
    verifyTimeZoneOffset(neo4jTime3, -1 * 480 * 60, '-08:00')

    const standardDate4 = testUtils.fakeStandardDateWithOffset(-180)
    const neo4jTime4 = neo4j.types.Time.fromStandardDate(standardDate4)
    verifyTimeZoneOffset(neo4jTime4, 180 * 60, '+03:00')

    const standardDate5 = testUtils.fakeStandardDateWithOffset(150)
    const neo4jTime5 = neo4j.types.Time.fromStandardDate(standardDate5)
    verifyTimeZoneOffset(neo4jTime5, -1 * 150 * 60, '-02:30')
  })

  it('should convert standard Date with offset to neo4j DateTime', () => {
    const standardDate1 = testUtils.fakeStandardDateWithOffset(0)
    const neo4jDateTime1 = neo4j.types.DateTime.fromStandardDate(standardDate1)
    verifyTimeZoneOffset(neo4jDateTime1, 0, 'Z')

    const standardDate2 = testUtils.fakeStandardDateWithOffset(-600)
    const neo4jDateTime2 = neo4j.types.DateTime.fromStandardDate(standardDate2)
    verifyTimeZoneOffset(neo4jDateTime2, 600 * 60, '+10:00')

    const standardDate3 = testUtils.fakeStandardDateWithOffset(480)
    const neo4jDateTime3 = neo4j.types.DateTime.fromStandardDate(standardDate3)
    verifyTimeZoneOffset(neo4jDateTime3, -1 * 480 * 60, '-08:00')

    const standardDate4 = testUtils.fakeStandardDateWithOffset(-180)
    const neo4jDateTime4 = neo4j.types.DateTime.fromStandardDate(standardDate4)
    verifyTimeZoneOffset(neo4jDateTime4, 180 * 60, '+03:00')

    const standardDate5 = testUtils.fakeStandardDateWithOffset(150)
    const neo4jDateTime5 = neo4j.types.DateTime.fromStandardDate(standardDate5)
    verifyTimeZoneOffset(neo4jDateTime5, -1 * 150 * 60, '-02:30')
  })

  function testSendAndReceiveRandomTemporalValues (valueGenerator) {
    const asyncFunction = (index, callback) => {
      testSendReceiveTemporalValue(valueGenerator())
        .then(() => callback())
        .catch(error => callback(error))
    }

    return new Promise((resolve, reject) => {
      timesSeries(RANDOM_VALUES_TO_TEST, asyncFunction, (error, result) => {
        if (error) {
          reject(error)
        } else {
          resolve(result)
        }
      })
    })
  }

  async function testSendAndReceiveArrayOfRandomTemporalValues (valueGenerator) {
    const arrayLength = _.random(
      MIN_TEMPORAL_ARRAY_LENGTH,
      MAX_TEMPORAL_ARRAY_LENGTH
    )
    const values = _.range(arrayLength).map(() => valueGenerator())

    await testSendReceiveTemporalValue(values)
  }

  async function testReceiveTemporalValue (query, expectedValue) {
    try {
      const result = await session.run(query)

      const records = result.records
      expect(records.length).toEqual(1)

      const value = records[0].get(0)
      expect(value).toEqual(expectedValue)
    } finally {
      await session.close()
    }
  }

  async function testSendReceiveTemporalValue (value) {
    const result = await session.run(
      'CREATE (n:Node {value: $value}) RETURN n.value',
      { value: value }
    )

    const records = result.records
    expect(records.length).toEqual(1)

    const receivedValue = records[0].get(0)
    expect(receivedValue).toEqual(value)
  }

  async function testDurationToString (values) {
    const durations = values.map(value => value.duration)
    const expectedDurationStrings = values.map(value => value.expectedString)

    try {
      const result = await session.run('UNWIND $durations AS d RETURN d', {
        durations: durations
      })

      const receivedDurationStrings = result.records
        .map(record => record.get(0))
        .map(duration => duration.toString())

      expect(expectedDurationStrings).toEqual(receivedDurationStrings)
    } finally {
      await session.close()
    }
  }

  function neo4jDoesNotSupportTemporalTypes () {
    if (protocolVersion < 2) {
      return true
    }
    return false
  }

  function randomDuration () {
    const sign = _.sample([-1, 1]) // duration can be negative
    return duration(
      sign * _.random(0, MAX_DURATION_COMPONENT),
      sign * _.random(0, MAX_DURATION_COMPONENT),
      sign * _.random(0, MAX_DURATION_COMPONENT),
      _.random(0, MAX_NANO_OF_SECOND)
    )
  }

  function randomDateTimeWithZoneOffset () {
    const dateTime = randomDstSafeLocalDateTime()
    return new neo4j.types.DateTime(
      dateTime.year,
      dateTime.month,
      dateTime.day,
      dateTime.hour,
      dateTime.minute,
      dateTime.second,
      dateTime.nanosecond,
      randomZoneOffsetSeconds(),
      null
    )
  }

  function randomDateTimeWithZoneId () {
    const dateTime = randomDstSafeLocalDateTime()
    return new neo4j.types.DateTime(
      dateTime.year,
      dateTime.month,
      dateTime.day,
      dateTime.hour,
      dateTime.minute,
      dateTime.second,
      dateTime.nanosecond,
      null,
      randomZoneId()
    )
  }

  function randomDstSafeLocalDateTime () {
    const date = randomDate()
    const time = randomDstSafeLocalTime()
    return new neo4j.types.LocalDateTime(
      date.year,
      date.month,
      date.day,
      time.hour,
      time.minute,
      time.second,
      time.nanosecond
    )
  }

  function randomLocalDateTime () {
    const date = randomDate()
    const time = randomLocalTime()
    return new neo4j.types.LocalDateTime(
      date.year,
      date.month,
      date.day,
      time.hour,
      time.minute,
      time.second,
      time.nanosecond
    )
  }

  function randomDate () {
    return new neo4j.types.Date(
      randomInt(MIN_YEAR, MAX_YEAR),
      randomInt(1, 12),
      randomInt(1, 28)
    )
  }

  function randomTime () {
    const localTime = randomLocalTime()
    return new neo4j.types.Time(
      localTime.hour,
      localTime.minute,
      localTime.second,
      localTime.nanosecond,
      randomZoneOffsetSeconds()
    )
  }

  function randomLocalTime () {
    return new neo4j.types.LocalTime(
      randomInt(0, 23),
      randomInt(0, 59),
      randomInt(0, 59),
      randomInt(0, MAX_NANO_OF_SECOND)
    )
  }

  function randomDstSafeLocalTime () {
    return new neo4j.types.LocalTime(
      randomInt(4, 23), // do not generate hours in range where DST adjustment happens
      randomInt(0, 59),
      randomInt(0, 59),
      randomInt(0, MAX_NANO_OF_SECOND)
    )
  }

  function randomZoneOffsetSeconds () {
    const randomOffsetWithSeconds = neo4j.int(
      randomInt(MIN_TIME_ZONE_OFFSET, MAX_TIME_ZONE_OFFSET)
    )
    return randomOffsetWithSeconds
      .div(SECONDS_PER_MINUTE)
      .multiply(SECONDS_PER_MINUTE) // truncate seconds
  }

  function randomZoneId () {
    return _.sample(ZONE_IDS)
  }

  function duration (months, days, seconds, nanoseconds) {
    return new neo4j.types.Duration(
      neo4j.int(months),
      neo4j.int(days),
      neo4j.int(seconds),
      neo4j.int(nanoseconds)
    )
  }

  function localTime (hour, minute, second, nanosecond) {
    return new neo4j.types.LocalTime(
      neo4j.int(hour),
      neo4j.int(minute),
      neo4j.int(second),
      neo4j.int(nanosecond)
    )
  }

  function time (hour, minute, second, nanosecond, offsetSeconds) {
    return new neo4j.types.Time(
      neo4j.int(hour),
      neo4j.int(minute),
      neo4j.int(second),
      neo4j.int(nanosecond),
      neo4j.int(offsetSeconds)
    )
  }

  function date (year, month, day) {
    return new neo4j.types.Date(
      neo4j.int(year),
      neo4j.int(month),
      neo4j.int(day)
    )
  }

  function localDateTime (year, month, day, hour, minute, second, nanosecond) {
    return new neo4j.types.LocalDateTime(
      neo4j.int(year),
      neo4j.int(month),
      neo4j.int(day),
      neo4j.int(hour),
      neo4j.int(minute),
      neo4j.int(second),
      neo4j.int(nanosecond)
    )
  }

  function dateTimeWithZoneOffset (
    year,
    month,
    day,
    hour,
    minute,
    second,
    nanosecond,
    offsetSeconds
  ) {
    return new neo4j.types.DateTime(
      neo4j.int(year),
      neo4j.int(month),
      neo4j.int(day),
      neo4j.int(hour),
      neo4j.int(minute),
      neo4j.int(second),
      neo4j.int(nanosecond),
      neo4j.int(offsetSeconds),
      null
    )
  }

  function dateTimeWithZoneId (
    year,
    month,
    day,
    hour,
    minute,
    second,
    nanosecond,
    zoneId
  ) {
    return new neo4j.types.DateTime(
      neo4j.int(year),
      neo4j.int(month),
      neo4j.int(day),
      neo4j.int(hour),
      neo4j.int(minute),
      neo4j.int(second),
      neo4j.int(nanosecond),
      null,
      zoneId
    )
  }

  function randomInt (lower, upper) {
    return neo4j.int(_.random(lower, upper))
  }

  function testStandardDateToLocalTimeConversion (date, nanosecond) {
    const converted = neo4j.types.LocalTime.fromStandardDate(date, nanosecond)
    const expected = new neo4j.types.LocalTime(
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      totalNanoseconds(date, nanosecond)
    )
    expect(converted).toEqual(expected)
  }

  function testStandardDateToTimeConversion (date, nanosecond) {
    const converted = neo4j.types.Time.fromStandardDate(date, nanosecond)
    const expected = new neo4j.types.Time(
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      totalNanoseconds(date, nanosecond),
      timeZoneOffsetInSeconds(date)
    )
    expect(converted).toEqual(expected)
  }

  function testStandardDateToNeo4jDateConversion (date) {
    const converted = neo4j.types.Date.fromStandardDate(date)
    const expected = new neo4j.types.Date(
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate()
    )
    expect(converted).toEqual(expected)
  }

  function testStandardDateToLocalDateTimeConversion (date, nanosecond) {
    const converted = neo4j.types.LocalDateTime.fromStandardDate(
      date,
      nanosecond
    )
    const expected = new neo4j.types.LocalDateTime(
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      totalNanoseconds(date, nanosecond)
    )
    expect(converted).toEqual(expected)
  }

  function testStandardDateToDateTimeConversion (date, nanosecond) {
    const converted = neo4j.types.DateTime.fromStandardDate(date, nanosecond)
    const expected = new neo4j.types.DateTime(
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      totalNanoseconds(date, nanosecond),
      timeZoneOffsetInSeconds(date)
    )
    expect(converted).toEqual(expected)
  }

  function verifyTimeZoneOffset (temporal, expectedValue, expectedStringValue) {
    expect(temporal.timeZoneOffsetSeconds).toEqual(expectedValue)
    const isoString = temporal.toString()
    // assert ISO string ends with the expected suffix
    expect(
      isoString.indexOf(
        expectedStringValue,
        isoString.length - expectedStringValue.length
      )
    ).toBeGreaterThan(0)
  }
})

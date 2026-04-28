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

import { LocalDateTime, Date, DateTime, Duration, isDuration, LocalTime, isLocalTime, Time, isTime, isDate, isLocalDateTime, isDateTime } from '../src/temporal-types'
import { temporalUtil } from '../src/internal'
import fc from 'fast-check'
import { int, Integer } from '../src'

const MIN_UTC_IN_MS = -8_640_000_000_000_000
const MAX_UTC_IN_MS = 8_640_000_000_000_000
const ONE_DAY_IN_MS = 86_400_000

describe('Date', () => {
  describe('.fromStandardDateLocal()', () => {
    it('should create a date from the zoned date on a JS Date.', () => {
      fc.assert(
        fc.property(
          fc.date({
            max: temporalUtil.newDate(MAX_UTC_IN_MS - ONE_DAY_IN_MS),
            min: temporalUtil.newDate(MIN_UTC_IN_MS + ONE_DAY_IN_MS)
          }),
          standardDate => {
            const date = Date.fromStandardDateLocal(standardDate)
            const receivedDate = date.toStandardDate()

            expect(receivedDate.getUTCFullYear()).toEqual(standardDate.getFullYear())
            expect(receivedDate.getUTCMonth()).toEqual(standardDate.getMonth())
            expect(receivedDate.getUTCDate()).toEqual(standardDate.getDate())
            expect(receivedDate.getUTCHours()).toEqual(0)
            expect(receivedDate.getUTCMinutes()).toEqual(0)
          })
      )
    })
  })
  describe('.fromStandardDateUTC()', () => {
    it('should be the reverse operation of toStandardDateUTC but losing time information', () => {
      fc.assert(
        fc.property(
          fc.date({
            max: temporalUtil.newDate(MAX_UTC_IN_MS - ONE_DAY_IN_MS),
            min: temporalUtil.newDate(MIN_UTC_IN_MS + ONE_DAY_IN_MS)
          }),
          standardDate => {
            const date = Date.fromStandardDateUTC(standardDate)
            const receivedDate = date.toStandardDate()

            expect(receivedDate.getUTCFullYear()).toEqual(standardDate.getUTCFullYear())
            expect(receivedDate.getUTCMonth()).toEqual(standardDate.getUTCMonth())
            expect(receivedDate.getUTCDate()).toEqual(standardDate.getUTCDate())
            expect(receivedDate.getUTCHours()).toEqual(0)
            expect(receivedDate.getUTCMinutes()).toEqual(0)
          })
      )
    })
  })
  describe('.toStandardDate()', () => {
    it('should convert to a standard date', () => {
      const localDatetime = new Date(2020, 3, 2)

      const standardDate = localDatetime.toStandardDate()

      expect(standardDate.getUTCFullYear()).toEqual(localDatetime.year)
      expect(standardDate.getUTCMonth()).toEqual(localDatetime.month - 1)
      expect(standardDate.getUTCDate()).toEqual(localDatetime.day)
    })
  })
  describe('fromString', () => {
    it.each([
      ['2026-01-05', new Date(int(2026), int(1), int(5))],
      ['0001-01-05', new Date(int(1), int(1), int(5))],
      ['+20260-10-15', new Date(int(20260), int(10), int(15))]
    ])('should successfully convert date strings', (string: string, expected: Date<Integer>) => {
      expect(Date.fromString(string)).toEqual(expected)
    })
    it.each([
      ['2026-01-05T15:36:42ZZ', 'Date could not be parsed from string'],
      ['2026-01-05hello', 'Date could not be parsed from string'],
      ['godbye2026-01-05', 'Date could not be parsed from string'],
      ['2026-01--05', 'Date could not be parsed from string'],
      ['2026-01-42', 'Day is expected to be in range [1, 31] but was: 42'],
      ['2026-13-05', 'Month is expected to be in range [1, 12] but was: 13'],
      ['20260-01-05T15:36:42', 'Date could not be parsed from string'],
      ['2026-001-05T15:36:42', 'Date could not be parsed from string']
    ])('should thrown when converting invalid string', (string: string, expected: string) => {
      expect(() => Date.fromString(string)).toThrow(expected)
    })
  })
})

describe('LocalDateTime', () => {
  describe('.toStandardDate()', () => {
    it('should convert to a standard date', () => {
      const localDatetime = new LocalDateTime(2020, 12, 15, 1, 2, 3, 4000000)

      const standardDate = localDatetime.toStandardDate()

      expect(standardDate.getFullYear()).toEqual(localDatetime.year)
      expect(standardDate.getMonth()).toEqual(localDatetime.month - 1)
      expect(standardDate.getDate()).toEqual(localDatetime.day)
      expect(standardDate.getHours()).toBe(localDatetime.hour)
      expect(standardDate.getMinutes()).toBe(localDatetime.minute)
      expect(standardDate.getSeconds()).toBe(localDatetime.second)
      expect(standardDate.getMilliseconds()).toBe(localDatetime.nanosecond / 1000000)
    })

    it('should be the reverse operation of fromStandardDate', () => {
      fc.assert(
        fc.property(fc.date(), (date) => {
          const localDatetime = LocalDateTime.fromStandardDate(date)
          const receivedDate = localDatetime.toStandardDate()

          expect(receivedDate).toEqual(date)
        })
      )
    })
  })
  describe('.fromString', () => {
    it.each([
      ['2026-01-05T15:36:42', new LocalDateTime(int(2026), int(1), int(5), int(15), int(36), int(42), int(0))],
      ['2026-01-05T15:36:42.1', new LocalDateTime(int(2026), int(1), int(5), int(15), int(36), int(42), int(100000000))],
      ['0000-01-05T00:01:00.1', new LocalDateTime(int(0), int(1), int(5), int(0), int(1), int(0), int(100000000))]
    ])('should successfully convert date strings', (string: string, expected: LocalDateTime<Integer>) => {
      expect(LocalDateTime.fromString(string)).toEqual(expected)
    })
    it.each([
      ['2026-01-05TT15:36:42', 'LocalDateTime could not be parsed from string'],
      [' 2026-01-05T15:36:42', 'LocalDateTime could not be parsed from string'],
      ['+2026-01-05T15:36:42', 'LocalDateTime could not be parsed from string'],
      ['2026-01-05TT15:36', 'LocalDateTime could not be parsed from string'],
      ['2026-01-05T15:36:-42', 'LocalDateTime could not be parsed from string'],
      ['2026--1-05T15:36:42', 'LocalDateTime could not be parsed from string'],
      ['+1000000000000000000000-01-05T00:01:00.1', 'Year is expected to be in range [-999999999, 999999999] but was:'],
      ['0000-01-05T00:01:00.1bc', 'LocalDateTime could not be parsed from string']
    ])('should thrown when converting invalid string', (string: string, expected: string) => {
      expect(() => LocalDateTime.fromString(string)).toThrow(expected)
    })
  })
})

describe('DateTime', () => {
  describe('constructor', () => {
    it('should be able to create a date with zone id and offset', () => {
      const datetime = new DateTime(2022, 6, 16, 11, 19, 25, 400004, 2 * 60 * 60, 'Europe/Stockholm')

      expect(datetime.year).toEqual(2022)
      expect(datetime.month).toEqual(6)
      expect(datetime.day).toEqual(16)
      expect(datetime.hour).toEqual(11)
      expect(datetime.minute).toEqual(19)
      expect(datetime.second).toEqual(25)
      expect(datetime.nanosecond).toEqual(400004)
      expect(datetime.timeZoneOffsetSeconds).toEqual(2 * 60 * 60)
      expect(datetime.timeZoneId).toEqual('Europe/Stockholm')
    })
  })

  describe('.toStandardDate()', () => {
    it('should convert to a standard date (offset + zone id)', () => {
      const datetime = new DateTime(2022, 6, 16, 11, 19, 25, 4000004, 2 * 60 * 60, 'Europe/Stockholm')

      const standardDate = datetime.toStandardDate()

      expect(standardDate.getUTCFullYear()).toEqual(datetime.year)
      expect(standardDate.getUTCMonth()).toEqual(datetime.month - 1)
      expect(standardDate.getUTCDate()).toEqual(datetime.day) // The datetime in this test will never cross the date line in conversion, it is therefore safe to use UTC here to avoid machine timezone from altering the result of the test.
      const offsetAdjust = (datetime.timeZoneOffsetSeconds ?? 0) / 60
      const hourDiff = Math.abs((offsetAdjust - offsetAdjust % 60) / 60)
      const minuteDiff = Math.abs(offsetAdjust % 60)
      expect(standardDate.getUTCHours()).toBe(datetime.hour - hourDiff)
      expect(standardDate.getUTCMinutes()).toBe(datetime.minute - minuteDiff)
      expect(standardDate.getUTCSeconds()).toBe(datetime.second)
      expect(standardDate.getUTCMilliseconds()).toBe(Math.round(datetime.nanosecond / 1000000))
    })

    it('should convert to a standard date (offset)', () => {
      const datetime = new DateTime(2020, 12, 15, 12, 2, 3, 4000000, 120 * 60)

      const standardDate = datetime.toStandardDate()

      expect(standardDate.getUTCFullYear()).toEqual(datetime.year)
      expect(standardDate.getUTCMonth()).toEqual(datetime.month - 1)
      expect(standardDate.getUTCDate()).toEqual(datetime.day)
      const offsetAdjust = (datetime.timeZoneOffsetSeconds ?? 0) / 60
      const hourDiff = Math.abs((offsetAdjust - offsetAdjust % 60) / 60)
      const minuteDiff = Math.abs(offsetAdjust % 60)
      expect(standardDate.getUTCHours()).toBe(datetime.hour - hourDiff)
      expect(standardDate.getUTCMinutes()).toBe(datetime.minute - minuteDiff)
      expect(standardDate.getUTCSeconds()).toBe(datetime.second)
      expect(standardDate.getUTCMilliseconds()).toBe(Math.round(datetime.nanosecond / 1000000))
    })

    it('should not convert to a standard date (zoneid)', () => {
      const datetime = new DateTime(2020, 12, 15, 12, 2, 3, 4000000, undefined, 'Europe/Stockholm')

      expect(() => datetime.toStandardDate())
        .toThrow(new Error('Requires DateTime created with time zone offset'))
    })

    it('should be the reverse operation of fromStandardDate', () => {
      fc.assert(
        fc.property(
          fc.date({
            max: temporalUtil.newDate(MAX_UTC_IN_MS - ONE_DAY_IN_MS),
            min: temporalUtil.newDate(MIN_UTC_IN_MS + ONE_DAY_IN_MS)
          }), (date) => {
            const datetime = DateTime.fromStandardDate(date)
            const receivedDate = datetime.toStandardDate()

            expect(receivedDate).toEqual(date)
          })
      )
    })
  })

  describe('fromString', () => {
    it.each([
      ['2026-01-05T15:36:42.01+01:00', new DateTime(int(2026), int(1), int(5), int(15), int(36), int(42), int(10000000), int(3600))],
      ['2026-01-05T15:36:42.01-01:00', new DateTime(int(2026), int(1), int(5), int(15), int(36), int(42), int(10000000), int(-3600))],
      ['2026-01-05T15:36:42Z', new DateTime(int(2026), int(1), int(5), int(15), int(36), int(42), int(0), int(0))],
      ['2026-01-05T15:36:42.12414Z', new DateTime(int(2026), int(1), int(5), int(15), int(36), int(42), int(124140000), int(0))],
      ['2026-01-05T15:36.12414Z', new DateTime(int(2026), int(1), int(5), int(15), int(36), int(7), int(448400000), int(0))],
      ['2026-01-05T15:36:42[America/Anchorage]', new DateTime(int(2026), int(1), int(5), int(15), int(36), int(42), int(0), undefined, 'America/Anchorage')],
      ['0001-01-01T01:01:01.000000001+00:00:01', new DateTime(int(1), int(1), int(1), int(1), int(1), int(1), int(1), int(1))],
      ['2026-01-05T15:36:42+0001[America/Anchorage]', new DateTime(int(2026), int(1), int(5), int(15), int(36), int(42), int(0), int(60), 'America/Anchorage')],
      ['2026-01-05T15:36:42Z[America/Anchorage]', new DateTime(int(2026), int(1), int(5), int(15), int(36), int(42), int(0), int(0), 'America/Anchorage')],
      ['2026-01-05T15:36:42-00:00[America/Anchorage]', new DateTime(int(2026), int(1), int(5), int(15), int(36), int(42), int(0), int(0), 'America/Anchorage')]
    ])('should successfully convert date string %s', (string: string, expected: DateTime<Integer>) => {
      expect(DateTime.fromString(string)).toEqual(expected)
    })
    it.each([
      ['2026-01-05T15:36:42Z00:00', 'DateTime could not be parsed from string, can not parse string with offset after Z'],
      ['2026-01-05T15:36:42Z:00', 'DateTime could not be parsed from string'],
      ['2026-01-05T15:36:42ZZ', 'DateTime could not be parsed from string'],
      ['2026-01-05T-15:36:42Z', 'DateTime could not be parsed from string'],
      ['2026-01-05 15:36:42Z', 'DateTime could not be parsed from string'],
      ['2026-01-05T15:36:42', 'DateTime could not be parsed from string'],
      ['2026-01-05T15:36:42+[America/Anchorage]', 'DateTime could not be parsed from string'],
      ['2026-01-05T15:36:42-[America/Anchorage]', 'DateTime could not be parsed from string'],
      ['2026-01-05T15:36:42Z00:00[America/Anchorage]', 'DateTime could not be parsed from string, can not parse string with offset after Z']
    ])('should thrown when converting invalid string %s', (string: string, expected: string) => {
      expect(() => DateTime.fromString(string)).toThrow(expected)
    })
  })
})

describe('Duration', () => {
  describe('isDuration', () => {
    it.each([
      [new Duration(1, 2, 3, 4), true],
      [null, false],
      [LocalDateTime.fromStandardDate(new global.Date()), false],
      [{ months: 1, days: 1, seconds: 2, nanoseconds: 2 }, false]
    ])('should be a type guard [%o]', (obj: unknown, objIsDuration: boolean) => {
      expect(isDuration(obj)).toEqual(objIsDuration)

      if (isDuration(obj)) {
        const duration: Duration = obj
        expect(duration).toEqual(obj)
      } else {
        // @ts-expect-error
        const duration: Duration = obj
        expect(duration).toEqual(obj)
      }
    })
  })
  it.each([
    [1, 2, 3, 4],
    [BigInt(1), BigInt(2), BigInt(3), BigInt(4)],
    [new Integer(1), new Integer(2), new Integer(3), new Integer(4)],
    [new Integer(1), 2, new Integer(3), BigInt(4)],
    [1, 2, BigInt(3), 4]
  ])('should handle differing types for parameters', (months, days, seconds, nanos) => {
    const duration = new Duration(months, days, seconds, nanos)
    expect(duration.months).toEqual(months)
    expect(duration.days).toEqual(days)
    expect(duration.seconds).toEqual(seconds)
    expect(duration.nanoseconds).toEqual(nanos)
  })

  describe('fromString', () => {
    it.each([
      ['PT1S', new Duration(int(0), int(0), int(1), int(0))],
      ['PT-1.001S', new Duration(int(0), int(0), int(-2), int(999000000))],
      ['PT3H-1.001S', new Duration(int(0), int(0), int(3600 * 3 - 2), int(999000000))],
      ['PT-3H-1.001S', new Duration(int(0), int(0), int(3600 * -3 - 2), int(999000000))],
      ['P1Y4M2D', new Duration(int(16), int(2), int(0), int(0))],
      ['P4M', new Duration(int(4), int(0), int(0), int(0))],
      ['PT4M', new Duration(int(0), int(0), int(240), int(0))],
      ['P0.5Y', new Duration(int(6), int(0), int(0), int(0))],
      ['PT2147483648.1S', new Duration(int(0), int(0), int(2147483648), int(100000000))],
      ['PT1s', new Duration(int(0), int(0), int(1), int(0))],
      ['PT1,1S', new Duration(int(0), int(0), int(1), int(100000000))],
      ['PT1.1S', new Duration(int(0), int(0), int(1), int(100000000))]
    ])('should successfully convert duration strings', (string: string, expected: Duration<Integer>) => {
      expect(Duration.fromString(string)).toEqual(expected)
    })
    it.each([
      ['P0.5M', 'Parsing Duration field: Months resulted in a non-integer value. Bolt protocol can only send durations which can be simplified to integer values of months, days, seconds and nanoseconds.'],
      ['P..0.2..25M', 'Duration could not be parsed from string: P..0.2..25M'],
      ['PT0.3.3S', 'Duration could not be parsed from string: PT0.3.3'],
      ['ok... so somewhere in here is a PT1S duration...', 'Duration could not be parsed from string'],
      ['P', 'Duration could not be parsed from string: P'],
      ['PT', 'Duration string \'PT\' ends with \'T\', time delimiter must be excluded if Duration contains no time components'],
      ['P1S', 'Duration could not be parsed from string: P1S'],
      ['P1YT', 'Duration string \'P1YT\' ends with \'T\', time delimiter must be excluded if Duration contains no time components']
    ])('should fail to parse invalid duration strings', (string: string, expected: string) => {
      expect(() => Duration.fromString(string)).toThrow(expected)
    })
  })
})

describe('Time', () => {
  describe('.fromString', () => {
    it.each([
      ['23:59:00Z', new Time(int(23), int(59), int(0), int(0), int(0))],
      ['23:59:00+1010', new Time(int(23), int(59), int(0), int(0), int(10 * 3600 + 10 * 60))],
      ['23:59:00+01', new Time(int(23), int(59), int(0), int(0), int(3600))],
      ['23:59:00-01:01', new Time(int(23), int(59), int(0), int(0), int(-3660))]
    ])('should successfully convert time strings', (string: string, expected: Time<Integer>) => {
      expect(Time.fromString(string)).toEqual(expected)
    })
    it.each([
      ['25:59:00Z', 'Hour is expected to be in range [0, 23] but was: 25'],
      ['23:61:00Z', 'Minute is expected to be in range [0, 59] but was: 61'],
      ['23:59:61Z', 'Second is expected to be in range [0, 59] but was: 61'],
      ['25:59:00', 'Time could not be parsed from string'],
      ['25:59:00Zhello', 'Time could not be parsed from string'],
      ['Time:25:59:00Z', 'Time could not be parsed from string']
    ])('should fail to parse invalid time strings', (string: string, expected: string) => {
      expect(() => Time.fromString(string)).toThrow(expected)
    })
  })
})

describe('LocalTime', () => {
  describe('.fromString', () => {
    it.each([
      ['23:59:00', new LocalTime(int(23), int(59), int(0), int(0))],
      ['23:59:00.1', new LocalTime(int(23), int(59), int(0), int(100000000))],
      ['23', new LocalTime(int(23), int(0), int(0), int(0))],
      ['23.5', new LocalTime(int(23), int(30), int(0), int(0))],
      ['T010203', new LocalTime(int(1), int(2), int(3), int(0))]
    ])('should successfully convert localtime strings', (string: string, expected: LocalTime<Integer>) => {
      expect(LocalTime.fromString(string)).toEqual(expected)
    })
    it.each([
      ['25:59:00', 'Hour is expected to be in range [0, 23] but was: 25'],
      ['23 59 00', 'LocalTime could not be parsed from string'],
      ['23.59:00', 'LocalTime could not be parsed from string'],
      ['23:00:1', 'LocalTime could not be parsed from string']
    ])('should fail to parse invalid localtime strings', (string: string, expected: string) => {
      expect(() => LocalTime.fromString(string)).toThrow(expected)
    })
  })
})

describe('isLocalTime', () => {
  it.each([
    [new LocalTime(1, 2, 3, 4), true],
    [null, false],
    [LocalDateTime.fromStandardDate(new global.Date()), false],
    [{ months: 1, days: 1, seconds: 2, nanoseconds: 2 }, false]
  ])('should be a type guard [%o]', (obj: unknown, objIsLocalTime: boolean) => {
    expect(isLocalTime(obj)).toEqual(objIsLocalTime)

    if (isLocalTime(obj)) {
      const localTime: LocalTime = obj
      expect(localTime).toEqual(obj)
    } else {
      // @ts-expect-error
      const localTime: LocalTime = obj
      expect(localTime).toEqual(obj)
    }
  })
})

describe('isTime', () => {
  it.each([
    [new Time(1, 2, 3, 2, 300), true],
    [null, false],
    [LocalDateTime.fromStandardDate(new global.Date()), false],
    [{ months: 1, days: 1, seconds: 2, nanoseconds: 2 }, false]
  ])('should be a type guard [%o]', (obj: unknown, objIsTime: boolean) => {
    expect(isTime(obj)).toEqual(objIsTime)

    if (isTime(obj)) {
      const time: Time = obj
      expect(time).toEqual(obj)
    } else {
      // @ts-expect-error
      const time: Time = obj
      expect(time).toEqual(obj)
    }
  })
})

describe('isDate', () => {
  it.each([
    [new Date(1, 2, 3), true],
    [null, false],
    [LocalDateTime.fromStandardDate(new global.Date()), false],
    [{ months: 1, days: 1, seconds: 2, nanoseconds: 2 }, false]
  ])('should be a type guard [%o]', (obj: unknown, objIsDate: boolean) => {
    expect(isDate(obj)).toEqual(objIsDate)

    if (isDate(obj)) {
      const date: Date = obj
      expect(date).toEqual(obj)
    } else {
      // @ts-expect-error
      const date: Date = obj
      expect(date).toEqual(obj)
    }
  })
})

describe('isLocalDateTime', () => {
  it.each([
    [LocalDateTime.fromStandardDate(new global.Date()), true],
    [new Date(1, 2, 3), false],
    [null, false],
    [{ months: 1, days: 1, seconds: 2, nanoseconds: 2 }, false]
  ])('should be a type guard [%o]', (obj: unknown, objIsLocalDateTime: boolean) => {
    expect(isLocalDateTime(obj)).toEqual(objIsLocalDateTime)

    if (isLocalDateTime(obj)) {
      const localDateTime: LocalDateTime = obj
      expect(localDateTime).toEqual(obj)
    } else {
      // @ts-expect-error
      const localDateTime: LocalDateTime = obj
      expect(localDateTime).toEqual(obj)
    }
  })
})

describe('isDateTime', () => {
  it.each([
    [DateTime.fromStandardDate(new global.Date()), true],
    [new Date(1, 2, 3), false],
    [null, false],
    [1, false],
    [{ months: 1, days: 1, seconds: 2, nanoseconds: 2 }, false]
  ])('should be a type guard [%o]', (obj: unknown, objIsDateTime: boolean) => {
    expect(isDateTime(obj)).toEqual(objIsDateTime)

    if (isDateTime(obj)) {
      const dateTime: DateTime = obj
      expect(dateTime).toEqual(obj)
    } else {
      // @ts-expect-error
      const dateTime: DateTime = obj
      expect(dateTime).toEqual(obj)
    }
  })
})

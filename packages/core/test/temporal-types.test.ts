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

import { StandardDate } from '../src/graph-types'
import { LocalDateTime, Date, DateTime } from '../src/temporal-types'
import { temporalUtil } from '../src/internal'
import fc from 'fast-check'

const MIN_UTC_IN_MS = -8_640_000_000_000_000
const MAX_UTC_IN_MS = 8_640_000_000_000_000
const ONE_DAY_IN_MS = 86_400_000

describe('Date', () => {
  describe('.toStandardDate()', () => {
    it('should convert to a standard date', () => {
      const localDatetime = new Date(2020, 3, 2)

      const standardDate = localDatetime.toStandardDate()

      expect(standardDate.getFullYear()).toEqual(localDatetime.year)
      expect(standardDate.getMonth()).toEqual(localDatetime.month - 1)
      expect(standardDate.getDate()).toEqual(localDatetime.day)
    })

    it('should be the reverse operation of fromStandardDate but losing time information', () => {
      fc.assert(
        fc.property(
          fc.date({
            max: temporalUtil.newDate(MAX_UTC_IN_MS - ONE_DAY_IN_MS),
            min: temporalUtil.newDate(MIN_UTC_IN_MS + ONE_DAY_IN_MS)
          }),
          standardDate => {
            const date = Date.fromStandardDate(standardDate)
            const receivedDate = date.toStandardDate()

            const adjustedDateTime = temporalUtil.newDate(standardDate)
            adjustedDateTime.setHours(0, offset(receivedDate))

            expect(receivedDate.getFullYear()).toEqual(adjustedDateTime.getFullYear())
            expect(receivedDate.getMonth()).toEqual(adjustedDateTime.getMonth())
            expect(receivedDate.getDate()).toEqual(adjustedDateTime.getDate())
            expect(receivedDate.getHours()).toEqual(adjustedDateTime.getHours())
            expect(receivedDate.getMinutes()).toEqual(adjustedDateTime.getMinutes())
          })
      )
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

      expect(standardDate.getFullYear()).toEqual(datetime.year)
      expect(standardDate.getMonth()).toEqual(datetime.month - 1)
      expect(standardDate.getDate()).toEqual(datetime.day)
      const offsetInMinutes = offset(standardDate)
      const offsetAdjust = offsetInMinutes - (datetime.timeZoneOffsetSeconds ?? 0) / 60
      const hourDiff = Math.abs(offsetAdjust / 60)
      const minuteDiff = Math.abs(offsetAdjust % 60)
      expect(standardDate.getHours()).toBe(datetime.hour - hourDiff)
      expect(standardDate.getMinutes()).toBe(datetime.minute - minuteDiff)
      expect(standardDate.getSeconds()).toBe(datetime.second)
      expect(standardDate.getMilliseconds()).toBe(Math.round(datetime.nanosecond / 1000000))
    })

    it('should convert to a standard date (offset)', () => {
      const datetime = new DateTime(2020, 12, 15, 12, 2, 3, 4000000, 120 * 60)

      const standardDate = datetime.toStandardDate()

      expect(standardDate.getFullYear()).toEqual(datetime.year)
      expect(standardDate.getMonth()).toEqual(datetime.month - 1)
      expect(standardDate.getDate()).toEqual(datetime.day)
      const offsetInMinutes = offset(standardDate)
      const offsetAdjust = offsetInMinutes - (datetime.timeZoneOffsetSeconds ?? 0) / 60
      const hourDiff = Math.abs(offsetAdjust / 60)
      const minuteDiff = Math.abs(offsetAdjust % 60)
      expect(standardDate.getHours()).toBe(datetime.hour - hourDiff)
      expect(standardDate.getMinutes()).toBe(datetime.minute - minuteDiff)
      expect(standardDate.getSeconds()).toBe(datetime.second)
      expect(standardDate.getMilliseconds()).toBe(Math.round(datetime.nanosecond / 1000000))
    })

    it('should not convert to a standard date (zoneid)', () => {
      const datetime = new DateTime(2020, 12, 15, 12, 2, 3, 4000000, undefined, 'Europe/Stockholm')

      expect(() => datetime.toStandardDate())
        .toThrow(new Error('Requires DateTime created with time zone offset'))
    })

    it('should be the reverse operation of fromStandardDate', () => {
      fc.assert(
        fc.property(fc.date(), (date) => {
          const datetime = DateTime.fromStandardDate(date)
          const receivedDate = datetime.toStandardDate()

          expect(receivedDate).toEqual(date)
        })
      )
    })
  })
})

/**
 * The offset in StandardDate is the number of minutes
 * to sum to the date and time to get the UTC time.
 *
 * This function change the sign of the offset,
 * this way using the most common meaning.
 * The time to add to UTC to get the local time.
 */
function offset (date: StandardDate): number {
  return date.getTimezoneOffset() * -1
}

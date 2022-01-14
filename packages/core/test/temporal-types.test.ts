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
      const standardDate = new global.Date()

      const date = Date.fromStandardDate(standardDate)
      const receivedDate = date.toStandardDate()

      // Setting 00:00:00:000 UTC
      standardDate.setHours(0, -1 * standardDate.getTimezoneOffset(), 0, 0)

      expect(receivedDate).toEqual(standardDate)
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
      const date = new global.Date()

      const localDatetime = LocalDateTime.fromStandardDate(date)
      const receivedDate = localDatetime.toStandardDate()

      expect(receivedDate).toEqual(date)
    })
  })
})

describe('DateTime', () => {
  describe('.toStandardDate()', () => {
    it('should convert to a standard date (offset)', () => {
      const datetime = new DateTime(2020, 12, 15, 12, 2, 3, 4000000, 120 * 60)

      const standardDate = datetime.toStandardDate()


      expect(standardDate.getFullYear()).toEqual(datetime.year)
      expect(standardDate.getMonth()).toEqual(datetime.month - 1)
      expect(standardDate.getDate()).toEqual(datetime.day)
      const offsetInMinutes = offset(standardDate)
      const offsetAdjust = offsetInMinutes - datetime.timeZoneOffsetSeconds!! / 60
      const hourDiff = Math.abs(offsetAdjust / 60)
      const minuteDiff = Math.abs(offsetAdjust % 60)
      expect(standardDate.getHours()).toBe(datetime.hour - hourDiff)
      expect(standardDate.getMinutes()).toBe(datetime.minute - minuteDiff)
      expect(standardDate.getSeconds()).toBe(datetime.second)
      expect(standardDate.getMilliseconds()).toBe(datetime.nanosecond / 1000000)
    })

    it('should not convert to a standard date (zoneid)', () => {
      const datetime = new DateTime(2020, 12, 15, 12, 2, 3, 4000000, undefined, 'Europe/Stockholm')

      expect(() => datetime.toStandardDate())
        .toThrow(new Error('Requires DateTime created with time zone offset'))

    })

    it('should be the reverse operation of fromStandardDate', () => {
      const date = new global.Date()

      const datetime = DateTime.fromStandardDate(date)
      const receivedDate = datetime.toStandardDate()

      expect(receivedDate).toEqual(date)
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
function offset(date: StandardDate): number {
  return date.getTimezoneOffset() * -1
}

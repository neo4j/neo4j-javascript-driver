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
  describe('.toString()', () => {
    it('should return a string which can be loaded by new Date', () => {
      fc.assert(
        fc.property(
          fc.date({
            max: temporalUtil.newDate(MAX_UTC_IN_MS - ONE_DAY_IN_MS),
            min: temporalUtil.newDate(MIN_UTC_IN_MS + ONE_DAY_IN_MS)
          }),
          standardDate => {
            const date = Date.fromStandardDate(standardDate)
            const receivedDate = temporalUtil.newDate(date.toString())

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
  describe('.toString()', () => {
    it('should return a string which can be loaded by new Date', () => {
      fc.assert(
        fc.property(fc.date(), (date) => {
          const localDatetime = LocalDateTime.fromStandardDate(date)
          const receivedDate = temporalUtil.newDate(localDatetime.toString())

          expect(receivedDate).toEqual(date)
        })
      )
    })
  })
})

describe('DateTime', () => {
  describe('.toString()', () => {
    it('should return a string which can be loaded by new Date', () => {
      fc.assert(
        fc.property(fc.date().filter(dt => dt.getSeconds() === dt.getUTCSeconds()), (date) => {
          const datetime = DateTime.fromStandardDate(date)
          const receivedDate = temporalUtil.newDate(datetime.toString())

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

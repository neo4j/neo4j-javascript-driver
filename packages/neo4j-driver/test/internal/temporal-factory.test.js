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

import { int } from 'neo4j-driver-core'
import * as factory from '../../../bolt-connection/lib/packstream/temporal-factory'
import { types } from '../../src'

describe('#unit temporal-factory', () => {
  it('should convert epoch day to cypher date', () => {
    expect(factory.epochDayToDate(-719528)).toEqual(date(0, 1, 1))
    expect(factory.epochDayToDate(-135153)).toEqual(date(1599, 12, 19))
    expect(factory.epochDayToDate(7905)).toEqual(date(1991, 8, 24))
    expect(factory.epochDayToDate(int(48210))).toEqual(date(2101, 12, 30))
    expect(factory.epochDayToDate(int(-4310226))).toEqual(date(-9831, 1, 1))
  })

  it('should convert nanosecond of the day to cypher local time', () => {
    expect(factory.nanoOfDayToLocalTime(68079000012399)).toEqual(
      localTime(18, 54, 39, 12399)
    )
    expect(factory.nanoOfDayToLocalTime(0)).toEqual(localTime(0, 0, 0, 0))
    expect(factory.nanoOfDayToLocalTime(1)).toEqual(localTime(0, 0, 0, 1))
    expect(factory.nanoOfDayToLocalTime(int(86399999999999))).toEqual(
      localTime(23, 59, 59, 999999999)
    )
    expect(factory.nanoOfDayToLocalTime(int(46277000808080))).toEqual(
      localTime(12, 51, 17, 808080)
    )
  })

  it('should convert epoch second with nano to cypher local date-time', () => {
    expect(factory.epochSecondAndNanoToLocalDateTime(653165977, 999)).toEqual(
      localDateTime(1990, 9, 12, 18, 59, 37, 999)
    )
    expect(
      factory.epochSecondAndNanoToLocalDateTime(-62703676801, 12345)
    ).toEqual(localDateTime(-18, 12, 31, 23, 59, 59, 12345))
    expect(factory.epochSecondAndNanoToLocalDateTime(2678400, int(1))).toEqual(
      localDateTime(1970, 2, 1, 0, 0, 0, 1)
    )
    expect(
      factory.epochSecondAndNanoToLocalDateTime(
        int(3065493882737),
        int(1794673)
      )
    ).toEqual(localDateTime(99111, 8, 21, 6, 32, 17, 1794673))
    expect(
      factory.epochSecondAndNanoToLocalDateTime(int(-37428234001), 999999111)
    ).toEqual(localDateTime(783, 12, 12, 20, 19, 59, 999999111))
  })
})

function date (year, month, day) {
  return new types.Date(int(year), int(month), int(day))
}

function localTime (hour, minute, second, nanosecond) {
  return new types.LocalTime(
    int(hour),
    int(minute),
    int(second),
    int(nanosecond)
  )
}

function localDateTime (year, month, day, hour, minute, second, nanosecond) {
  return new types.LocalDateTime(
    int(year),
    int(month),
    int(day),
    int(hour),
    int(minute),
    int(second),
    int(nanosecond)
  )
}

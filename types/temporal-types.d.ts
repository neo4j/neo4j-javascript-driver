/**
 * Copyright (c) 2002-2019 "Neo4j,"
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

import { NumberOrInteger, StandardDate } from './graph-types'
import Integer from './integer'

declare class Duration<T extends NumberOrInteger = Integer> {
  readonly months: T
  readonly days: T
  readonly seconds: T
  readonly nanoseconds: T

  constructor(months: T, days: T, seconds: T, nanoseconds: T)
}

declare class LocalTime<T extends NumberOrInteger = Integer> {
  readonly hour: T
  readonly minute: T
  readonly second: T
  readonly nanosecond: T

  constructor(hour: T, minute: T, second: T, nanosecond: T)

  static fromStandardDate(
    standardDate: StandardDate,
    nanosecond?: number
  ): LocalTime<number>
}

declare class Time<T extends NumberOrInteger = Integer> {
  readonly hour: T
  readonly minute: T
  readonly second: T
  readonly nanosecond: T
  readonly timeZoneOffsetSeconds: T

  constructor(
    hour: T,
    minute: T,
    second: T,
    nanosecond: T,
    timeZoneOffsetSeconds: T
  )

  static fromStandardDate(
    standardDate: StandardDate,
    nanosecond?: number
  ): Time<number>
}

declare class Date<T extends NumberOrInteger = Integer> {
  readonly year: T
  readonly month: T
  readonly day: T

  constructor(year: T, month: T, day: T)

  static fromStandardDate(standardDate: StandardDate): Date<number>
}

declare class LocalDateTime<T extends NumberOrInteger = Integer> {
  readonly year: T
  readonly month: T
  readonly day: T
  readonly hour: T
  readonly minute: T
  readonly second: T
  readonly nanosecond: T

  constructor(
    year: T,
    month: T,
    day: T,
    hour: T,
    minute: T,
    second: T,
    nanosecond: T
  )

  static fromStandardDate(
    standardDate: StandardDate,
    nanosecond?: number
  ): LocalDateTime<number>
}

declare class DateTime<T extends NumberOrInteger = Integer> {
  readonly year: T
  readonly month: T
  readonly day: T
  readonly hour: T
  readonly minute: T
  readonly second: T
  readonly nanosecond: T
  readonly timeZoneOffsetSeconds?: T
  readonly timeZoneId?: string

  constructor(
    year: T,
    month: T,
    day: T,
    hour: T,
    minute: T,
    second: T,
    nanosecond: T,
    timeZoneOffsetSeconds?: T,
    timeZoneId?: string
  )

  static fromStandardDate(
    standardDate: StandardDate,
    nanosecond?: number
  ): DateTime<number>
}

declare function isDuration(obj: object): boolean

declare function isLocalTime(obj: object): boolean

declare function isTime(obj: object): boolean

declare function isDate(obj: object): boolean

declare function isLocalDateTime(obj: object): boolean

declare function isDateTime(obj: object): boolean

export {
  Duration,
  LocalTime,
  Time,
  Date,
  LocalDateTime,
  DateTime,
  isDuration,
  isLocalTime,
  isTime,
  isDate,
  isLocalDateTime,
  isDateTime
}

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

import {
  int,
  Integer,
  Date,
  DateTime,
  Duration,
  isDate,
  isDateTime,
  isDuration,
  isLocalDateTime,
  isLocalTime,
  isTime,
  LocalDateTime,
  LocalTime,
  Time,
  StandardDate
} from 'neo4j-driver-core'

const duration1: Duration = new Duration(int(1), int(1), int(1), int(1))
const months1: Integer = duration1.months
const days1: Integer = duration1.days
const seconds1: Integer = duration1.seconds
const nanoseconds1: Integer = duration1.nanoseconds
const durationIsInstance1: boolean = duration1 instanceof Duration

const duration2: Duration<number> = new Duration(1, 1, 1, 1)
const months2: number = duration2.months
const days2: number = duration2.days
const seconds2: number = duration2.seconds
const nanoseconds2: number = duration2.nanoseconds
const durationIsInstance2: boolean = duration2 instanceof Duration

const localTime1: LocalTime = new LocalTime(int(1), int(1), int(1), int(1))
const localTime1Hour1: Integer = localTime1.hour
const localTime1Minute1: Integer = localTime1.minute
const localTime1Second1: Integer = localTime1.second
const localTime1Nanosecond1: Integer = localTime1.nanosecond
const localTimeIsInstance1: boolean = localTime1 instanceof LocalTime

const localTime2: LocalTime<number> = new LocalTime(1, 1, 1, 1)
const localTime2Hour1: number = localTime2.hour
const localTime2Minute1: number = localTime2.minute
const localTime2Second1: number = localTime2.second
const localTime2Nanosecond1: number = localTime2.nanosecond
const localTimeIsInstance2: boolean = localTime2 instanceof LocalTime

const time1: Time = new Time(int(1), int(1), int(1), int(1), int(1))
const offset1: Integer = time1.timeZoneOffsetSeconds
const hour1: Integer = time1.hour
const minute1: Integer = time1.minute
const second1: Integer = time1.second
const nanosecond1: Integer = time1.nanosecond
const timeIsInstance1: boolean = time1 instanceof Time

const time2: Time<number> = new Time(1, 1, 1, 1, 1)
const offset2: number = time2.timeZoneOffsetSeconds
const hour2: number = time2.hour
const minute2: number = time2.minute
const second2: number = time2.second
const nanosecond2: number = time2.nanosecond
const timeIsInstance2: boolean = time2 instanceof Time

const date1: Date = new Date(int(1), int(1), int(1))
const date1Year1: Integer = date1.year
const date1Month1: Integer = date1.month
const date1Day1: Integer = date1.day
const dateIsInstance1: boolean = date1 instanceof Date

const date2: Date<number> = new Date(1, 1, 1)
const date2Year1: number = date2.year
const date2Month1: number = date2.month
const date2Day1: number = date2.day
const dateIsInstance2: boolean = date2 instanceof Date

const localDateTime1: LocalDateTime = new LocalDateTime(
  int(1),
  int(1),
  int(1),
  int(1),
  int(1),
  int(1),
  int(1)
)
const year1: Integer = localDateTime1.year
const month1: Integer = localDateTime1.month
const day1: Integer = localDateTime1.day
const hour3: Integer = localDateTime1.hour
const minute3: Integer = localDateTime1.minute
const second3: Integer = localDateTime1.second
const nanosecond3: Integer = localDateTime1.nanosecond
const localDateTimeIsInstance1: boolean =
  localDateTime1 instanceof LocalDateTime

const localDateTime2: LocalDateTime<number> = new LocalDateTime(
  1,
  1,
  1,
  1,
  1,
  1,
  1
)
const year2: number = localDateTime2.year
const month2: number = localDateTime2.month
const day2: number = localDateTime2.day
const hour4: number = localDateTime2.hour
const minute4: number = localDateTime2.minute
const second4: number = localDateTime2.second
const nanosecond4: number = localDateTime2.nanosecond
const localDateTimeIsInstance2: boolean =
  localDateTime2 instanceof LocalDateTime

const dateTime1: DateTime = new DateTime(
  int(1),
  int(1),
  int(1),
  int(1),
  int(1),
  int(1),
  int(1),
  int(1),
  undefined
)
const zoneId1: string | undefined = dateTime1.timeZoneId
const offset3: Integer | undefined = dateTime1.timeZoneOffsetSeconds
const year3: Integer = dateTime1.year
const month3: Integer = dateTime1.month
const day3: Integer = dateTime1.day
const hour5: Integer = dateTime1.hour
const minute5: Integer = dateTime1.minute
const second5: Integer = dateTime1.second
const nanosecond5: Integer = dateTime1.nanosecond
const dateTimeIsInstance1: boolean = dateTime1 instanceof DateTime

const dateTime2: DateTime<number> = new DateTime(
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  undefined
)
const zoneId2: string | undefined = dateTime2.timeZoneId
const offset4: number | undefined = dateTime2.timeZoneOffsetSeconds
const year4: number = dateTime2.year
const month4: number = dateTime2.month
const day4: number = dateTime2.day
const hour6: number = dateTime2.hour
const minute6: number = dateTime2.minute
const second6: number = dateTime2.second
const nanosecond6: number = dateTime2.nanosecond
const dateTimeIsInstance2: boolean = dateTime2 instanceof DateTime

const dateTime3: DateTime = new DateTime(
  int(1),
  int(1),
  int(1),
  int(1),
  int(1),
  int(1),
  int(1),
  undefined,
  'UTC'
)
const zoneId3: string | undefined = dateTime3.timeZoneId
const offset5: Integer | undefined = dateTime3.timeZoneOffsetSeconds
const year5: Integer = dateTime3.year
const month5: Integer = dateTime3.month
const day5: Integer = dateTime3.day
const hour7: Integer = dateTime3.hour
const minute7: Integer = dateTime3.minute
const second7: Integer = dateTime3.second
const nanosecond7: Integer = dateTime3.nanosecond
const dateTimeIsInstance3: boolean = dateTime3 instanceof DateTime

const dateTime4: DateTime<number> = new DateTime(
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  undefined,
  'UTC'
)
const zoneId4: string | undefined = dateTime4.timeZoneId
const offset6: number | undefined = dateTime4.timeZoneOffsetSeconds
const year6: number = dateTime4.year
const month6: number = dateTime4.month
const day6: number = dateTime4.day
const hour8: number = dateTime4.hour
const minute8: number = dateTime4.minute
const second8: number = dateTime4.second
const nanosecond8: number = dateTime4.nanosecond
const dateTimeIsInstance4: boolean = dateTime4 instanceof DateTime

const isDurationValue: boolean = isDuration(duration1)
const isLocalTimeValue: boolean = isLocalTime(localTime1)
const isTimeValue: boolean = isTime(time1)
const isDateValue: boolean = isDate(date1)
const isLocalDateTimeValue: boolean = isLocalDateTime(localDateTime1)
const isDateTimeValue: boolean = isDateTime(dateTime1)

const dummy: any = null
const standardDate: StandardDate = dummy
const localTime3: LocalTime<number> = LocalTime.fromStandardDate(standardDate)
const localTime4: LocalTime<number> = LocalTime.fromStandardDate(
  standardDate,
  42
)
const time3: Time<number> = Time.fromStandardDate(standardDate)
const time4: Time<number> = Time.fromStandardDate(standardDate, 42)
const date3: Date<number> = Date.fromStandardDate(standardDate)
const localDateTime3: LocalDateTime<number> = LocalDateTime.fromStandardDate(
  standardDate
)
const localDateTime4: LocalDateTime<number> = LocalDateTime.fromStandardDate(
  standardDate,
  42
)
const dateTime5: DateTime<number> = DateTime.fromStandardDate(standardDate)
const dateTime6: DateTime<number> = DateTime.fromStandardDate(standardDate, 42)

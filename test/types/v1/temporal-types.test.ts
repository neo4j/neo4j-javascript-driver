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

import {
  Date,
  DateTimeWithZoneOffset,
  Duration,
  isDate,
  isDateTimeWithZoneId,
  isDateTimeWithZoneOffset,
  isDuration,
  isLocalDateTime,
  isLocalTime,
  isTime,
  LocalDateTime,
  LocalTime,
  Time
} from "../../../types/v1/temporal-types";
import Integer, {int} from "../../../types/v1/integer";

const duration1: Duration = new Duration(int(1), int(1), int(1), int(1));
const months1: Integer = duration1.months;
const days1: Integer = duration1.days;
const seconds1: Integer = duration1.seconds;
const nanoseconds1: Integer = duration1.nanoseconds;

const duration2: Duration<number> = new Duration(1, 1, 1, 1);
const months2: number = duration2.months;
const days2: number = duration2.days;
const seconds2: number = duration2.seconds;
const nanoseconds2: number = duration2.nanoseconds;

const localTime1: LocalTime = new LocalTime(int(1), int(1), int(1), int(1));
const localTime1Hour1: Integer = localTime1.hour;
const localTime1Minute1: Integer = localTime1.minute;
const localTime1Second1: Integer = localTime1.second;
const localTime1Nanosecond1: Integer = localTime1.nanosecond;

const localTime2: LocalTime<number> = new LocalTime(1, 1, 1, 1);
const localTime2Hour1: number = localTime2.hour;
const localTime2Minute1: number = localTime2.minute;
const localTime2Second1: number = localTime2.second;
const localTime2Nanosecond1: number = localTime2.nanosecond;

const time1: Time = new Time(localTime1, int(1));
const localTime3: LocalTime = time1.localTime;
const offset1: Integer = time1.offsetSeconds;

const time2: Time<number> = new Time(localTime2, 1);
const localTime4: LocalTime<number> = time2.localTime;
const offset2: number = time2.offsetSeconds;

const date1: Date = new Date(int(1), int(1), int(1));
const date1Year1: Integer = date1.year;
const date1Month1: Integer = date1.month;
const date1Day1: Integer = date1.day;

const date2: Date<number> = new Date(1, 1, 1);
const date2Year1: number = date2.year;
const date2Month1: number = date2.month;
const date2Day1: number = date2.day;

const localDateTime1: LocalDateTime = new LocalDateTime(date1, localTime1);
const date3: Date = localDateTime1.localDate;
const localTime5: LocalTime = localDateTime1.localTime;

const localDateTime2: LocalDateTime<number> = new LocalDateTime(date2, localTime2);
const date4: Date<number> = localDateTime2.localDate;
const localTime6: LocalTime<number> = localDateTime2.localTime;

const dateTime1: DateTimeWithZoneOffset = new DateTimeWithZoneOffset(localDateTime1, int(1));
const localDateTime3: LocalDateTime = dateTime1.localDateTime;
const offset3: Integer = dateTime1.offsetSeconds;

const dateTime2: DateTimeWithZoneOffset<number> = new DateTimeWithZoneOffset(localDateTime2, 1);
const localDateTime4: LocalDateTime<number> = dateTime2.localDateTime;
const offset4: number = dateTime2.offsetSeconds;

const isDurationValue: boolean = isDuration(duration1);
const isLocalTimeValue: boolean = isLocalTime(localTime1);
const isTimeValue: boolean = isTime(time1);
const isDateValue: boolean = isDate(date1);
const isLocalDateTimeValue: boolean = isLocalDateTime(localDateTime1);
const isDateTimeWithZoneOffsetValue: boolean = isDateTimeWithZoneOffset(dateTime1);
const isDateTimeWithZoneIdValue: boolean = isDateTimeWithZoneId(dateTime2);

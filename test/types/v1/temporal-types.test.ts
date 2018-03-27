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
  CypherDate,
  CypherDateTimeWithZoneOffset,
  CypherDuration,
  CypherLocalDateTime,
  CypherLocalTime,
  CypherTime,
  isCypherDate,
  isCypherDateTimeWithZoneId,
  isCypherDateTimeWithZoneOffset,
  isCypherDuration,
  isCypherLocalDateTime,
  isCypherLocalTime,
  isCypherTime
} from "../../../types/v1/temporal-types";
import Integer, {int} from "../../../types/v1/integer";

const duration1: CypherDuration = new CypherDuration(int(1), int(1), int(1), int(1));
const months1: Integer = duration1.months;
const days1: Integer = duration1.days;
const seconds1: Integer = duration1.seconds;
const nanoseconds1: Integer = duration1.nanoseconds;

const duration2: CypherDuration<number> = new CypherDuration(1, 1, 1, 1);
const months2: number = duration2.months;
const days2: number = duration2.days;
const seconds2: number = duration2.seconds;
const nanoseconds2: number = duration2.nanoseconds;

const localTime1: CypherLocalTime = new CypherLocalTime(int(1), int(1), int(1), int(1));
const localTime1Hour1: Integer = localTime1.hour;
const localTime1Minute1: Integer = localTime1.minute;
const localTime1Second1: Integer = localTime1.second;
const localTime1Nanosecond1: Integer = localTime1.nanosecond;

const localTime2: CypherLocalTime<number> = new CypherLocalTime(1, 1, 1, 1);
const localTime2Hour1: number = localTime2.hour;
const localTime2Minute1: number = localTime2.minute;
const localTime2Second1: number = localTime2.second;
const localTime2Nanosecond1: number = localTime2.nanosecond;

const time1: CypherTime = new CypherTime(localTime1, int(1));
const localTime3: CypherLocalTime = time1.localTime;
const offset1: Integer = time1.offsetSeconds;

const time2: CypherTime<number> = new CypherTime(localTime2, 1);
const localTime4: CypherLocalTime<number> = time2.localTime;
const offset2: number = time2.offsetSeconds;

const date1: CypherDate = new CypherDate(int(1), int(1), int(1));
const date1Year1: Integer = date1.year;
const date1Month1: Integer = date1.month;
const date1Day1: Integer = date1.day;

const date2: CypherDate<number> = new CypherDate(1, 1, 1);
const date2Year1: number = date2.year;
const date2Month1: number = date2.month;
const date2Day1: number = date2.day;

const localDateTime1: CypherLocalDateTime = new CypherLocalDateTime(date1, localTime1);
const date3: CypherDate = localDateTime1.localDate;
const localTime5: CypherLocalTime = localDateTime1.localTime;

const localDateTime2: CypherLocalDateTime<number> = new CypherLocalDateTime(date2, localTime2);
const date4: CypherDate<number> = localDateTime2.localDate;
const localTime6: CypherLocalTime<number> = localDateTime2.localTime;

const dateTime1: CypherDateTimeWithZoneOffset = new CypherDateTimeWithZoneOffset(localDateTime1, int(1));
const localDateTime3: CypherLocalDateTime = dateTime1.localDateTime;
const offset3: Integer = dateTime1.offsetSeconds;

const dateTime2: CypherDateTimeWithZoneOffset<number> = new CypherDateTimeWithZoneOffset(localDateTime2, 1);
const localDateTime4: CypherLocalDateTime<number> = dateTime2.localDateTime;
const offset4: number = dateTime2.offsetSeconds;

const isDuration: boolean = isCypherDuration(duration1);
const isLocalTime: boolean = isCypherLocalTime(localTime1);
const isTime: boolean = isCypherTime(time1);
const isDate: boolean = isCypherDate(date1);
const isLocalDateTime: boolean = isCypherLocalDateTime(localDateTime1);
const isDateTimeWithZoneOffset: boolean = isCypherDateTimeWithZoneOffset(dateTime1);
const isDateTimeWithZoneId: boolean = isCypherDateTimeWithZoneId(dateTime2);

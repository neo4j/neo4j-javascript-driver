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

import {NumberOrInteger} from './graph-types';
import Integer from "./integer";

declare class CypherDuration<T extends NumberOrInteger = Integer> {
  months: T;
  days: T;
  seconds: T;
  nanoseconds: T;

  constructor(months: T, days: T, seconds: T, nanoseconds: T)
}

declare class CypherLocalTime<T extends NumberOrInteger = Integer> {
  hour: T;
  minute: T;
  second: T;
  nanosecond: T;

  constructor(hour: T, minute: T, second: T, nanosecond: T);
}

declare class CypherTime<T extends NumberOrInteger = Integer> {

  localTime: CypherLocalTime<T>;
  offsetSeconds: T;

  constructor(localTime: CypherLocalTime<T>, offsetSeconds: T);
}

declare class CypherDate<T extends NumberOrInteger = Integer> {

  year: T;
  month: T;
  day: T;

  constructor(year: T, month: T, day: T);
}

declare class CypherLocalDateTime<T extends NumberOrInteger = Integer> {

  localDate: CypherDate<T>;
  localTime: CypherLocalTime<T>;

  constructor(localDate: CypherDate<T>, localTime: CypherLocalTime<T>);
}

declare class CypherDateTimeWithZoneOffset<T extends NumberOrInteger = Integer> {

  localDateTime: CypherLocalDateTime<T>;
  offsetSeconds: T;

  constructor(localDateTime: CypherLocalDateTime<T>, offsetSeconds: T);
}

declare class CypherDateTimeWithZoneId<T extends NumberOrInteger = Integer> {

  localDateTime: CypherLocalDateTime<T>;
  zoneId: string;

  constructor(localDateTime: CypherLocalDateTime<T>, zoneId: string);
}

declare function isCypherDuration(obj: object): boolean;

declare function isCypherLocalTime(obj: object): boolean;

declare function isCypherTime(obj: object): boolean;

declare function isCypherDate(obj: object): boolean;

declare function isCypherLocalDateTime(obj: object): boolean;

declare function isCypherDateTimeWithZoneOffset(obj: object): boolean;

declare function isCypherDateTimeWithZoneId(obj: object): boolean;

export {
  CypherDuration,
  CypherLocalTime,
  CypherTime,
  CypherDate,
  CypherLocalDateTime,
  CypherDateTimeWithZoneOffset,
  CypherDateTimeWithZoneId,
  isCypherDuration,
  isCypherLocalTime,
  isCypherTime,
  isCypherDate,
  isCypherLocalDateTime,
  isCypherDateTimeWithZoneOffset,
  isCypherDateTimeWithZoneId
}

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

import Integer from './integer.ts'
import { Point } from './spatial-types.ts'
import { DateTime, Duration, LocalDateTime, LocalTime, Time } from './temporal-types.ts'

/**
 * Defines methods for hydrate and dehydrate objects
 *
 * @interface
 */
export class HydatrationHooks {
  public readonly Duration?: <V extends unknown> (duration: Duration) => V
  public readonly LocalTime?: <V extends unknown> (localTime: LocalTime) => V
  public readonly LocalDateTime?: <V extends unknown> (localDateTime: LocalDateTime) => V
  public readonly Time?: <V extends unknown> (time: Time) => V
  public readonly Date?: <V extends unknown> (date: Date) => V
  public readonly DateTime?: <V extends unknown> (dateTime: DateTime) => V
  public readonly Integer?: <V extends unknown> (integer: Integer) => V
  public readonly Point?: <V extends unknown> (point: Point) => V

  constructor () {
    throw new Error('This class should not be instantiated')
  }
}

export class DehytrationHook<I = unknown, O = unknown> {
  constructor () {
    throw new Error('This class should not be instantiated')
  }

  public isTypeInstance (value: unknown): value is I {
    throw new Error('Not Implemented')
  }

  public dehydrate (value: I): O {
    throw new Error('Not Implemented')
  }
}

export type DehydrationHooks = DehytrationHook[]
// bytes |> unpack |> fromStructure |> hydrate
// type |> dehydrate |> toStructure |> pack

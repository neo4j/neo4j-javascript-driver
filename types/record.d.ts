/**
 * Copyright (c) 2002-2020 "Neo4j,"
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

declare type Visitor = (value: any, key: string, record: Record) => void

declare type MapVisitor<T> = (value: any, key: string, record: Record) => T

declare class Record {
  keys: string[]
  length: number

  constructor(
    keys: string[],
    fields: any[],
    fieldLookup?: { [index: string]: string }
  )

  forEach(visitor: Visitor): void

  map<T>(visitor: MapVisitor<T>): T[]

  entries(): IterableIterator<[string, Object]>

  values(): IterableIterator<Object>

  [Symbol.iterator](): IterableIterator<Object>

  toObject(): object

  get(key: string | number): any

  has(key: string | number): boolean
}

export default Record

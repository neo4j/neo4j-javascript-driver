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

declare type Dict<Key extends PropertyKey = PropertyKey, Value = any> = {
  [K in Key]: Value
}

declare type Visitor<
  Entries extends Dict = Dict,
  Key extends keyof Entries = keyof Entries
> = MapVisitor<void, Entries, Key>

declare type MapVisitor<
  ReturnType,
  Entries extends Dict = Dict,
  Key extends keyof Entries = keyof Entries
> = (value: Entries[Key], key: Key, record: Record<Entries>) => ReturnType

declare class Record<
  Entries extends Dict = Dict,
  Key extends keyof Entries = keyof Entries,
  FieldLookup extends Dict<string, number> = Dict<string, number>
> {
  keys: Key[]
  length: number

  constructor(keys: Key[], fields: any[], fieldLookup?: FieldLookup)

  forEach(visitor: Visitor<Entries, Key>): void

  map<Value>(visitor: MapVisitor<Value, Entries, Key>): Value[]

  entries(): IterableIterator<[string, Object]>

  values(): IterableIterator<Object>

  [Symbol.iterator](): IterableIterator<Object>

  toObject(): Entries

  get<K extends Key>(key: K): Entries[K]

  get(key: keyof FieldLookup | number): any

  has(key: any): key is Key
}

export default Record

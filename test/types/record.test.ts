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

import Record from '../../types/record'

const record1 = new Record(['name', 'age'], ['Alice', 20])
const record2 = new Record(['name', 'age'], ['Bob', 22], { key: 'value' })
const isRecord1: boolean = record1 instanceof Record
const isRecord2: boolean = record2 instanceof Record

const record1Keys: string[] = record1.keys
const record1Length: number = record1.length

const record1Object: object = record1.toObject()

record1.forEach(() => {})

record1.forEach((value: any) => {})

record1.forEach((value: any, key: string) => {})

record1.forEach((value: any, key: string, record: Record) => {})

const record1Entries: IterableIterator<[string, any]> = record1.entries()
const record2Entries: IterableIterator<[string, any]> = record2.entries()

const record1Values: IterableIterator<any> = record1.values()
const record2Values: IterableIterator<any> = record2.values()

const record1ToArray: any[] = [...record1]
const record2ToArray: any[] = [...record2]

const record1Has: boolean = record1.has(42)
const record2Has: boolean = record1.has('key')

const record1Get1: any = record1.get(42)
const record2Get1: any = record2.get('key')

const record1Get2: object = record1.get(42)
const record2Get2: string[] = record2.get('key')

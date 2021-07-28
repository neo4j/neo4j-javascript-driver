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

import { Record } from 'neo4j-driver-core'

interface Person {
  name: string
  age: number
}

const record1 = new Record(['name', 'age'], ['Alice', 20])
const record2 = new Record(['name', 'age'], ['Bob', 22], { firstName: 0 })
const record3: Record<Person> = new Record<Person>(['name', 'age'], ['Carl', 24])

const isRecord1: boolean = record1 instanceof Record
const isRecord2: boolean = record2 instanceof Record
const isRecord3: boolean = record3 instanceof Record

const record1Keys: string[] = record1.keys
const record3Keys: Array<keyof Person> = record3.keys
const record1Length: number = record1.length

const record1Object: object = record1.toObject()
const record3Object: Person = record3.toObject()

record1.forEach(() => {})

record1.forEach((value: any) => {})

record1.forEach((value: any, key: string) => {})

record1.forEach((value: any, key: string, record: Record) => {})

record3.forEach(
  (value: string | number, key: 'name' | 'age', record: Record<Person>) => {}
)

const record3Mapped: [
  string | number,
  'name' | 'age',
  Record<Person>
][] = record3.map((...args) => args)

const record1Entries: IterableIterator<[string, any]> = record1.entries()
const record2Entries: IterableIterator<[string, any]> = record2.entries()

const record1Values: IterableIterator<any> = record1.values()
const record2Values: IterableIterator<any> = record2.values()

const record1ToArray: any[] = [...record1]
const record2ToArray: any[] = [...record2]

const record1Has: boolean = record1.has(42)
const record2Has: boolean = record1.has('key')

const record1Get1: any = record1.get('name')
const record2Get1: any = record2.get('age')

const record1Get2: object = record1.get('name')
const record2Get2: string[] = record2.get('age')

const record3Get1: string = record3.get('name')
const record3Get2: number = record3.get('age')

const record2Get3: string = record2.get('firstName')
const record2Get4: number = record2.get(1)

// @ts-expect-error
const record2Get5: any = record2.get('does-not-exist')

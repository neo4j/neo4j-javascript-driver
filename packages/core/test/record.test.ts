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

import { newError } from '../src'
import Record from '../src/record'

describe('Record', () => {
  it('should allow getting fields by name', () => {
    // Given
    const record = new Record(['name'], ['Bob'])

    // When & Then
    expect(record.get('name')).toEqual('Bob')
  })

  it('should allow checking if fields exist', () => {
    // Given
    const record = new Record(['name'], ['Bob'])

    // When & Then
    expect(record.has('name')).toEqual(true)
    expect(record.has('invalid key')).toEqual(false)
    expect(record.has(0)).toEqual(true)
    expect(record.has(1)).toEqual(false)
  })

  it('should transform Record into Object', () => {
    // Given
    const record = new Record(
      ['name', 'age', 'nested'],
      ['Bob', 20.5, { test: true }]
    )

    // When
    const obj = record.toObject()

    // Then
    expect(obj.name).toEqual('Bob')
    expect(obj.age).toEqual(20.5)
    expect(obj.nested.test).toEqual(true)
  })

  it('should give helpful error on no such key', () => {
    // Given
    const record = new Record(['name'], ['Bob'])

    // When & Then
    expect(() => {
      record.get('age')
    }).toThrow(
      newError(
        "This record has no field with key 'age', available key are: [name]."
      )
    )
  })

  it('should allow getting fields by index', () => {
    // Given
    const record = new Record(['name'], ['Bob'])

    // When & Then
    expect(record.get(0)).toEqual('Bob')
  })

  it('should give helpful error on no such index', () => {
    // Given
    const record = new Record(['name'], ['Bob'])

    // When & Then
    expect(() => {
      record.get(1)
    }).toThrow(
      newError(
        "This record has no field with index '1'. Remember that indexes start at `0`, " +
          'and make sure your query returns records in the shape you meant it to.'
      )
    )
  })

  it('should have length', () => {
    // When & Then
    expect(new Record([], []).length).toBe(0)
    expect(new Record(['name'], ['Bob']).length).toBe(1)
    expect(new Record(['name', 'age'], ['Bob', 45]).length).toBe(2)
  })

  it('should allow forEach through the record', () => {
    // Given
    const record = new Record(['name', 'age'], ['Bob', 45])
    const result: [any, string, Record][] = []

    // When
    record.forEach((value, key, record) => {
      result.push([value, key, record])
    })

    // Then
    expect(result).toEqual([
      ['Bob', 'name', record],
      [45, 'age', record]
    ])
  })

  it('should allow map function for the record', () => {
    // Given
    const record = new Record(['name', 'age'], ['Bob', 45])

    // When
    const result = record.map((value, key, rec) => {
      return [value, key, rec]
    })

    // Then
    expect(result).toEqual([
      ['Bob', 'name', record],
      [45, 'age', record]
    ])
  })

  it('should allow taking values lazily', () => {
    // Given
    const record = new Record(['name', 'age'], ['Bob', 45])
    const values = record.values()

    // When
    const first = values.next()
    const second = values.next()
    const third = values.next()

    // Then
    expect(first.value).toEqual('Bob')
    expect(first.done).toBeFalsy()
    expect(second.value).toEqual(45)
    expect(second.done).toBeFalsy()
    expect(third.value).toBeUndefined()
    expect(third.done).toBeTruthy()
  })

  it('should allow taking key-value pairs lazily', () => {
    // Given
    const record = new Record(['name', 'age'], ['Bob', 45])
    const entries = record.entries()

    // When
    const first = entries.next()
    const second = entries.next()
    const third = entries.next()

    // Then
    expect(first.value).toEqual(['name', 'Bob'])
    expect(first.done).toBeFalsy()
    expect(second.value).toEqual(['age', 45])
    expect(second.done).toBeFalsy()
    expect(third.value).toBeUndefined()
    expect(third.done).toBeTruthy()
  })

  it('should allow directly creating array from record', () => {
    // Given
    const record = new Record(['name', 'age'], ['Bob', 45])

    // When
    const values = Array.from(record)

    // Then
    expect(values).toEqual(['Bob', 45])
  })

  it('should allow iterating over values using for..of loop', () => {
    // Given
    const record = new Record(['name', 'age'], ['Bob', 45])
    const values = []

    // When
    for (const value of record) {
      values.push(value)
    }

    // Then
    expect(values).toEqual(['Bob', 45])
  })
})

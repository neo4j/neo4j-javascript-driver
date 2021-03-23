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
import Integer, { int } from '../../src/integer'
import {
  isEmptyObjectOrNull,
  isObject,
  isString,
  assertObject,
  assertString,
  assertNumber,
  assertNumberOrInteger,
  assertValidDate,
  validateQueryAndParameters,
  ENCRYPTION_ON,
  ENCRYPTION_OFF
} from '../../src/internal/util'

/* eslint-disable no-new-wrappers */
describe('Util', () => {
  test.each([null, {}])(
    'should isEmptyObjectOrNull(%s) toBeTruthy',
    (obj?: any) => expect(isEmptyObjectOrNull(obj)).toBeTruthy()
  )

  test.each([
    () => 42,
    undefined,
    0,
    [[]],
    [],
    '',
    'abc',
    { foo: 'bar ' }
  ])('should isEmptyObjectOrNull(%s) toBeFalsy', (obj?: any) =>
    expect(isEmptyObjectOrNull(obj)).toBeFalsy()
  )

  test.each([
    {},
    { key1: 1, key2: '2' },
    new Integer()
  ])('should isObject(%s) toBeTruthy', (obj?: any) =>
    expect(isObject(obj)).toBeTruthy()
  )

  test.each([
    42,
    [],
    [[]],
    () => 'Hello',
    'string'
  ])('should isObject(%s) toBeFalsy', (obj?: any) =>
    expect(isObject(obj)).toBeFalsy()
  )

  test.each([
    'a',
    String('abc'),
    new String()
  ])('should isString(%s) toBeTruthy', (obj?: any) =>
    expect(isString(obj)).toBeTruthy()
  )

  test.each([
    42,
    [],
    [[]],
    () => 'Hello',
    {},
    { key: 'string' }
  ])('should isString(%s) toBeFalsy', (obj?: any) =>
    expect(isString(obj)).toBeFalsy()
  )

  test.each([
    {},
    { key1: 1, key2: '2' },
    Integer.fromValue(123)
  ])('should assertObject(%s) toBe itself', (obj?: any) =>
    expect(assertObject(obj, 'Object Name')).toBe(obj)
  )

  test.each([
    42,
    [],
    [[]],
    () => 'Hello',
    'string'
  ])('should assertObject(%s) toThrowError TypeError', (obj?: any) =>
    expect(() => assertObject(obj, 'Object Name')).toThrowError(TypeError)
  )

  test.each([
    '',
    'hi!',
    new String('foo'),
    String('foo')
  ])('should assertString(%s) toBe itself', (obj?: any) =>
    expect(assertString(obj, 'Object Name')).toEqual(obj)
  )

  test.each([
    42,
    [],
    [[]],
    () => 'Hello',
    console.log,
    ['1']
  ])('should assertString(%s) toThrowError TypeError', (obj?: any) =>
    expect(() => assertString(obj, 'Object Name')).toThrowError(TypeError)
  )

  test.each([
    0,
    1,
    42,
    -42,
    12.001,
    -493.432
  ])('should assertNumber(%s) toBe itself', (obj?: any) =>
    expect(assertNumber(obj, 'Object Name')).toEqual(obj)
  )

  test.each([
    int(1),
    int(42),
    '',
    '42',
    [],
    [42],
    undefined,
    {},
    { value: 42 }
  ])('should assertNumber(%s) toThrowError TypeError', (obj?: any) =>
    expect(() => assertNumber(obj, 'Object Name')).toThrowError(TypeError)
  )

  test.each([
    int(1),
    int(42),
    int(-123),
    0,
    1,
    42,
    -42,
    12.001,
    -493.432
  ])('should assertNumberOrInteger(%s) toBe itself', (obj?: any) =>
    expect(assertNumberOrInteger(obj, 'Object Name')).toEqual(obj)
  )

  test.each([
    '',
    '42',
    [],
    [42],
    undefined,
    {},
    { value: 42 }
  ])('should assertNumberOrInteger(%s) toThrowError TypeError', (obj?: any) =>
    expect(() => assertNumberOrInteger(obj, 'Object Name')).toThrowError(
      TypeError
    )
  )

  test.each([
    new Date(),
    new Date(0),
    new Date(1),
    new Date(-1),
    new Date(2000, 10, 10),
    new Date(2010, 10, 10, 10, 10, 10, 10)
  ])('should assertValidDate(%s) toBe itself', (obj?: any) =>
    expect(assertValidDate(obj, 'Object Name')).toEqual(obj)
  )

  test.each([
    new Date('not a valid date'),
    {},
    [],
    null,
    undefined,
    2019,
    '2007-04-05T12:30-02:00'
  ])('should assertValidDate(%s) toThrowError TypeError', (obj?: any) =>
    expect(() => assertValidDate(obj, 'Object Name')).toThrowError(TypeError)
  )

  test.each([
    [new String('foo'), undefined, { validatedQuery: 'foo', params: {} }],
    [new String('foo'), null, { validatedQuery: 'foo', params: {} }],
    [new String('foo'), {}, { validatedQuery: 'foo', params: {} }],
    [
      new String('foo'),
      { key: 'a' },
      { validatedQuery: 'foo', params: { key: 'a' } }
    ],
    ['foo', { key: 'a' }, { validatedQuery: 'foo', params: { key: 'a' } }],
    [
      { text: 'some text', parameters: { key: 'b' } },
      { key: 'a' },
      { validatedQuery: 'some text', params: { key: 'b' } }
    ]
  ])(
    'should validateQueryAndParameters(%s, %s) toEqual %s',
    (query, parameters, expectedValue) =>
      expect(validateQueryAndParameters(query, parameters)).toEqual(
        expectedValue
      )
  )

  test.each([
    ['', {}],
    ['\n', {}],
    ['\t', {}],
    ['   ', {}],
    ['\n\r', {}],
    ['', {}],
    [{ text: '\n' }, {}],
    [{ text: '   ' }, {}],
    [{ text: 'abc', parameters: 'abc' }, {}],
    ['abc', 'abc'],
    ['abc', []],
    ['abc', new Array('abc')]
  ])(
    'should validateQueryAndParameters(%s, %s) toThrowError TypeError',
    (query, parameters) =>
      expect(() => validateQueryAndParameters(query, parameters)).toThrowError(
        TypeError
      )
  )

  test('should ENCRYPTION_ON toBe "ENCRYPTION_ON"', () =>
    expect(ENCRYPTION_ON).toBe('ENCRYPTION_ON'))
  test('should ENCRYPTION_OFF toBe "ENCRYPTION_OFF"', () =>
    expect(ENCRYPTION_OFF).toBe('ENCRYPTION_OFF'))
})

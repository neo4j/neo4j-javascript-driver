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
import Integer, {
  int,
  isInt,
  toNumber,
  toString,
  inSafeRange
} from '../src/integer'
import { newError } from '../src/error'

describe('Integer', () => {
  forEachToNumberOrInfinityScenarios(({ input, expectedOutput }) =>
    test(`int(${input}).toNumberOrInfinity() toEqual ${expectedOutput}`, () =>
      expect(int(input).toNumberOrInfinity()).toEqual(expectedOutput))
  )

  forEachToNumberScenarios(({ input, expectedOutput }) =>
    test(`int(${input}).toNumber() toEqual ${expectedOutput}`, () =>
      expect(int(input).toNumber()).toEqual(expectedOutput))
  )

  forEachInSafeRangeScenarios(({ input, expectedOutput }) =>
    test(`Integer(${input}).inSafeRange() toEqual ${expectedOutput}`, () =>
      expect(input.inSafeRange()).toEqual(expectedOutput))
  )

  forEachToIntScenarios(({ input, expectedOutput }) =>
    test(`Integer(${input}).toInt() toEqual ${expectedOutput}`, () =>
      expect(input.toInt()).toEqual(expectedOutput))
  )

  forEachToStringScenarios(({ input: { integer, radix }, expectedOutput }) =>
    test(`Integer(${integer}).toString(${radix}) toEqual ${expectedOutput}`, () =>
      expect(integer.toString(radix)).toEqual(expectedOutput))
  )

  forEachGetHighBitsScenarios(({ input, expectedOutput }) =>
    test(`Integer(${input}).getHighBits() toEqual ${expectedOutput}`, () =>
      expect(input.getHighBits()).toEqual(expectedOutput))
  )

  forEachGetLowBitsScenarios(({ input, expectedOutput }) =>
    test(`Integer(${input}).getLowBits() toEqual ${expectedOutput}`, () =>
      expect(input.getLowBits()).toEqual(expectedOutput))
  )

  forEachGetNumBitsAbsScenarios(({ input, expectedOutput }) =>
    test(`Integer(${input}).getNumBitsAbs() toEqual ${expectedOutput}`, () =>
      expect(input.getNumBitsAbs()).toEqual(expectedOutput))
  )

  forEachIsZeroScenarios(({ input, expectedOutput }) =>
    test(`Integer(${input}).isZero() toEqual ${expectedOutput}`, () =>
      expect(input.isZero()).toEqual(expectedOutput))
  )

  forEachIsNegativeScenarios(({ input, expectedOutput }) =>
    test(`Integer(${input}).isNegative() toEqual ${expectedOutput}`, () =>
      expect(input.isNegative()).toEqual(expectedOutput))
  )

  forEachIsNegativeScenarios(({ input, expectedOutput }) =>
    test(`Integer(${input}).isPositive() toEqual ${!expectedOutput}`, () =>
      expect(input.isPositive()).toEqual(!expectedOutput))
  )

  forEachIsOddScenarios(({ input, expectedOutput }) =>
    test(`Integer(${input}).isOdd() toEqual ${expectedOutput}`, () =>
      expect(input.isOdd()).toEqual(expectedOutput))
  )

  forEachIsOddScenarios(({ input, expectedOutput }) =>
    test(`Integer(${input}).isEven() toEqual ${!expectedOutput}`, () =>
      expect(input.isEven()).toEqual(!expectedOutput))
  )

  forEachEqualsScenarios(({ input, expectedOutput }) =>
    test(`Integer(${input.integer}).equals(${input.other}) toEqual ${expectedOutput}`, () =>
      expect(input.integer.equals(input.other)).toEqual(expectedOutput))
  )

  forEachEqualsScenarios(({ input, expectedOutput }) =>
    test(`Integer(${input.integer}).notEquals(${
      input.other
    }) toEqual ${!expectedOutput}`, () =>
      expect(input.integer.notEquals(input.other)).toEqual(!expectedOutput))
  )

  forEachLessThanScenarios(({ input, expectedOutput }) =>
    test(`Integer(${input.integer}).lessThan(${input.other}) toEqual ${expectedOutput}`, () =>
      expect(input.integer.lessThan(input.other)).toEqual(expectedOutput))
  )

  forEachLessThanScenarios(({ input, expectedOutput }) =>
    test(`Integer(${input.integer}).greaterThanOrEqual(${
      input.other
    }) toEqual ${!expectedOutput}`, () =>
      expect(input.integer.greaterThanOrEqual(input.other)).toEqual(
        !expectedOutput
      ))
  )

  forEachLessOrEqualThanScenarios(({ input, expectedOutput }) =>
    test(`Integer(${input.integer}).lessThanOrEqual(${input.other}) toEqual ${expectedOutput}`, () =>
      expect(input.integer.lessThanOrEqual(input.other)).toEqual(
        expectedOutput
      ))
  )

  forEachLessOrEqualThanScenarios(({ input, expectedOutput }) =>
    test(`Integer(${input.integer}).greaterThan(${
      input.other
    }) toEqual ${!expectedOutput}`, () =>
      expect(input.integer.greaterThan(input.other)).toEqual(!expectedOutput))
  )

  forEachNegateScenarios(({ input, expectedOutput }) =>
    test(`Integer(${input}).negate() toEqual ${expectedOutput}`, () =>
      expect(input.negate()).toEqual(expectedOutput))
  )

  forEachAddScenarios(({ input, expectedOutput }) =>
    test(`Integer(${input.integer}).add(${input.other}) toEqual ${expectedOutput}`, () =>
      expect(input.integer.add(input.other)).toEqual(expectedOutput))
  )

  forEachSubtractScenarios(({ input, expectedOutput }) =>
    test(`Integer(${input.integer}).subtract(${input.other}) toEqual ${expectedOutput}`, () =>
      expect(input.integer.subtract(input.other)).toEqual(expectedOutput))
  )

  forEachMultiplyScenarios(({ input, expectedOutput }) =>
    test(`Integer(${input.integer}).multiply(${input.other}) toEqual ${expectedOutput}`, () =>
      expect(input.integer.multiply(input.other)).toEqual(expectedOutput))
  )

  forEachDivScenarios(({ input, expectedOutput }) =>
    test(`Integer(${input.integer}).div(${input.other}) toEqual ${expectedOutput}`, () =>
      expect(input.integer.div(input.other)).toEqual(expectedOutput))
  )

  test('Integer(124).div(0) toThrow Neo4jError(message: "division by zero")', () =>
    expect(() => Integer.fromValue('124').div(0)).toThrow(
      newError('division by zero')
    ))

  forEachModuloScenarios(({ input: { dividend, divisor }, expectedOutput }) =>
    test(`Integer(${dividend}).modulo(${divisor}) toEqual ${expectedOutput}`, () =>
      expect(dividend.modulo(divisor)).toEqual(expectedOutput))
  )

  test('Integer(124).modulo(0) toThrow Neo4jError(message: "division by zero")', () =>
    expect(() => Integer.fromValue('124').modulo(0)).toThrow(
      newError('division by zero')
    ))

  forEachNotScenario(({ input, expectedOutput }) =>
    test(`Integer(${input}).not() to equal ${expectedOutput}`, () =>
      expect(input.not()).toEqual(expectedOutput))
  )

  forEachAndScenario(({ input: { integer, other }, expectedOutput }) =>
    test(`Integer(${integer}).and(${other}) toEqual ${expectedOutput}`, () =>
      expect(integer.and(other)).toEqual(expectedOutput))
  )

  forEachOrScenario(({ input: { integer, other }, expectedOutput }) =>
    test(`Integer(${integer}).or(${other}) toEqual ${expectedOutput}`, () =>
      expect(integer.or(other)).toEqual(expectedOutput))
  )

  forEachXorScenario(({ input: { integer, other }, expectedOutput }) =>
    test(`Integer(${integer}).xor(${other}) toEqual ${expectedOutput}`, () =>
      expect(integer.xor(other)).toEqual(expectedOutput))
  )

  forEachShiftLeftScenario(({ input: { integer, numBits }, expectedOutput }) =>
    test(`Integer(${integer}).shiftLetft(${numBits}) toEqual ${expectedOutput}`, () =>
      expect(integer.shiftLeft(numBits)).toEqual(expectedOutput))
  )

  forEachShiftRightScenario(({ input: { integer, numBits }, expectedOutput }) =>
    test(`Integer(${integer}).shiftRight(${numBits}) toEqual ${expectedOutput}`, () =>
      expect(integer.shiftRight(numBits)).toEqual(expectedOutput))
  )

  forEachIsIntegerScenario(({ input, expectedOutput }) =>
    test(`Integer.isInteger(${typeof input}(${input})) toEqual ${expectedOutput}`, () =>
      expect(Integer.isInteger(input)).toEqual(expectedOutput))
  )

  forEachIsIntegerScenario(({ input, expectedOutput }) =>
    test(`isInt(${typeof input}(${input})) toEqual ${expectedOutput}`, () =>
      expect(isInt(input)).toEqual(expectedOutput))
  )

  forEachFromIntScenarios(({ input, expectedOutput }) =>
    test(`Integer.fromInt(${input}) toEqual ${expectedOutput}`, () =>
      expect(Integer.fromInt(input)).toEqual(expectedOutput))
  )

  forEachFromBitsScenarios(({ input, expectedOutput }) =>
    test(`Integer.fromBits(${input.lowBits}, ${input.highBits}) toEqual ${expectedOutput}`, () =>
      expect(Integer.fromBits(input.lowBits, input.highBits)).toEqual(
        expectedOutput
      ))
  )

  forEachFromNumberScenarios(({ input, expectedOutput }) =>
    test(`Integer.fromNumber(${input}) toEqual ${expectedOutput}`, () =>
      expect(Integer.fromNumber(input)).toEqual(expectedOutput))
  )

  forEachFromStringScenarios(({ input, expectedOutput }) =>
    test(`Integer.fromString(${input.str}, ${input.str}) toEqual ${expectedOutput}`, () =>
      expect(Integer.fromString(input.str, input.radix)).toEqual(
        expectedOutput
      ))
  )

  test('Integer.fromString("") toThrow Neo4jError(message: "number format error: empty string")', () =>
    expect(() => Integer.fromString('')).toThrow(
      newError('number format error: empty string')
    ))

  test('Integer.fromString("123", 1) toThrow Neo4jError(message: "radix out of range: 1")', () =>
    expect(() => Integer.fromString('123', 1)).toThrow(
      newError('radix out of range: 1')
    ))

  test('Integer.fromString("123", 37) toThrow Neo4jError(message: "radix out of range: 37")', () =>
    expect(() => Integer.fromString('123', 37)).toThrow(
      newError('radix out of range: 37')
    ))

  test('Integer.fromString("123-2") toThrow Neo4jError(message: "number format error: interior "-" character: 123-2")', () =>
    expect(() => Integer.fromString('123-2')).toThrow(
      newError('number format error: interior "-" character: 123-2')
    ))

  forEachFromValueScenarios(({ input, expectedOutput }) =>
    test(`Integer.fromValue(${input}) toEqual ${expectedOutput}`, () =>
      expect(Integer.fromValue(input)).toEqual(expectedOutput))
  )

  forEachFromValueScenarios(({ input, expectedOutput }) =>
    test(`int(${input}) toEqual ${expectedOutput}`, () =>
      expect(int(input)).toEqual(expectedOutput))
  )

  forEachStaticToNumberScenarios(({ input, expectedOutput }) =>
    test(`Integer.toNumber(${input}) toEqual ${expectedOutput}`, () =>
      expect(Integer.toNumber(input)).toEqual(expectedOutput))
  )

  forEachStaticToNumberScenarios(({ input, expectedOutput }) =>
    test(`toNumber(${input}) toEqual ${expectedOutput}`, () =>
      expect(toNumber(input)).toEqual(expectedOutput))
  )

  forEachStaticToStringScenarios(({ input, expectedOutput }) =>
    test(`Integer.toString(${input}) toEqual ${expectedOutput}`, () =>
      expect(Integer.toString(input)).toEqual(expectedOutput))
  )

  test("Integer.toString(20, 1) toThrow RangeError('radix out of range: 1')", () =>
    expect(() => Integer.toString(Integer.fromValue(20), 1)).toThrow(
      new RangeError('radix out of range: 1')
    ))

  test("Integer.toString(20, 45) toThrow RangeError('radix out of range: 45')", () =>
    expect(() => Integer.toString(Integer.fromValue(20), 45)).toThrow(
      new RangeError('radix out of range: 45')
    ))

  forEachStaticToStringScenarios(({ input, expectedOutput }) =>
    test(`toString(${input}) toEqual ${expectedOutput}`, () =>
      expect(toString(input)).toEqual(expectedOutput))
  )

  forEachStaticInSafeRangeScenarios(({ input, expectedOutput }) =>
    test(`inSafeRange(${input}) toEqual ${expectedOutput}`, () =>
      expect(inSafeRange(input)).toEqual(expectedOutput))
  )

  test('Integer.toBigInt', () => {
    expect(Integer.MAX_SAFE_VALUE.toBigInt().toString()).toEqual(
      Integer.MAX_SAFE_VALUE.toString()
    )
  })
})

function forEachToNumberOrInfinityScenarios(
  func: Consumer<AssertionPair<number | string, number>>
) {
  ;[
    v('42', 42),
    v('4242', 4242),
    v('-999', -999),
    v('1000000000', 1000000000),
    v(1000000000, 1000000000),
    v(Integer.MIN_SAFE_VALUE.toString(), Integer.MIN_SAFE_VALUE.toNumber()),
    v(Integer.MAX_SAFE_VALUE.toString(), Integer.MAX_SAFE_VALUE.toNumber()),
    v(Integer.MIN_SAFE_VALUE.subtract(1).toString(), Number.NEGATIVE_INFINITY),
    v(
      Integer.MIN_SAFE_VALUE.subtract(340).toString(),
      Number.NEGATIVE_INFINITY
    ),
    v(Integer.MAX_SAFE_VALUE.add(1).toString(), Number.POSITIVE_INFINITY),
    v(Integer.MAX_SAFE_VALUE.add(340).toString(), Number.POSITIVE_INFINITY)
  ].forEach(func)
}

function forEachToNumberScenarios(
  func: Consumer<AssertionPair<number | string | bigint, number>>
) {
  ;[
    v('42', 42),
    v('4242', 4242),
    v('-999', -999),
    v('1000000000', 1000000000),
    v(1000000000, 1000000000),
    v(BigInt(42), 42),
    v(Integer.MIN_SAFE_VALUE.toString(), Integer.MIN_SAFE_VALUE.toNumber()),
    v(Integer.MAX_SAFE_VALUE.toString(), Integer.MAX_SAFE_VALUE.toNumber()),
    v(
      Integer.MIN_SAFE_VALUE.subtract(1).toString(),
      Integer.MIN_SAFE_VALUE.toNumber() - 1
    ),
    v(
      Integer.MIN_SAFE_VALUE.subtract(340).toString(),
      Integer.MIN_SAFE_VALUE.toNumber() - 340
    ),
    v(
      Integer.MAX_SAFE_VALUE.add(1).toString(),
      Integer.MAX_SAFE_VALUE.toNumber() + 1
    ),
    v(
      Integer.MAX_SAFE_VALUE.add(340).toString(),
      Integer.MAX_SAFE_VALUE.toNumber() + 340
    )
  ].forEach(func)
}

function forEachInSafeRangeScenarios(
  func: Consumer<AssertionPair<Integer, boolean>>
) {
  ;[
    v(int('42'), true),
    v(int('4242'), true),
    v(int('-999'), true),
    v(Integer.MIN_SAFE_VALUE, true),
    v(Integer.MAX_SAFE_VALUE, true),
    v(Integer.MIN_SAFE_VALUE.subtract(1), false),
    v(Integer.MIN_SAFE_VALUE.subtract(340), false),
    v(Integer.MAX_SAFE_VALUE.add(1), false),
    v(Integer.MAX_SAFE_VALUE.add(340), false)
  ].forEach(func)
}

function forEachToIntScenarios(func: Consumer<AssertionPair<Integer, number>>) {
  ;[
    v(new Integer(), 0),
    v(new Integer(13), 13),
    v(new Integer(42, 13), 42),
    v(new Integer(-10), -10),
    v(new Integer(-15, 43), -15)
  ].forEach(func)
}

function forEachToStringScenarios(
  func: Consumer<AssertionPair<{ integer: Integer; radix?: number }, string>>
) {
  function i(
    integer: Integer,
    radix?: number
  ): { integer: Integer; radix?: number } {
    return { integer, radix }
  }

  ;[
    v(i(int('5'), 10), '5'),
    v(i(int('-5'), 10), '-5'),
    v(i(int('12'), 10), '12'),
    v(i(int('12'), 16), 'c'),
    v(i(int('12'), 2), '1100'),
    v(i(int('-12'), 10), '-12'),
    v(i(int('-12'), 16), '-c'),
    v(i(int('-12'), 2), '-1100'),
    v(i(int('12')), '12'),
    v(i(int('-12')), '-12'),
    v(i(int('0')), '0'),
    v(i(int('0'), 2), '0'),
    v(i(int('0'), 36), '0'),
    v(i(Integer.MIN_VALUE, 10), '-9223372036854775808'),
    v(
      i(Integer.MIN_VALUE, 2),
      '-1000000000000000000000000000000000000000000000000000000000000000'
    ),
    v(i(Integer.MIN_VALUE, 16), '-8000000000000000'),
    v(i(Integer.MAX_VALUE, 10), '9223372036854775807'),
    v(
      i(Integer.MAX_VALUE, 2),
      '111111111111111111111111111111111111111111111111111111111111111'
    ),
    v(i(Integer.MAX_VALUE, 16), '7fffffffffffffff')
  ].forEach(func)
}

function forEachGetHighBitsScenarios(
  func: Consumer<AssertionPair<Integer, number>>
) {
  ;[
    v(new Integer(), 0),
    v(new Integer(123), 0),
    v(new Integer(123, 124), 124),
    v(new Integer(-123, 124), 124),
    v(new Integer(123, -124), -124),
    v(new Integer(-123, -124), -124)
  ].forEach(func)
}

function forEachGetLowBitsScenarios(
  func: Consumer<AssertionPair<Integer, number>>
) {
  ;[
    v(new Integer(), 0),
    v(new Integer(123), 123),
    v(new Integer(123, 124), 123),
    v(new Integer(-123, 124), -123),
    v(new Integer(123, -124), 123),
    v(new Integer(-123, -124), -123)
  ].forEach(func)
}

function forEachGetNumBitsAbsScenarios(
  func: Consumer<AssertionPair<Integer, number>>
) {
  ;[
    v(Integer.MIN_VALUE, 64),
    v(Integer.MAX_VALUE, 63),
    v(Integer.MAX_VALUE.div(2), 62),
    v(Integer.MAX_VALUE.div(4), 61),
    v(Integer.MAX_VALUE.div(32), 58),
    v(Integer.fromValue(0b11010101010), 11),
    v(Integer.fromValue(0), 1)
  ].forEach(func)
}

function forEachIsZeroScenarios(
  func: Consumer<AssertionPair<Integer, boolean>>
) {
  ;[
    v(Integer.MIN_VALUE, false),
    v(Integer.MAX_VALUE, false),
    v(new Integer(0, 1), false),
    v(new Integer(1, 0), false),
    v(new Integer(1, 1), false),
    v(new Integer(0, 0), true),
    v(Integer.fromValue(0), true)
  ].forEach(func)
}

function forEachIsNegativeScenarios(
  func: Consumer<AssertionPair<Integer, boolean>>
) {
  ;[
    v(Integer.MIN_VALUE, true),
    v(Integer.MAX_VALUE, false),
    v(Integer.fromValue(1244), false),
    v(Integer.fromValue(-1244), true),
    v(new Integer(0, 1), false),
    v(new Integer(1, 0), false),
    v(new Integer(1, 1), false),
    v(new Integer(0, 0), false),
    v(Integer.fromValue(0), false)
  ].forEach(func)
}

function forEachIsOddScenarios(
  func: Consumer<AssertionPair<Integer, boolean>>
) {
  ;[
    v(Integer.fromValue(1), true),
    v(Integer.fromValue(-1), true),
    v(Integer.fromValue(3), true),
    v(Integer.fromValue(389178191919911), true),
    v(Integer.fromValue(389178191919910), false),
    v(Integer.fromValue(-389178191919911), true),
    v(Integer.fromValue(0), false),
    v(Integer.MAX_VALUE, true),
    v(Integer.MIN_VALUE, false)
  ].forEach(func)
}

function forEachEqualsScenarios(
  func: Consumer<AssertionPair<{ integer: Integer; other: Interable }, boolean>>
) {
  function i(
    integer: Integer,
    other: Interable
  ): { integer: Integer; other: Interable } {
    return { integer, other }
  }
  ;[
    v(i(Integer.ZERO, 0), true),
    v(i(Integer.ZERO, '0'), true),
    v(i(Integer.ZERO, { low: 0, high: 0 }), true),
    v(i(Integer.ZERO, Integer.ZERO), true),
    v(i(Integer.ZERO, Integer.ONE), false),
    v(i(Integer.MAX_VALUE, Integer.MAX_VALUE), true),
    v(i(Integer.MIN_VALUE, Integer.MIN_VALUE), true),
    v(i(Integer.MAX_VALUE, Integer.MIN_VALUE), false)
  ].forEach(func)
}

function forEachLessThanScenarios(
  func: Consumer<AssertionPair<{ integer: Integer; other: Interable }, boolean>>
) {
  function i(
    integer: Integer,
    other: Interable
  ): { integer: Integer; other: Interable } {
    return { integer, other }
  }
  ;[
    v(i(Integer.ZERO, 1), true),
    v(i(Integer.ZERO, 0), false),
    v(i(Integer.ZERO, -1), false),
    v(i(Integer.ZERO, '1'), true),
    v(i(Integer.ZERO, '0'), false),
    v(i(Integer.ZERO, '-1'), false),
    v(i(Integer.MAX_VALUE, '-1'), false),
    v(i(Integer.MIN_VALUE, '-1'), true),
    v(i(Integer.MIN_VALUE, Integer.ZERO), true),
    v(i(Integer.MIN_VALUE, Integer.MAX_VALUE), true),
    v(i(Integer.MIN_VALUE, Integer.MIN_SAFE_VALUE), true),
    v(i(Integer.MIN_VALUE, Integer.MIN_VALUE), false),
    v(i(Integer.MAX_VALUE, Integer.MAX_VALUE), false),
    v(i(Integer.MAX_VALUE, Integer.MAX_SAFE_VALUE), false),
    v(i(Integer.MAX_VALUE, Integer.MIN_SAFE_VALUE), false),
    v(i(Integer.MAX_VALUE, Integer.MIN_SAFE_VALUE), false)
  ].forEach(func)
}

function forEachLessOrEqualThanScenarios(
  func: Consumer<AssertionPair<{ integer: Integer; other: Interable }, boolean>>
) {
  function i(
    integer: Integer,
    other: Interable
  ): { integer: Integer; other: Interable } {
    return { integer, other }
  }
  ;[
    v(i(Integer.ZERO, 1), true),
    v(i(Integer.ZERO, 0), true),
    v(i(Integer.ZERO, -1), false),
    v(i(Integer.ZERO, '1'), true),
    v(i(Integer.ZERO, '0'), true),
    v(i(Integer.ZERO, '-1'), false),
    v(i(Integer.MAX_VALUE, '-1'), false),
    v(i(Integer.MIN_VALUE, '-1'), true),
    v(i(Integer.MIN_VALUE, Integer.ZERO), true),
    v(i(Integer.MIN_VALUE, Integer.MAX_VALUE), true),
    v(i(Integer.MIN_VALUE, Integer.MIN_SAFE_VALUE), true),
    v(i(Integer.MIN_VALUE, Integer.MIN_VALUE), true),
    v(i(Integer.MAX_VALUE, Integer.MAX_VALUE), true),
    v(i(Integer.MAX_VALUE, Integer.MAX_SAFE_VALUE), false),
    v(i(Integer.MAX_VALUE, Integer.MIN_SAFE_VALUE), false),
    v(i(Integer.MAX_VALUE, Integer.MIN_SAFE_VALUE), false)
  ].forEach(func)
}

function forEachNegateScenarios(
  func: Consumer<AssertionPair<Integer, Integer>>
) {
  ;[
    v(Integer.fromValue(1), Integer.fromNumber(-1)),
    v(Integer.fromValue(-1), Integer.fromNumber(1)),
    v(Integer.fromValue(3), Integer.fromNumber(-3)),
    v(Integer.fromValue(389178191919911), Integer.fromNumber(-389178191919911)),
    v(Integer.fromValue(389178191919910), Integer.fromNumber(-389178191919910)),
    v(Integer.fromValue(-389178191919911), Integer.fromNumber(389178191919911)),
    v(Integer.fromValue(0), Integer.ZERO),
    v(Integer.MIN_VALUE, Integer.MIN_VALUE)
  ].forEach(func)
}

function forEachAddScenarios(
  func: Consumer<AssertionPair<{ integer: Integer; other: Interable }, Integer>>
) {
  function i(
    integer: Integer,
    other: Interable
  ): { integer: Integer; other: Interable } {
    return { integer, other }
  }
  ;[
    v(i(Integer.ZERO, 1), Integer.ONE),
    v(i(Integer.ZERO, 0), Integer.ZERO),
    v(i(Integer.ZERO, -1), Integer.NEG_ONE),
    v(i(Integer.ZERO, '1'), Integer.ONE),
    v(i(Integer.ZERO, '0'), Integer.ZERO),
    v(i(Integer.ZERO, '-1'), Integer.NEG_ONE),
    v(i(Integer.MAX_VALUE, '-1'), Integer.MAX_VALUE.subtract(1)),
    v(i(Integer.MIN_VALUE, '-1'), Integer.MIN_VALUE.subtract(1)),
    v(i(Integer.MIN_VALUE, Integer.MAX_VALUE), Integer.NEG_ONE),
    v(i(Integer.MAX_VALUE, Integer.MIN_VALUE), Integer.NEG_ONE)
  ].forEach(func)
}

function forEachSubtractScenarios(
  func: Consumer<AssertionPair<{ integer: Integer; other: Interable }, Integer>>
) {
  function i(
    integer: Integer,
    other: Interable
  ): { integer: Integer; other: Interable } {
    return { integer, other }
  }
  ;[
    v(i(Integer.ZERO, 1), Integer.NEG_ONE),
    v(i(Integer.ZERO, 0), Integer.ZERO),
    v(i(Integer.ZERO, -1), Integer.ONE),
    v(i(Integer.ZERO, '1'), Integer.NEG_ONE),
    v(i(Integer.ZERO, '0'), Integer.ZERO),
    v(i(Integer.ZERO, '-1'), Integer.ONE),
    v(i(Integer.MAX_VALUE, '1'), Integer.MAX_VALUE.add(-1)),
    v(i(Integer.MIN_VALUE, '1'), Integer.MIN_VALUE.add(-1)),
    v(i(Integer.MIN_VALUE, Integer.MAX_VALUE), Integer.ONE),
    v(i(Integer.MAX_VALUE, Integer.MIN_VALUE), Integer.NEG_ONE)
  ].forEach(func)
}

function forEachMultiplyScenarios(
  func: Consumer<AssertionPair<{ integer: Integer; other: Interable }, Integer>>
) {
  function i(
    integer: Integer,
    other: Interable
  ): { integer: Integer; other: Interable } {
    return { integer, other }
  }
  ;[
    v(i(Integer.ZERO, Integer.MAX_VALUE), Integer.ZERO),
    v(i(Integer.ZERO, 0), Integer.ZERO),
    v(i(Integer.ZERO, Integer.MIN_VALUE), Integer.ZERO),
    v(i(Integer.MAX_VALUE, '0'), Integer.ZERO),
    v(i(Integer.MIN_VALUE, 0), Integer.ZERO),
    v(i(Integer.MIN_VALUE, Integer.ZERO), Integer.ZERO),
    v(i(Integer.NEG_ONE, Integer.ONE), Integer.NEG_ONE),
    v(i(Integer.ONE, Integer.NEG_ONE), Integer.NEG_ONE),
    v(i(Integer.ONE, Integer.ONE), Integer.ONE),
    v(i(Integer.NEG_ONE, Integer.NEG_ONE), Integer.ONE),
    v(i(Integer.MIN_VALUE, 3), Integer.MIN_VALUE), // Why diference between odd and even?
    v(i(Integer.MIN_VALUE, 2), Integer.ZERO),
    v(i(Integer.ONE.add(2), Integer.MIN_VALUE), Integer.MIN_VALUE), // Why diference between odd and even?
    v(i(Integer.ONE.add(1), Integer.MIN_VALUE), Integer.ZERO),
    v(i(Integer.MAX_VALUE.subtract(1).div(2), 2), Integer.MAX_VALUE.subtract(1))
  ].forEach(func)
}

function forEachDivScenarios(
  func: Consumer<AssertionPair<{ integer: Integer; other: Interable }, Integer>>
) {
  function i(
    integer: Integer,
    other: Interable
  ): { integer: Integer; other: Interable } {
    return { integer, other }
  }
  ;[
    v(i(Integer.ZERO, Integer.MAX_VALUE), Integer.ZERO),
    v(i(Integer.ZERO, Integer.MIN_VALUE), Integer.ZERO),
    v(i(Integer.ZERO, 1234), Integer.ZERO),
    v(i(Integer.ZERO, -123), Integer.ZERO),
    v(i(Integer.ZERO, '123'), Integer.ZERO),
    v(i(Integer.ZERO, '-123'), Integer.ZERO),
    v(i(Integer.MIN_VALUE, Integer.ONE), Integer.MIN_VALUE),
    v(i(Integer.MIN_VALUE, Integer.NEG_ONE), Integer.MIN_VALUE),
    v(i(Integer.MIN_VALUE, Integer.MIN_VALUE), Integer.ONE),
    v(i(Integer.MIN_VALUE, Integer.MIN_VALUE.div(2)), Integer.ONE.add(1)),
    v(i(Integer.ONE, Integer.MIN_VALUE), Integer.ZERO),
    v(i(Integer.fromValue('-4'), -2), Integer.fromNumber(2)),
    v(i(Integer.fromValue('-4'), 2), Integer.fromNumber(-2)),
    v(i(Integer.fromValue(4), -2), Integer.fromNumber(-2)),
    v(i(Integer.MAX_VALUE, 2), Integer.fromBits(-1, 1073741823))
  ].forEach(func)
}

function forEachModuloScenarios(
  func: Consumer<
    AssertionPair<
      { dividend: Integer; divisor: number | string | Integer },
      Integer
    >
  >
) {
  function d(
    dividend: Integer,
    divisor: number | string | Integer
  ): { dividend: Integer; divisor: number | string | Integer } {
    return { dividend, divisor }
  }

  ;[
    v(d(Integer.MIN_VALUE, Integer.MIN_VALUE), Integer.ZERO),
    v(d(Integer.MAX_VALUE, Integer.MAX_VALUE), Integer.ZERO),
    v(d(Integer.MAX_VALUE, Integer.MAX_VALUE.toString()), Integer.ZERO),
    v(d(Integer.MAX_VALUE, Integer.MAX_VALUE.toNumber()), Integer.ZERO),
    v(d(Integer.MIN_VALUE, Integer.MIN_VALUE.toNumber()), Integer.ZERO),
    v(d(Integer.MIN_VALUE, Integer.MIN_VALUE.toString()), Integer.ZERO),
    v(d(Integer.MIN_VALUE, 2), Integer.ZERO),
    v(d(Integer.MAX_VALUE, 2), Integer.ONE),
    v(d(Integer.MIN_VALUE, 3), Integer.fromInt(-2)),
    v(d(Integer.MIN_VALUE, -3), Integer.fromInt(-2)),
    v(d(Integer.MAX_VALUE, 3), Integer.ONE),
    v(d(Integer.ZERO, 3), Integer.ZERO)
  ].forEach(func)
}

function forEachNotScenario(func: Consumer<AssertionPair<Integer, Integer>>) {
  ;[
    v(
      Integer.MIN_VALUE,
      Integer.fromBits(~Integer.MIN_VALUE.low, ~Integer.MIN_VALUE.high)
    ),
    v(
      Integer.MAX_VALUE,
      Integer.fromBits(~Integer.MAX_VALUE.low, ~Integer.MAX_VALUE.high)
    ),
    v(Integer.fromNumber(12), Integer.fromNumber(-13)),
    v(Integer.fromNumber(55), Integer.fromNumber(-56)),
    v(Integer.fromNumber(590000201), Integer.fromNumber(-590000202)),
    v(Integer.ZERO.not(), Integer.ZERO.not().not())
  ].forEach(func)
}

function forEachAndScenario(
  func: Consumer<
    AssertionPair<
      { integer: Integer; other: Integer | number | string },
      Integer
    >
  >
) {
  function a(
    integer: Integer,
    other: Integer | number | string
  ): { integer: Integer; other: Integer | number | string } {
    return { integer, other }
  }

  ;[
    v(a(Integer.fromNumber(0b101010), 0b010101), Integer.fromNumber(0b000000)),
    v(a(Integer.fromNumber(0b101010), 0b100101), Integer.fromNumber(0b100000)),
    v(a(Integer.fromNumber(0b101010), '21'), Integer.fromNumber(0b000000)),
    v(a(Integer.fromNumber(0b101010), '37'), Integer.fromNumber(0b100000)),
    v(a(Integer.MAX_VALUE, 0), Integer.ZERO),
    v(a(Integer.MIN_VALUE, 0), Integer.ZERO),
    v(a(Integer.MAX_VALUE, Integer.MAX_VALUE), Integer.MAX_VALUE),
    v(a(Integer.MIN_VALUE, Integer.MIN_VALUE), Integer.MIN_VALUE)
  ].forEach(func)
}

function forEachOrScenario(
  func: Consumer<
    AssertionPair<
      { integer: Integer; other: Integer | number | string },
      Integer
    >
  >
) {
  function a(
    integer: Integer,
    other: Integer | number | string
  ): { integer: Integer; other: Integer | number | string } {
    return { integer, other }
  }

  ;[
    v(a(Integer.fromNumber(0b101010), 0b010101), Integer.fromNumber(0b111111)),
    v(a(Integer.fromNumber(0b101010), 0b100101), Integer.fromNumber(0b101111)),
    v(a(Integer.fromNumber(0b101010), '21'), Integer.fromNumber(0b111111)),
    v(a(Integer.fromNumber(0b101010), '37'), Integer.fromNumber(0b101111)),
    v(a(Integer.MAX_VALUE, 0), Integer.MAX_VALUE),
    v(a(Integer.MIN_VALUE, 0), Integer.MIN_VALUE),
    v(a(Integer.MAX_VALUE, Integer.MAX_VALUE), Integer.MAX_VALUE),
    v(a(Integer.MIN_VALUE, Integer.MIN_VALUE), Integer.MIN_VALUE)
  ].forEach(func)
}

function forEachXorScenario(
  func: Consumer<
    AssertionPair<
      { integer: Integer; other: Integer | number | string },
      Integer
    >
  >
) {
  function a(
    integer: Integer,
    other: Integer | number | string
  ): { integer: Integer; other: Integer | number | string } {
    return { integer, other }
  }

  ;[
    v(a(Integer.fromNumber(0b101010), 0b010101), Integer.fromNumber(0b111111)),
    v(a(Integer.fromNumber(0b101010), 0b100101), Integer.fromNumber(0b001111)),
    v(a(Integer.fromNumber(0b101010), '21'), Integer.fromNumber(0b111111)),
    v(a(Integer.fromNumber(0b101010), '37'), Integer.fromNumber(0b001111)),
    v(a(Integer.MAX_VALUE, 0), Integer.MAX_VALUE),
    v(a(Integer.MIN_VALUE, 0), Integer.MIN_VALUE),
    v(a(Integer.MAX_VALUE, Integer.MAX_VALUE), Integer.ZERO),
    v(a(Integer.MIN_VALUE, Integer.MIN_VALUE), Integer.ZERO)
  ].forEach(func)
}

function forEachShiftLeftScenario(
  func: Consumer<
    AssertionPair<{ integer: Integer; numBits: Integer | number }, Integer>
  >
) {
  function s(
    integer: Integer,
    numBits: Integer | number
  ): { integer: Integer; numBits: Integer | number } {
    return { integer, numBits }
  }

  ;[
    v(s(Integer.fromNumber(0b101010), 1), Integer.fromNumber(0b1010100)),
    v(s(Integer.fromNumber(0b101010), 5), Integer.fromNumber(0b10101000000)),
    v(s(Integer.MAX_VALUE, 64), Integer.ZERO),
    v(s(Integer.MIN_VALUE, 64), Integer.ZERO),
    v(s(Integer.MAX_VALUE, 32), Integer.fromBits(0, Integer.MAX_VALUE.low)),
    v(s(Integer.MIN_VALUE, 32), Integer.fromBits(0, Integer.MIN_VALUE.low)),
    v(s(Integer.ZERO, 15), Integer.ZERO)
  ].forEach(func)
}

function forEachShiftRightScenario(
  func: Consumer<
    AssertionPair<{ integer: Integer; numBits: Integer | number }, Integer>
  >
) {
  function s(
    integer: Integer,
    numBits: Integer | number
  ): { integer: Integer; numBits: Integer | number } {
    return { integer, numBits }
  }

  ;[
    v(s(Integer.fromNumber(0b101010), 1), Integer.fromNumber(0b10101)),
    v(s(Integer.fromNumber(0b101010), 5), Integer.fromNumber(0b1)),
    v(s(Integer.MAX_VALUE, 64), Integer.ZERO),
    v(s(Integer.MIN_VALUE, 64), Integer.ZERO),
    v(s(Integer.MAX_VALUE, 32), Integer.fromBits(Integer.MAX_VALUE.high, 0)),
    v(s(Integer.MIN_VALUE, 32), Integer.fromBits(Integer.MIN_VALUE.high, -1)),
    v(s(Integer.ZERO, 15), Integer.ZERO)
  ].forEach(func)
}

function forEachIsIntegerScenario(func: Consumer<AssertionPair<any, boolean>>) {
  ;[
    v('42', false),
    v(42, false),
    v(Integer.fromNumber(42), true),
    v(Integer.fromInt(42), true),
    v(Integer.fromBits(42, 55), true),
    v(Integer.fromString('33'), true),
    v(Integer.fromValue('33'), true),
    v(new Integer(1, 2), true),
    v(Integer.MAX_VALUE, true),
    v(Integer.MIN_VALUE, true),
    v(Integer.MAX_SAFE_VALUE, true),
    v(Integer.MIN_SAFE_VALUE, true),
    v(Integer.ZERO, true),
    v(Integer.ONE, true),
    v(Integer.NEG_ONE, true)
  ].forEach(func)
}

function forEachFromIntScenarios(
  func: Consumer<AssertionPair<number, Integer>>
) {
  ;[
    v(-128, new Integer(-128, -1)),
    v(127, new Integer(127, 0)),
    v(0, Integer.ZERO),
    v(2147483647, new Integer(2147483647, 0)),
    v(-2147483648, new Integer(-2147483648, -1))
  ].forEach(func)
}

function forEachFromBitsScenarios(
  func: Consumer<AssertionPair<{ lowBits: number; highBits: number }, Integer>>
) {
  function b(
    lowBits: number,
    highBits: number
  ): { lowBits: number; highBits: number } {
    return { lowBits, highBits }
  }

  ;[
    v(b(123, 456), new Integer(123, 456)),
    v(b(0, 456), new Integer(0, 456)),
    v(b(123, 0), new Integer(123, 0))
  ].forEach(func)
}

function forEachFromNumberScenarios(
  func: Consumer<AssertionPair<number, Integer>>
) {
  const TWO_PWR_63: number = 9223372036854776000
  ;[
    v(-128, new Integer(-128, -1)),
    v(127, new Integer(127, 0)),
    v(0, Integer.ZERO),
    v(2147483647, new Integer(2147483647, 0)),
    v(-2147483648, new Integer(-2147483648, -1)),
    v(NaN, Integer.ZERO),
    v(Number.POSITIVE_INFINITY, Integer.ZERO),
    v(Number.NEGATIVE_INFINITY, Integer.ZERO),
    v(-TWO_PWR_63, Integer.MIN_VALUE),
    v(TWO_PWR_63, Integer.MAX_VALUE)
  ].forEach(func)
}

function forEachFromStringScenarios(
  func: Consumer<AssertionPair<{ str: string; radix?: number }, Integer>>
) {
  function i(str: string, radix?: number): { str: string; radix?: number } {
    return { str, radix }
  }

  ;[
    v(i('5', 10), new Integer(5)),
    v(i('-5', 10), new Integer(-5, -1)),
    v(i('12', 10), new Integer(12)),
    v(i('c', 16), new Integer(12)),
    v(i('1100', 2), new Integer(12)),
    v(i('-12', 10), new Integer(-12, -1)),
    v(i('-c', 16), new Integer(-12, -1)),
    v(i('-1100', 2), new Integer(-12, -1)),
    v(i('-12'), new Integer(-12, -1)),
    v(i('12'), new Integer(12)),
    v(i('0'), Integer.ZERO),
    v(i('0', 2), Integer.ZERO),
    v(i('0', 10), Integer.ZERO),
    v(i('0', 32), Integer.ZERO),
    v(i('-9223372036854775808', 10), Integer.MIN_VALUE),
    v(
      i('-1000000000000000000000000000000000000000000000000000000000000000', 2),
      Integer.MIN_VALUE
    ),
    v(i('-8000000000000000', 16), Integer.MIN_VALUE),
    v(i('9223372036854775807', 10), Integer.MAX_VALUE),
    v(
      i('111111111111111111111111111111111111111111111111111111111111111', 2),
      Integer.MAX_VALUE
    ),
    v(i('7fffffffffffffff', 16), Integer.MAX_VALUE),
    v(i('NaN'), Integer.ZERO),
    v(i('Infinity'), Integer.ZERO),
    v(i('+Infinity'), Integer.ZERO),
    v(i('-Infinity'), Integer.ZERO)
  ].forEach(func)
}

type Interable =
  | Integer
  | number
  | { low: number; high: number }
  | string
  | bigint
function forEachFromValueScenarios(
  func: Consumer<AssertionPair<Interable, Integer>>
) {
  ;[
    v(Integer.ONE, Integer.ONE),
    v('1', Integer.ONE),
    v(1, Integer.ONE),
    v({ low: 1, high: 0 }, Integer.ONE)
  ].forEach(func)
}

function forEachStaticToNumberScenarios(
  func: Consumer<AssertionPair<Interable, number>>
) {
  ;[
    v(Integer.ONE, 1),
    v('1', 1),
    v(1, 1),
    v({ low: 1, high: 0 }, 1),
    v(BigInt(10), 10)
  ].forEach(func)
}

function forEachStaticToStringScenarios(
  func: Consumer<AssertionPair<Interable, string>>
) {
  ;[
    v(Integer.ONE, '1'),
    v('1', '1'),
    v(1, '1'),
    v({ low: 1, high: 0 }, '1')
  ].forEach(func)
}

function forEachStaticInSafeRangeScenarios(
  func: Consumer<AssertionPair<Interable, boolean>>
) {
  ;[
    v(Integer.ONE, true),
    v('1', true),
    v(1, true),
    v({ low: 1, high: 0 }, true),
    v(Integer.MAX_VALUE, false),
    v(Integer.MIN_VALUE, false),
    v(99999191919191919191, false),
    v('99999191919191919191', false),
    v({ low: 99999999181818811818, high: 191919111111991919 }, false)
  ].forEach(func)
}

interface AssertionPair<I, O> {
  input: I
  expectedOutput: O
}

interface Consumer<I> {
  (i: I): void
}

function v<I, O>(input: I, expectedOutput: O): AssertionPair<I, O> {
  return { input, expectedOutput }
}

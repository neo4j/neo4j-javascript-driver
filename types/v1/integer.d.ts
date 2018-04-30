/**
 * Copyright (c) 2002-2018 Neo4j Sweden AB [http://neo4j.com]
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

declare class Integer {
  low: number;
  high: number;

  constructor(low?: number, high?: number)

  inSafeRange(): boolean;

  toInt(): number;

  toNumber(): number;

  toString(radix: number): string;

  getHighBits(): number;

  getLowBits(): number;

  getNumBitsAbs(): number;

  isZero(): boolean;

  isNegative(): boolean;

  isPositive(): boolean;

  isOdd(): boolean;

  isEven(): boolean;

  equals(other: Integer | number | string): boolean;

  notEquals(other: Integer | number | string): boolean;

  lessThan(other: Integer | number | string): boolean;

  lessThanOrEqual(other: Integer | number | string): boolean;

  greaterThan(other: Integer | number | string): boolean;

  greaterThanOrEqual(other: Integer | number | string): boolean;

  compare(other: Integer | number | string): number;

  negate(): Integer;

  add(addend: Integer | number | string): Integer;

  subtract(subtrahend: Integer | number | string): Integer;

  multiply(multiplier: Integer | number | string): Integer;

  div(divisor: Integer | number | string): Integer;

  modulo(divisor: Integer | number | string): Integer;

  not(): Integer;

  and(other: Integer | number | string): Integer;

  or(other: Integer | number | string): Integer;

  xor(other: Integer | number | string): Integer;

  shiftLeft(numBits: Integer | number): Integer;

  shiftRight(numBits: Integer | number): Integer;

  static __isInteger__: true;

  static isInteger(obj: object): boolean;

  static fromInt(value: number): Integer;

  static fromNumber(value: number): Integer;

  static fromBits(lowBits: number, highBits: number): Integer;

  static fromString(str: string, radix?: number): Integer;

  static fromValue(value: Integer | number | string | { low: number, high: number }): Integer;

  static toNumber(value: Integer | number | string | { low: number, high: number }): number;

  static toString(value: Integer | number | string | { low: number, high: number }, radix?: number): string;

  static inSafeRange(value: Integer | number | string | { low: number, high: number }): boolean;

  static ZERO: Integer;
  static ONE: Integer;
  static NEG_ONE: Integer;
  static MAX_VALUE: Integer;
  static MIN_VALUE: Integer;
  static MIN_SAFE_VALUE: Integer;
  static MAX_SAFE_VALUE: Integer;
}

declare function int(value: Integer | number | string | { low: number, high: number }): Integer;

declare function isInt(obj: object): boolean;

declare function inSafeRange(val: Integer | number | string | { low: number, high: number }): boolean;

declare function toNumber(val: Integer | number | string | { low: number, high: number }): number;

declare function toString(val: Integer | number | string | { low: number, high: number }, radix?: number): string;

export {
  int,
  isInt,
  inSafeRange,
  toNumber,
  toString
}

export default Integer;

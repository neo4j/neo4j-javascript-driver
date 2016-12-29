import { newError } from "./error";

declare class Integer {
  low: number;
  high: number;

  constructor( low: number, high: number )

  inSafeRange(): boolean;

  toInt(): number;

  toNumber(): number;

  toString(): string;

  getHighBits(): number;

  getLowBits(): number;

  getNumBitsAbs(): number;

  isZero(): boolean;

  isNegative(): boolean;

  isPositive(): boolean;

  isOdd(): boolean;

  isEven(): boolean;

  equals( other: Integer | number | string ): boolean;

  notEquals( other: Integer | number | string ): boolean;

  lessThan( other: Integer | number | string ): boolean;

  lessThanOrEqual( other: Integer | number | string ): boolean;

  greaterThan( other: Integer | number | string ): boolean;

  greaterThanOrEqual( other: Integer | number | string ): boolean;

  compare( other: Integer | number | string ): number;

  negate(): Integer;

  add( addend: Integer | number | string ): Integer;

  subtract( subtrahend: Integer | number | string ): Integer;

  multiply( multiplier: Integer | number | string ): Integer;

  div( divisor: Integer | number | string ): Integer;

  modulo( divisor: Integer | number | string ): Integer;

  not(): Integer;

  and( other: Integer | number | string ): Integer;

  or( other: Integer | number | string ): Integer;

  xor( other: Integer | number | string ): Integer;

  shiftLeft( numBits: Integer | number ): Integer;

  shiftRight( numBits: Integer | number ): Integer;

  static __isInteger__: true;

  static isInteger(obj: Object): boolean;

  static fromInt(value: number): Integer;
  static fromNumber(value: number): Integer;
  static fromBits(lowBits: number, highBits: number): Integer;
  static fromString(str: string, radix?: number): Integer;
  static fromValue(val: Integer | number | string | {low: number, high: number}): Integer;
  static toNumber(val: Integer | number | string | {low: number, high: number}): number;
  static toString(val: Integer | number | string | {low: number, high: number}, radix?: number): Integer;
  static inSafeRange(val: Integer | number | string | {low: number, high: number}): boolean;

  static ZERO: Integer;
  static ONE: Integer;
  static NEG_ONE: Integer;
  static MAX_VALUE: Integer;
  static MIN_VALUE: Integer;
  static MIN_SAFE_VALUE: Integer;
  static MAX_SAFE_VALUE: Integer;
}

declare function int(val: Integer | number | string | {low: number, high: number}): Integer;
declare function isInt(obj: Object): boolean;
declare function inSafeRange(val: Integer | number | string | {low: number, high: number}): boolean;
declare function toNumber(val: Integer | number | string | {low: number, high: number}): number;
declare function toString(val: Integer | number | string | {low: number, high: number}, radix?: number): Integer;

declare type TWO_PWR_16_DBL = number;
declare type TWO_PWR_24_DBL = number;
declare type TWO_PWR_32_DBL = number;
declare type TWO_PWR_64_DBL = number;
declare type TWO_PWR_63_DBL = number;
declare type TWO_PWR_24 = Integer;

declare type INT_CACHE = Object;

export {
  int,
  isInt,
  inSafeRange,
  toNumber,
  toString
}

export default Integer;

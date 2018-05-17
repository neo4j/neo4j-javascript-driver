/**
 * Copyright (c) 2002-2018 "Neo4j,"
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

import Integer, {inSafeRange, int, isInt, toNumber, toString} from "../../../types/v1/integer";

const int1 = new Integer();
const int2 = new Integer(1);
const int3 = new Integer(1, 2);

const high: number = int1.high;
const low: number = int1.low;

const safe: boolean = int1.inSafeRange();
if (safe) {
  const i: number = int1.toInt();
  console.log(i);

  const n: number = int1.toNumber();
  console.log(n)
}

const str: string = int2.toString(16);

const highBits: number = int3.getHighBits();
const lowBits: number = int3.getLowBits();
const numBitsAbs: number = int3.getNumBitsAbs();

const isZero: boolean = int1.isZero();
const isNegative: boolean = int1.isNegative();
const isPositive: boolean = int1.isPositive();
const isOdd: boolean = int1.isOdd();
const isEven: boolean = int1.isEven();

const eq1: boolean = int1.equals(int2);
const eq2: boolean = int1.equals(42);
const eq3: boolean = int1.equals("42");

const neq1: boolean = int1.notEquals(int2);
const neq2: boolean = int1.notEquals(42);
const neq3: boolean = int1.notEquals("42");

const lt1: boolean = int1.lessThan(int2);
const lt2: boolean = int1.lessThan(42);
const lt3: boolean = int1.lessThan("42");

const lte1: boolean = int1.lessThanOrEqual(int2);
const lte2: boolean = int1.lessThanOrEqual(42);
const lte3: boolean = int1.lessThanOrEqual("42");

const gt1: boolean = int1.greaterThan(int2);
const gt2: boolean = int1.greaterThan(42);
const gt3: boolean = int1.greaterThan("42");

const gte1: boolean = int1.greaterThanOrEqual(int2);
const gte2: boolean = int1.greaterThanOrEqual(42);
const gte3: boolean = int1.greaterThanOrEqual("42");

const cmp1: number = int2.compare(int3);
const cmp2: number = int2.compare(42);
const cmp3: number = int2.compare("42");

const negated: Integer = int3.negate();

const add1: Integer = int1.add(int2);
const add2: Integer = int1.add(42);
const add3: Integer = int1.add("42");

const subtract1: Integer = int1.subtract(int2);
const subtract2: Integer = int1.subtract(42);
const subtract3: Integer = int1.subtract("42");

const multiply1: Integer = int1.multiply(int2);
const multiply2: Integer = int1.multiply(42);
const multiply3: Integer = int1.multiply("42");

const div1: Integer = int1.div(int2);
const div2: Integer = int1.div(42);
const div3: Integer = int1.div("42");

const modulo1: Integer = int1.modulo(int2);
const modulo2: Integer = int1.modulo(42);
const modulo3: Integer = int1.modulo("42");

const not: Integer = int3.not();

const and1: Integer = int3.and(int2);
const and2: Integer = int3.and(42);
const and3: Integer = int3.and("42");

const or1: Integer = int3.or(int2);
const or2: Integer = int3.or(42);
const or3: Integer = int3.or("42");

const xor1: Integer = int3.xor(int2);
const xor2: Integer = int3.xor(42);
const xor3: Integer = int3.xor("42");

const shiftLeft: Integer = int2.shiftLeft(int1);
const shiftRight: Integer = int2.shiftRight(int1);

const isIntegerProp: boolean = Integer.__isInteger__;
const isInteger: boolean = Integer.isInteger({});

const fromInt: Integer = Integer.fromInt(42);
const fromNumber: Integer = Integer.fromNumber(42);
const fromBits: Integer = Integer.fromBits(1, 2);
const fromStr1: Integer = Integer.fromString("123");
const fromStr2: Integer = Integer.fromString("123", 10);

const fromValue1: Integer = Integer.fromValue(int1);
const fromValue2: Integer = Integer.fromValue(42);
const fromValue3: Integer = Integer.fromValue("42");
const fromValue4: Integer = Integer.fromValue({low: 1, high: 2});

const toNumber1: number = Integer.toNumber(int3);
const toNumber2: number = Integer.toNumber(42);
const toNumber3: number = Integer.toNumber("42");
const toNumber4: number = Integer.toNumber({low: 2, high: 1});

const toStr1: string = Integer.toString(int3);
const toStr2: string = Integer.toString(42);
const toStr3: string = Integer.toString("42");
const toStr4: string = Integer.toString({low: 1, high: 1});

const toStr5: string = Integer.toString(int3, 10);
const toStr6: string = Integer.toString(42, 2);
const toStr7: string = Integer.toString("42", 16);
const toStr8: string = Integer.toString({low: 1, high: 1}, 10);

const inSafeRange1: boolean = Integer.inSafeRange(int3);
const inSafeRange2: boolean = Integer.inSafeRange(42);
const inSafeRange3: boolean = Integer.inSafeRange("42");
const inSafeRange4: boolean = Integer.inSafeRange({low: 2, high: 2});

const zero: Integer = Integer.ZERO;
const one: Integer = Integer.ONE;
const negOne: Integer = Integer.NEG_ONE;
const max: Integer = Integer.MAX_VALUE;
const min: Integer = Integer.MIN_VALUE;
const minSafe: Integer = Integer.MIN_SAFE_VALUE;
const maxSafe: Integer = Integer.MAX_SAFE_VALUE;

const intFunc1: Integer = int(int1);
const intFunc2: Integer = int(42);
const intFunc3: Integer = int("42");
const intFunc4: Integer = int({low: 0, high: 1});

const isIntFunc: boolean = isInt({});

const inSafeRangeFunc1: boolean = inSafeRange(int2);
const inSafeRangeFunc2: boolean = inSafeRange(42);
const inSafeRangeFunc3: boolean = inSafeRange("42");
const inSafeRangeFunc4: boolean = inSafeRange({low: 1, high: 1});

const toNumberFunc1: number = toNumber(int3);
const toNumberFunc2: number = toNumber(42);
const toNumberFunc3: number = toNumber("42");
const toNumberFunc4: number = toNumber({low: 1, high: 1});

const toStringFunc1: string = toString(int3);
const toStringFunc2: string = toString(42);
const toStringFunc3: string = toString("42");
const toStringFunc4: string = toString({low: 1, high: 1});

const toStringFunc5: string = toString(int3, 2);
const toStringFunc6: string = toString(42, 2);
const toStringFunc7: string = toString("42", 10);
const toStringFunc8: string = toString({low: 1, high: 1}, 16);

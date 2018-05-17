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

import neo4j from '../../src/v1';
import Integer from '../../src/v1/integer';

const int = neo4j.int;
const integer = neo4j.integer;

describe('Integer', () => {

  it('exposes inSafeRange function', () => {
    expect(integer.inSafeRange(int('9007199254740991'))).toBeTruthy();
    expect(integer.inSafeRange(int('9007199254740992'))).toBeFalsy();
    expect(integer.inSafeRange(int('-9007199254740991'))).toBeTruthy();
    expect(integer.inSafeRange(int('-9007199254740992'))).toBeFalsy();
  });

  it('exposes toNumber function', () => {
    expect(integer.toNumber(int('9007199254740991'))).toEqual(9007199254740991);
    expect(integer.toNumber(int('-9007199254740991'))).toEqual(-9007199254740991);
  });

  it('exposes toString function', () => {
    expect(integer.toString(int('9007199254740991'))).toEqual('9007199254740991');
    expect(integer.toString(int('9007199254740992'))).toEqual('9007199254740992');
    expect(integer.toString(int('-9007199254740991'))).toEqual('-9007199254740991');
    expect(integer.toString(int('-9007199254740992'))).toEqual('-9007199254740992');
  });

  it('converts to number when safe', () => {
    expect(int('42').toNumberOrInfinity()).toEqual(42);
    expect(int('4242').toNumberOrInfinity()).toEqual(4242);
    expect(int('-999').toNumberOrInfinity()).toEqual(-999);
    expect(int('1000000000').toNumberOrInfinity()).toEqual(1000000000);
    expect(Integer.MIN_SAFE_VALUE.toNumberOrInfinity()).toEqual(Integer.MIN_SAFE_VALUE.toNumber());
    expect(Integer.MAX_SAFE_VALUE.toNumberOrInfinity()).toEqual(Integer.MAX_SAFE_VALUE.toNumber());
  });

  it('converts to negative infinity when too small', () => {
    expect(Integer.MIN_SAFE_VALUE.subtract(1).toNumberOrInfinity()).toEqual(Number.NEGATIVE_INFINITY);
    expect(Integer.MIN_SAFE_VALUE.subtract(42).toNumberOrInfinity()).toEqual(Number.NEGATIVE_INFINITY);
    expect(Integer.MIN_SAFE_VALUE.subtract(100).toNumberOrInfinity()).toEqual(Number.NEGATIVE_INFINITY);
  });

  it('converts to positive infinity when too large', () => {
    expect(Integer.MAX_SAFE_VALUE.add(1).toNumberOrInfinity()).toEqual(Number.POSITIVE_INFINITY);
    expect(Integer.MAX_SAFE_VALUE.add(24).toNumberOrInfinity()).toEqual(Number.POSITIVE_INFINITY);
    expect(Integer.MAX_SAFE_VALUE.add(999).toNumberOrInfinity()).toEqual(Number.POSITIVE_INFINITY);
  });

});

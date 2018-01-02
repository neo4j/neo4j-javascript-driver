/**
 * Copyright (c) 2002-2018 "Neo Technology,"
 * Network Engine for Objects in Lund AB [http://neotechnology.com]
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

var v1 = require('../../lib/v1');
var int = v1.int;
var integer = v1.integer;

describe('Pool', function() {
  it('exposes inSafeRange function', function () {
    expect(integer.inSafeRange(int("9007199254740991"))).toBeTruthy();
    expect(integer.inSafeRange(int("9007199254740992"))).toBeFalsy();
    expect(integer.inSafeRange(int("-9007199254740991"))).toBeTruthy();
    expect(integer.inSafeRange(int("-9007199254740992"))).toBeFalsy();
  });

  it('exposes toNumber function', function () {
    expect(integer.toNumber(int("9007199254740991"))).toEqual(9007199254740991);
    expect(integer.toNumber(int("-9007199254740991"))).toEqual(-9007199254740991);
  });

  it('exposes toString function', function () {
    expect(integer.toString(int("9007199254740991"))).toEqual("9007199254740991");
    expect(integer.toString(int("9007199254740992"))).toEqual("9007199254740992");
    expect(integer.toString(int("-9007199254740991"))).toEqual("-9007199254740991");
    expect(integer.toString(int("-9007199254740992"))).toEqual("-9007199254740992");
  });
});

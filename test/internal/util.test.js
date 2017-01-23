/**
 * Copyright (c) 2002-2017 "Neo Technology,","
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

const util = require('../../lib/v1/internal/util.js');

describe('util', () => {

  it('should check empty objects', () => {
    expect(util.isEmptyObjectOrNull(null)).toBeTruthy();
    expect(util.isEmptyObjectOrNull({})).toBeTruthy();
    expect(util.isEmptyObjectOrNull([])).toBeTruthy();

    const func = () => {
      return 42;
    };
    expect(util.isEmptyObjectOrNull(func)).toBeTruthy();
    func.foo = 'bar';
    expect(util.isEmptyObjectOrNull(func)).toBeFalsy();

    expect(util.isEmptyObjectOrNull()).toBeFalsy();
    expect(util.isEmptyObjectOrNull(undefined)).toBeFalsy();
    expect(util.isEmptyObjectOrNull(0)).toBeFalsy();
    expect(util.isEmptyObjectOrNull('')).toBeFalsy();
    expect(util.isEmptyObjectOrNull('abc')).toBeFalsy();
    expect(util.isEmptyObjectOrNull({foo: 'bar'})).toBeFalsy();
  });

  it('should check strings', () => {
    verifyValidString('');
    verifyValidString(new String('foo'));
    verifyValidString(String('foo'));
    verifyValidString("hi!");

    verifyInvalidString({});
    verifyInvalidString({foo: 1});
    verifyInvalidString([]);
    verifyInvalidString(['1']);
    verifyInvalidString([1, '2']);
    verifyInvalidString(console.log);
  });

  function verifyValidString(str) {
    expect(util.assertString(str, 'Test string')).toBe(str);
  }

  function verifyInvalidString(str) {
    expect(() => util.assertString(str, 'Test string')).toThrowError(TypeError);
  }

});

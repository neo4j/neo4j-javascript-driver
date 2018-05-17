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

import * as util from '../../src/v1/internal/util';

describe('util', () => {

  it('should check empty objects', () => {
    expect(util.isEmptyObjectOrNull(null)).toBeTruthy();
    expect(util.isEmptyObjectOrNull({})).toBeTruthy();

    expect(util.isEmptyObjectOrNull([])).toBeFalsy();

    const func = () => {
      return 42;
    };
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

  it('should check cypher statements (non-empty strings)', () => {
    verifyValidString(new String('foo'));
    verifyValidString(String('foo'));
    verifyValidString("foo");

    verifyInvalidCypherStatement('');
    verifyInvalidCypherStatement('\n');
    verifyInvalidCypherStatement('\t');
    verifyInvalidCypherStatement('\r');
    verifyInvalidCypherStatement('   ');
    verifyInvalidCypherStatement(' \n\r');
    verifyInvalidCypherStatement({});
    verifyInvalidCypherStatement({foo: 1});
    verifyInvalidCypherStatement([]);
    verifyInvalidCypherStatement(['1']);
    verifyInvalidCypherStatement([1, '2']);
    verifyInvalidCypherStatement(console.log);
  });

  it('should check valid query parameters', () => {
    verifyValidQueryParameters(null);
    verifyValidQueryParameters(undefined);
    verifyValidQueryParameters({});
    verifyValidQueryParameters({a: 1, b: 2, c: 3});
    verifyValidQueryParameters({foo: 'bar', baz: 'qux'});
  });

  it('should check invalid query parameters', () => {
    verifyInvalidQueryParameters('parameter');
    verifyInvalidQueryParameters(123);
    verifyInvalidQueryParameters([]);
    verifyInvalidQueryParameters([1, 2, 3]);
    verifyInvalidQueryParameters([null]);
    verifyInvalidQueryParameters(['1', '2', '3']);
    verifyInvalidQueryParameters(() => [1, 2, 3]);
    verifyInvalidQueryParameters(() => '');
    verifyInvalidQueryParameters(() => null);
  });

  function verifyValidString(str) {
    expect(util.assertString(str, 'Test string')).toBe(str);
  }

  function verifyInvalidString(str) {
    expect(() => util.assertString(str, 'Test string')).toThrowError(TypeError);
  }

  function verifyInvalidCypherStatement(str) {
    expect(() => util.validateStatementAndParameters(str, {})).toThrowError(TypeError);
  }

  function verifyValidQueryParameters(obj) {
    expect(() => util.validateStatementAndParameters('RETURN 1', obj)).not.toThrow();
  }

  function verifyInvalidQueryParameters(obj) {
    expect(() => util.validateStatementAndParameters('RETURN 1', obj)).toThrowError(TypeError);
  }

});

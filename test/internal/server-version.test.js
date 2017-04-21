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

import {ServerVersion, VERSION_3_2_0} from '../../src/v1/internal/server-version';

describe('ServerVersion', () => {

  it('should construct with correct values', () => {
    verifyVersion(new ServerVersion(2, 3, 10), 2, 3, 10);
    verifyVersion(new ServerVersion(3, 2, 0), 3, 2, 0);
    verifyVersion(new ServerVersion(1, 9, 12), 1, 9, 12);
  });

  it('should define correct 3.2.0 constant', () => {
    verifyVersion(VERSION_3_2_0, 3, 2, 0);
  });

  it('should parse "undefined" strings to 3.0.0 for backwards compatibility reasons', () => {
    verifyVersion(parse(null), 3, 0, 0);
    verifyVersion(parse(undefined), 3, 0, 0);
    verifyVersion(parse(''), 3, 0, 0);
  });

  it('should fail to parse object, array and function', () => {
    expect(() => parse({})).toThrowError(TypeError);
    expect(() => parse([])).toThrowError(TypeError);
    expect(() => parse(() => {
    })).toThrowError(TypeError);
  });

  it('should fail to parse illegal strings', () => {
    expect(() => parse('Cat')).toThrow();
    expect(() => parse('Dog')).toThrow();
    expect(() => parse('Neo4j')).toThrow();
    expect(() => parse('Neo4j/')).toThrow();
    expect(() => parse('Not-Neo4j/3.1.0')).toThrow();
    expect(() => parse('Neo4j/5')).toThrow();
    expect(() => parse('Neo4j/3.')).toThrow();
    expect(() => parse('Neo4j/1.A')).toThrow();
    expect(() => parse('Neo4j/1.Hello')).toThrow();
  });

  it('should parse valid version strings', () => {
    verifyVersion(parse('Neo4j/3.2.1'), 3, 2, 1);
    verifyVersion(parse('Neo4j/1.9.10'), 1, 9, 10);
    verifyVersion(parse('Neo4j/7.77.777'), 7, 77, 777);

    verifyVersion(parse('Neo4j/3.10.0-GA'), 3, 10, 0);
    verifyVersion(parse('Neo4j/2.5.5-RC01'), 2, 5, 5);
    verifyVersion(parse('Neo4j/3.1.1-SNAPSHOT'), 3, 1, 1);
    verifyVersion(parse('Neo4j/2.0.0-M09'), 2, 0, 0);

    verifyVersion(parse('Neo4j/3.2'), 3, 2, 0);
    verifyVersion(parse('Neo4j/1.5'), 1, 5, 0);
    verifyVersion(parse('Neo4j/42.42'), 42, 42, 0);

    verifyVersion(parse('Neo4j/2.2-GA'), 2, 2, 0);
    verifyVersion(parse('Neo4j/3.0-RC01'), 3, 0, 0);
    verifyVersion(parse('Neo4j/2.3-SNAPSHOT'), 2, 3, 0);
    verifyVersion(parse('Neo4j/2.2-M09'), 2, 2, 0);
  });

  it('should compare equal versions', () => {
    expect(new ServerVersion(3, 1, 0).compareTo(new ServerVersion(3, 1, 0))).toEqual(0);
    expect(new ServerVersion(1, 9, 12).compareTo(new ServerVersion(1, 9, 12))).toEqual(0);
    expect(new ServerVersion(2, 3, 8).compareTo(new ServerVersion(2, 3, 8))).toEqual(0);
  });

  it('should compare correctly by major', () => {
    expect(new ServerVersion(3, 1, 0).compareTo(new ServerVersion(2, 1, 0))).toBeGreaterThan(0);
    expect(new ServerVersion(2, 1, 0).compareTo(new ServerVersion(3, 1, 0))).toBeLessThan(0);

    expect(new ServerVersion(3, 1, 4).compareTo(new ServerVersion(1, 9, 10))).toBeGreaterThan(0);
    expect(new ServerVersion(1, 5, 42).compareTo(new ServerVersion(10, 10, 43))).toBeLessThan(0);
  });

  it('should compare correctly by minor', () => {
    expect(new ServerVersion(3, 3, 0).compareTo(new ServerVersion(3, 1, 0))).toBeGreaterThan(0);
    expect(new ServerVersion(1, 3, 5).compareTo(new ServerVersion(1, 9, 5))).toBeLessThan(0);

    expect(new ServerVersion(3, 9, 5).compareTo(new ServerVersion(3, 1, 2))).toBeGreaterThan(0);
    expect(new ServerVersion(1, 5, 42).compareTo(new ServerVersion(1, 10, 11))).toBeLessThan(0);
  });

  it('should compare correctly by patch', () => {
    expect(new ServerVersion(3, 3, 6).compareTo(new ServerVersion(3, 3, 5))).toBeGreaterThan(0);
    expect(new ServerVersion(1, 8, 2).compareTo(new ServerVersion(1, 8, 8))).toBeLessThan(0);
    expect(new ServerVersion(9, 9, 9).compareTo(new ServerVersion(9, 9, 0))).toBeGreaterThan(0);
    expect(new ServerVersion(3, 3, 3).compareTo(new ServerVersion(3, 3, 42))).toBeLessThan(0);
  });

});

function verifyVersion(serverVersion, expectedMajor, expectedMinor, expectedPatch) {
  expect(serverVersion.major).toEqual(expectedMajor);
  expect(serverVersion.minor).toEqual(expectedMinor);
  expect(serverVersion.patch).toEqual(expectedPatch);
}

function parse(string) {
  return ServerVersion.fromString(string);
}

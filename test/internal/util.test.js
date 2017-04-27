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

import * as util from '../../src/v1/internal/util';

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

  it('should parse scheme', () => {
    verifyScheme('bolt://', 'bolt://localhost');
    verifyScheme('bolt://', 'bolt://localhost:7687');
    verifyScheme('bolt://', 'bolt://neo4j.com');
    verifyScheme('bolt://', 'bolt://neo4j.com:80');

    verifyScheme('bolt+routing://', 'bolt+routing://127.0.0.1');
    verifyScheme('bolt+routing://', 'bolt+routing://127.0.0.1:7687');
    verifyScheme('bolt+routing://', 'bolt+routing://neo4j.com');
    verifyScheme('bolt+routing://', 'bolt+routing://neo4j.com:80');

    verifyScheme('wss://', 'wss://server.com');
    verifyScheme('wss://', 'wss://server.com:7687');
    verifyScheme('wss://', 'wss://1.1.1.1');
    verifyScheme('wss://', 'wss://8.8.8.8:80');

    verifyScheme('', 'invalid url');
    verifyScheme('', 'localhost:7676');
    verifyScheme('', '127.0.0.1');
  });

  it('should fail to parse scheme from non-string argument', () => {
    expect(() => util.parseScheme({})).toThrowError(TypeError);
    expect(() => util.parseScheme(['bolt://localhost:2020'])).toThrowError(TypeError);
    expect(() => util.parseScheme(() => 'bolt://localhost:8888')).toThrowError(TypeError);
  });

  it('should parse url', () => {
    verifyUrl('localhost', 'bolt://localhost');
    verifyUrl('localhost:9090', 'bolt://localhost:9090');
    verifyUrl('127.0.0.1', 'bolt://127.0.0.1');
    verifyUrl('127.0.0.1:7687', 'bolt://127.0.0.1:7687');
    verifyUrl('10.198.20.1', 'bolt+routing://10.198.20.1');
    verifyUrl('15.8.8.9:20004', 'wss://15.8.8.9:20004');
  });

  it('should fail to parse url from non-string argument', () => {
    expect(() => util.parseUrl({})).toThrowError(TypeError);
    expect(() => util.parseUrl(['bolt://localhost:2020'])).toThrowError(TypeError);
    expect(() => util.parseUrl(() => 'bolt://localhost:8888')).toThrowError(TypeError);
  });

  it('should parse host', () => {
    verifyHost('localhost', 'bolt://localhost');
    verifyHost('neo4j.com', 'bolt+routing://neo4j.com');
    verifyHost('neo4j.com', 'bolt+routing://neo4j.com:8080');
    verifyHost('127.0.0.1', 'https://127.0.0.1');
    verifyHost('127.0.0.1', 'ws://127.0.0.1:2020');
  });

  it('should fail to parse host from non-string argument', () => {
    expect(() => util.parseHost({})).toThrowError(TypeError);
    expect(() => util.parseHost(['bolt://localhost:2020'])).toThrowError(TypeError);
    expect(() => util.parseHost(() => 'bolt://localhost:8888')).toThrowError(TypeError);
  });

  it('should parse port', () => {
    verifyPort('7474', 'http://localhost:7474');
    verifyPort('8080', 'http://127.0.0.1:8080');
    verifyPort('20005', 'bolt+routing://neo4j.com:20005');
    verifyPort('4242', 'bolt+routing://1.1.1.1:4242');
    verifyPort('42', 'http://10.192.168.5:42');

    verifyPort(undefined, 'https://localhost');
    verifyPort(undefined, 'ws://8.8.8.8');
  });

  it('should fail to parse port from non-string argument', () => {
    expect(() => util.parsePort({port: 1515})).toThrowError(TypeError);
    expect(() => util.parsePort(['bolt://localhost:2020'])).toThrowError(TypeError);
    expect(() => util.parsePort(() => 'bolt://localhost:8888')).toThrowError(TypeError);
  });

  it('should parse routing context', () => {
    verifyRoutingContext({
      name: 'molly',
      age: '1',
      color: 'white'
    }, 'bolt+routing://localhost:7687/cat?name=molly&age=1&color=white');

    verifyRoutingContext({
      key1: 'value1',
      key2: 'value2'
    }, 'bolt+routing://localhost:7687/?key1=value1&key2=value2');

    verifyRoutingContext({key: 'value'}, 'bolt+routing://10.198.12.2:9999?key=value');

    verifyRoutingContext({}, 'bolt+routing://localhost:7687?');
    verifyRoutingContext({}, 'bolt+routing://localhost:7687/?');
    verifyRoutingContext({}, 'bolt+routing://localhost:7687/cat?');
    verifyRoutingContext({}, 'bolt+routing://localhost:7687/lala');
  });

  it('should fail to parse routing context from non-string argument', () => {
    expect(() => util.parseRoutingContext({key1: 'value1'})).toThrowError(TypeError);
    expect(() => util.parseRoutingContext(['bolt://localhost:2020/?key=value'])).toThrowError(TypeError);
    expect(() => util.parseRoutingContext(() => 'bolt://localhost?key1=value&key2=value2')).toThrowError(TypeError);
  });

  it('should fail to parse routing context from illegal parameters', () => {
    expect(() => util.parseRoutingContext('bolt+routing://localhost:7687/?justKey')).toThrow();
    expect(() => util.parseRoutingContext('bolt+routing://localhost:7687/?=value1&key2=value2')).toThrow();
    expect(() => util.parseRoutingContext('bolt+routing://localhost:7687/key1?=value1&key2=')).toThrow();
    expect(() => util.parseRoutingContext('bolt+routing://localhost:7687/?key1=value1&key2=value2&key1=value2')).toThrow();
  });

  function verifyValidString(str) {
    expect(util.assertString(str, 'Test string')).toBe(str);
  }

  function verifyInvalidString(str) {
    expect(() => util.assertString(str, 'Test string')).toThrowError(TypeError);
  }

  function verifyScheme(expectedScheme, url) {
    expect(util.parseScheme(url)).toEqual(expectedScheme);
  }

  function verifyUrl(expectedUrl, url) {
    expect(util.parseUrl(url)).toEqual(expectedUrl);
  }

  function verifyHost(expectedHost, url) {
    expect(util.parseHost(url)).toEqual(expectedHost);
  }

  function verifyPort(expectedPort, url) {
    expect(util.parsePort(url)).toEqual(expectedPort);
  }

  function verifyRoutingContext(expectedRoutingContext, url) {
    expect(util.parseRoutingContext(url)).toEqual(expectedRoutingContext);
  }

});

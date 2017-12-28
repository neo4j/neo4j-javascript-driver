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

import urlParser from '../../src/v1/internal/url';

fdescribe('url', () => {

  it('should parse URL with just host name', () => {
    verifyUrl('localhost', {
      host: 'localhost'
    });

    verifyUrl('neo4j.com', {
      host: 'neo4j.com'
    });

    verifyUrl('some-neo4j-server.com', {
      host: 'some-neo4j-server.com'
    });

    verifyUrl('ec2-34-242-76-91.eu-west-1.compute.aws.com', {
      host: 'ec2-34-242-76-91.eu-west-1.compute.aws.com'
    });
  });

  it('should parse URL with just IPv4 address', () => {
    verifyUrl('127.0.0.1', {
      host: '127.0.0.1'
    });

    verifyUrl('10.10.192.0', {
      host: '10.10.192.0'
    });

    verifyUrl('172.10.5.1', {
      host: '172.10.5.1'
    });

    verifyUrl('34.242.76.91', {
      host: '34.242.76.91'
    });
  });

  it('should parse URL with just IPv6 address', () => {
    verifyUrl('[::1]', {
      host: '[::1]'
    });

    verifyUrl('[ff02::2:ff00:0]', {
      host: '[ff02::2:ff00:0]'
    });

    verifyUrl('[1afc:0:a33:85a3::ff2f]', {
      host: '[1afc:0:a33:85a3::ff2f]'
    });

    verifyUrl('[ff0a::101]', {
      host: '[ff0a::101]'
    });

    verifyUrl('[2a05:d018:270:f400:6d8c:d425:c5f:97f3]', {
      host: '[2a05:d018:270:f400:6d8c:d425:c5f:97f3]'
    });
  });

  it('should parse URL with host name and query', () => {
    verifyUrl('localhost?key1=value1&key2=value2', {
      host: 'localhost',
      query: {key1: 'value1', key2: 'value2'}
    });

    verifyUrl('neo4j.com/?key1=1&key2=2', {
      host: 'neo4j.com',
      query: {key1: '1', key2: '2'}
    });

    verifyUrl('some-neo4j-server.com?a=value1&b=value2&c=value3', {
      host: 'some-neo4j-server.com',
      query: {a: 'value1', b: 'value2', c: 'value3'}
    });

    verifyUrl('ec2-34-242-76-91.eu-west-1.compute.aws.com/?foo=1&bar=2&baz=3&qux=4', {
      host: 'ec2-34-242-76-91.eu-west-1.compute.aws.com',
      query: {foo: '1', bar: '2', baz: '3', qux: '4'}
    });
  });

  it('should parse URL with IPv4 address and query', () => {
    verifyUrl('127.0.0.1?key1=value1&key2=value2', {
      host: '127.0.0.1',
      query: {key1: 'value1', key2: 'value2'}
    });

    verifyUrl('10.10.192.0?key1=1&key2=2', {
      host: '10.10.192.0',
      query: {key1: '1', key2: '2'}
    });

    verifyUrl('172.10.5.1?a=value1&b=value2&c=value3', {
      host: '172.10.5.1',
      query: {a: 'value1', b: 'value2', c: 'value3'}
    });

    verifyUrl('34.242.76.91/?foo=1&bar=2&baz=3&qux=4', {
      host: '34.242.76.91',
      query: {foo: '1', bar: '2', baz: '3', qux: '4'}
    });
  });

  it('should parse URL with IPv6 address and query', () => {
    verifyUrl('[::1]?key1=value1&key2=value2', {
      host: '[::1]',
      query: {key1: 'value1', key2: 'value2'}
    });

    verifyUrl('[ff02::2:ff00:0]?key1=1&key2=2', {
      host: '[ff02::2:ff00:0]',
      query: {key1: '1', key2: '2'}
    });

    verifyUrl('[1afc:0:a33:85a3::ff2f]/?a=value1&b=value2&c=value3', {
      host: '[1afc:0:a33:85a3::ff2f]',
      query: {a: 'value1', b: 'value2', c: 'value3'}
    });

    verifyUrl('[ff0a::101]/?foo=1&bar=2&baz=3&qux=4', {
      host: '[ff0a::101]',
      query: {foo: '1', bar: '2', baz: '3', qux: '4'}
    });

    verifyUrl('[2a05:d018:270:f400:6d8c:d425:c5f:97f3]?animal=apa', {
      host: '[2a05:d018:270:f400:6d8c:d425:c5f:97f3]',
      query: {animal: 'apa'}
    });
  });

  it('should parse URL with scheme, host name and query', () => {
    verifyUrl('http://localhost?key1=value1&key2=value2', {
      scheme: 'http',
      host: 'localhost',
      query: {key1: 'value1', key2: 'value2'}
    });

    verifyUrl('https://neo4j.com/?key1=1&key2=2', {
      scheme: 'https',
      host: 'neo4j.com',
      query: {key1: '1', key2: '2'}
    });

    verifyUrl('bolt://some-neo4j-server.com/?a=value1&b=value2&c=value3', {
      scheme: 'bolt',
      host: 'some-neo4j-server.com',
      query: {a: 'value1', b: 'value2', c: 'value3'}
    });

    verifyUrl('bolt+routing://ec2-34-242-76-91.eu-west-1.compute.aws.com?foo=1&bar=2&baz=3&qux=4', {
      scheme: 'bolt+routing',
      host: 'ec2-34-242-76-91.eu-west-1.compute.aws.com',
      query: {foo: '1', bar: '2', baz: '3', qux: '4'}
    });
  });

  it('should parse URL with scheme, IPv4 address and query', () => {
    verifyUrl('ftp://127.0.0.1/?key1=value1&key2=value2', {
      scheme: 'ftp',
      host: '127.0.0.1',
      query: {key1: 'value1', key2: 'value2'}
    });

    verifyUrl('bolt+routing://10.10.192.0?key1=1&key2=2', {
      scheme: 'bolt+routing',
      host: '10.10.192.0',
      query: {key1: '1', key2: '2'}
    });

    verifyUrl('bolt://172.10.5.1?a=value1&b=value2&c=value3', {
      scheme: 'bolt',
      host: '172.10.5.1',
      query: {a: 'value1', b: 'value2', c: 'value3'}
    });

    verifyUrl('https://34.242.76.91/?foo=1&bar=2&baz=3&qux=4', {
      scheme: 'https',
      host: '34.242.76.91',
      query: {foo: '1', bar: '2', baz: '3', qux: '4'}
    });
  });

  it('should parse URL with scheme, IPv6 address and query', () => {
    verifyUrl('bolt+routing://[::1]?key1=value1&key2=value2', {
      scheme: 'bolt+routing',
      host: '[::1]',
      query: {key1: 'value1', key2: 'value2'}
    });

    verifyUrl('http://[ff02::2:ff00:0]?key1=1&key2=2', {
      scheme: 'http',
      host: '[ff02::2:ff00:0]',
      query: {key1: '1', key2: '2'}
    });

    verifyUrl('https://[1afc:0:a33:85a3::ff2f]/?a=value1&b=value2&c=value3', {
      scheme: 'https',
      host: '[1afc:0:a33:85a3::ff2f]',
      query: {a: 'value1', b: 'value2', c: 'value3'}
    });

    verifyUrl('bolt://[ff0a::101]/?foo=1&bar=2&baz=3&qux=4', {
      scheme: 'bolt',
      host: '[ff0a::101]',
      query: {foo: '1', bar: '2', baz: '3', qux: '4'}
    });

    verifyUrl('bolt+routing://[2a05:d018:270:f400:6d8c:d425:c5f:97f3]?animal=apa', {
      scheme: 'bolt+routing',
      host: '[2a05:d018:270:f400:6d8c:d425:c5f:97f3]',
      query: {animal: 'apa'}
    });
  });

  it('should parse URL with host name and port', () => {
    verifyUrl('localhost:1212', {
      host: 'localhost',
      port: 1212
    });

    verifyUrl('neo4j.com:8888', {
      host: 'neo4j.com',
      port: 8888
    });

    verifyUrl('some-neo4j-server.com:42', {
      host: 'some-neo4j-server.com',
      port: 42
    });

    verifyUrl('ec2-34-242-76-91.eu-west-1.compute.aws.com:62220', {
      host: 'ec2-34-242-76-91.eu-west-1.compute.aws.com',
      port: 62220
    });
  });

  it('should parse URL with IPv4 address and port', () => {
    verifyUrl('127.0.0.1:9090', {
      host: '127.0.0.1',
      port: 9090
    });

    verifyUrl('10.10.192.0:22000', {
      host: '10.10.192.0',
      port: 22000
    });

    verifyUrl('172.10.5.1:42', {
      host: '172.10.5.1',
      port: 42
    });

    verifyUrl('34.242.76.91:7687', {
      host: '34.242.76.91',
      port: 7687
    });
  });

  it('should parse URL with IPv6 address and port', () => {
    verifyUrl('[::1]:36000', {
      host: '[::1]',
      port: 36000
    });

    verifyUrl('[ff02::2:ff00:0]:8080', {
      host: '[ff02::2:ff00:0]',
      port: 8080
    });

    verifyUrl('[1afc:0:a33:85a3::ff2f]:7474', {
      host: '[1afc:0:a33:85a3::ff2f]',
      port: 7474
    });

    verifyUrl('[ff0a::101]:1000', {
      host: '[ff0a::101]',
      port: 1000
    });

    verifyUrl('[2a05:d018:270:f400:6d8c:d425:c5f:97f3]:7475', {
      host: '[2a05:d018:270:f400:6d8c:d425:c5f:97f3]',
      port: 7475
    });
  });

  it('should parse URL with scheme and host name', () => {
    verifyUrl('ftp://localhost', {
      scheme: 'ftp',
      host: 'localhost'
    });

    verifyUrl('https://neo4j.com', {
      scheme: 'https',
      host: 'neo4j.com'
    });

    verifyUrl('wss://some-neo4j-server.com', {
      scheme: 'wss',
      host: 'some-neo4j-server.com'
    });

    verifyUrl('bolt://ec2-34-242-76-91.eu-west-1.compute.aws.com', {
      scheme: 'bolt',
      host: 'ec2-34-242-76-91.eu-west-1.compute.aws.com'
    });
  });

  it('should parse URL with scheme and IPv4 address', () => {
    verifyUrl('bolt+routing://127.0.0.1', {
      scheme: 'bolt+routing',
      host: '127.0.0.1'
    });

    verifyUrl('http://10.10.192.0', {
      scheme: 'http',
      host: '10.10.192.0'
    });

    verifyUrl('ws://172.10.5.1', {
      scheme: 'ws',
      host: '172.10.5.1'
    });

    verifyUrl('bolt://34.242.76.91', {
      scheme: 'bolt',
      host: '34.242.76.91'
    });
  });

  it('should parse URL with scheme and IPv6 address', () => {
    verifyUrl('https://[::1]', {
      scheme: 'https',
      host: '[::1]'
    });

    verifyUrl('http://[ff02::2:ff00:0]', {
      scheme: 'http',
      host: '[ff02::2:ff00:0]'
    });

    verifyUrl('bolt+routing://[1afc:0:a33:85a3::ff2f]', {
      scheme: 'bolt+routing',
      host: '[1afc:0:a33:85a3::ff2f]'
    });

    verifyUrl('bolt://[ff0a::101]', {
      scheme: 'bolt',
      host: '[ff0a::101]'
    });

    verifyUrl('bolt+routing://[2a05:d018:270:f400:6d8c:d425:c5f:97f3]', {
      scheme: 'bolt+routing',
      host: '[2a05:d018:270:f400:6d8c:d425:c5f:97f3]'
    });
  });

  it('should parse URL with scheme, host name and port', () => {
    verifyUrl('http://localhost:8080', {
      scheme: 'http',
      host: 'localhost',
      port: 8080
    });

    verifyUrl('bolt://neo4j.com:42', {
      scheme: 'bolt',
      host: 'neo4j.com',
      port: 42
    });

    verifyUrl('bolt+routing://some-neo4j-server.com:12000', {
      scheme: 'bolt+routing',
      host: 'some-neo4j-server.com',
      port: 12000
    });

    verifyUrl('wss://ec2-34-242-76-91.eu-west-1.compute.aws.com:2626', {
      scheme: 'wss',
      host: 'ec2-34-242-76-91.eu-west-1.compute.aws.com',
      port: 2626
    });
  });

  it('should parse URL with scheme, IPv4 address and port', () => {
    verifyUrl('bolt://127.0.0.1:9091', {
      scheme: 'bolt',
      host: '127.0.0.1',
      port: 9091
    });

    verifyUrl('bolt://10.10.192.0:7447', {
      scheme: 'bolt',
      host: '10.10.192.0',
      port: 7447
    });

    verifyUrl('bolt+routing://172.10.5.1:8888', {
      scheme: 'bolt+routing',
      host: '172.10.5.1',
      port: 8888
    });

    verifyUrl('https://34.242.76.91:42', {
      scheme: 'https',
      host: '34.242.76.91',
      port: 42
    });
  });

  it('should parse URL with scheme, IPv6 address and port', () => {
    verifyUrl('http://[::1]:9123', {
      scheme: 'http',
      host: '[::1]',
      port: 9123
    });

    verifyUrl('bolt://[ff02::2:ff00:0]:3831', {
      scheme: 'bolt',
      host: '[ff02::2:ff00:0]',
      port: 3831
    });

    verifyUrl('bolt+routing://[1afc:0:a33:85a3::ff2f]:50505', {
      scheme: 'bolt+routing',
      host: '[1afc:0:a33:85a3::ff2f]',
      port: 50505
    });

    verifyUrl('ftp://[ff0a::101]:4242', {
      scheme: 'ftp',
      host: '[ff0a::101]',
      port: 4242
    });

    verifyUrl('wss://[2a05:d018:270:f400:6d8c:d425:c5f:97f3]:22', {
      scheme: 'wss',
      host: '[2a05:d018:270:f400:6d8c:d425:c5f:97f3]',
      port: 22
    });
  });

  it('should parse URL with scheme, host name, port and query', () => {
    verifyUrl('http://localhost:3032/?key1=value1&key2=value2', {
      scheme: 'http',
      host: 'localhost',
      port: 3032,
      query: {key1: 'value1', key2: 'value2'}
    });

    verifyUrl('https://neo4j.com:7575?foo=bar&baz=qux', {
      scheme: 'https',
      host: 'neo4j.com',
      port: 7575,
      query: {foo: 'bar', baz: 'qux'}
    });

    verifyUrl('bolt+routing://some-neo4j-server.com:14500?key=value', {
      scheme: 'bolt+routing',
      host: 'some-neo4j-server.com',
      port: 14500,
      query: {key: 'value'}
    });

    verifyUrl('ws://ec2-34-242-76-91.eu-west-1.compute.aws.com:30270?a=1&b=2&c=3&d=4', {
      scheme: 'ws',
      host: 'ec2-34-242-76-91.eu-west-1.compute.aws.com',
      port: 30270,
      query: {a: '1', b: '2', c: '3', d: '4'}
    });
  });

  it('should parse URL with scheme, IPv4 address, port and query', () => {
    verifyUrl('bolt://127.0.0.1:30399?key1=value1&key2=value2', {
      scheme: 'bolt',
      host: '127.0.0.1',
      port: 30399,
      query: {key1: 'value1', key2: 'value2'}
    });

    verifyUrl('bolt+routing://10.10.192.0:12100/?foo=bar&baz=qux', {
      scheme: 'bolt+routing',
      host: '10.10.192.0',
      port: 12100,
      query: {foo: 'bar', baz: 'qux'}
    });

    verifyUrl('bolt://172.10.5.1:22?a=1&b=2&c=3&d=4', {
      scheme: 'bolt',
      host: '172.10.5.1',
      port: 22,
      query: {a: '1', b: '2', c: '3', d: '4'}
    });

    verifyUrl('http://34.242.76.91:1829?key=value', {
      scheme: 'http',
      host: '34.242.76.91',
      port: 1829,
      query: {key: 'value'}
    });
  });

  it('should parse URL with scheme, IPv6 address, port and query', () => {
    verifyUrl('https://[::1]:4217?key=value', {
      scheme: 'https',
      host: '[::1]',
      port: 4217,
      query: {key: 'value'}
    });

    verifyUrl('bolt+routing://[ff02::2:ff00:0]:22/?animal1=apa&animal2=dog', {
      scheme: 'bolt+routing',
      host: '[ff02::2:ff00:0]',
      port: 22,
      query: {animal1: 'apa', animal2: 'dog'}
    });

    verifyUrl('bolt://[1afc:0:a33:85a3::ff2f]:4242?a=1&b=2&c=3&d=4', {
      scheme: 'bolt',
      host: '[1afc:0:a33:85a3::ff2f]',
      port: 4242,
      query: {a: '1', b: '2', c: '3', d: '4'}
    });

    verifyUrl('wss://[ff0a::101]:24240?foo=bar&baz=qux', {
      scheme: 'wss',
      host: '[ff0a::101]',
      port: 24240,
      query: {foo: 'bar', baz: 'qux'}
    });

    verifyUrl('https://[2a05:d018:270:f400:6d8c:d425:c5f:97f3]:42?key1=value1&key2=value2', {
      scheme: 'https',
      host: '[2a05:d018:270:f400:6d8c:d425:c5f:97f3]',
      port: 42,
      query: {key1: 'value1', key2: 'value2'}
    });
  });

  it('should fail to parse URL without host', () => {
    expect(() => urlParser.parse('http://')).toThrow();
    expect(() => urlParser.parse('bolt://')).toThrow();
    expect(() => urlParser.parse('bolt+routing://')).toThrow();
  });

  it('should fail to parse URL with duplicated query parameters', () => {
    expect(() => urlParser.parse('bolt://localhost/?key=value1&key=value2')).toThrow();
    expect(() => urlParser.parse('bolt://localhost:8080/?key=value1&key=value2')).toThrow();

    expect(() => urlParser.parse('bolt+routing://10.10.127.5?key=value1&key=value2')).toThrow();
    expect(() => urlParser.parse('bolt+routing://10.10.127.5:8080?key=value1&key=value2')).toThrow();

    expect(() => urlParser.parse('https://[ff0a::101]?key=value1&key=value2')).toThrow();
    expect(() => urlParser.parse('https://[ff0a::101]:8080?key=value1&key=value2')).toThrow();
  });

  it('should fail to parse URL with empty query key', () => {
    expect(() => urlParser.parse('bolt://localhost?=value')).toThrow();
    expect(() => urlParser.parse('bolt://localhost:8080?=value')).toThrow();

    expect(() => urlParser.parse('bolt+routing://10.10.127.5?=value')).toThrow();
    expect(() => urlParser.parse('bolt+routing://10.10.127.5:8080?=value')).toThrow();

    expect(() => urlParser.parse('https://[ff0a::101]/?value=')).toThrow();
    expect(() => urlParser.parse('https://[ff0a::101]:8080/?=value')).toThrow();
  });

  it('should fail to parse URL with empty query value', () => {
    expect(() => urlParser.parse('bolt://localhost?key=')).toThrow();
    expect(() => urlParser.parse('bolt://localhost:8080?key=')).toThrow();

    expect(() => urlParser.parse('bolt+routing://10.10.127.5/?key=')).toThrow();
    expect(() => urlParser.parse('bolt+routing://10.10.127.5:8080/?key=')).toThrow();

    expect(() => urlParser.parse('https://[ff0a::101]?key=')).toThrow();
    expect(() => urlParser.parse('https://[ff0a::101]:8080?key=')).toThrow();
  });

  it('should fail to parse URL with no query value', () => {
    expect(() => urlParser.parse('bolt://localhost?key')).toThrow();
    expect(() => urlParser.parse('bolt://localhost:8080?key')).toThrow();

    expect(() => urlParser.parse('bolt+routing://10.10.127.5/?key')).toThrow();
    expect(() => urlParser.parse('bolt+routing://10.10.127.5:8080/?key')).toThrow();

    expect(() => urlParser.parse('https://[ff0a::101]?key')).toThrow();
    expect(() => urlParser.parse('https://[ff0a::101]:8080?key')).toThrow();
  });

  function verifyUrl(urlString, expectedUrl) {
    const url = urlParser.parse(urlString);

    if (expectedUrl.scheme) {
      expect(url.scheme).toEqual(expectedUrl.scheme);
    } else {
      expect(url.scheme).toBeNull();
    }

    expect(url.host).toBeDefined();
    expect(url.host).not.toBeNull();
    expect(url.host).toEqual(expectedUrl.host);

    if (expectedUrl.port) {
      expect(url.port).toEqual(expectedUrl.port);
    } else {
      expect(url.port).toBeNull();
    }

    if (expectedUrl.query) {
      expect(url.query).toEqual(expectedUrl.query);
    } else {
      expect(url.query).toEqual({});
    }
  }

});

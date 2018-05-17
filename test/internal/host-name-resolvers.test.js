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

import {DnsHostNameResolver, DummyHostNameResolver} from '../../src/v1/internal/host-name-resolvers';
import hasFeature from '../../src/v1/internal/features';
import urlUtil from '../../src/v1/internal/url-util';

describe('DummyHostNameResolver', () => {

  it('should resolve given address to itself', done => {
    const seedRouter = 'localhost';
    const resolver = new DummyHostNameResolver();

    resolver.resolve(seedRouter).then(addresses => {
      expect(addresses.length).toEqual(1);
      expect(addresses[0]).toEqual(seedRouter);
      done();
    });
  });

  it('should resolve given address with port to itself', done => {
    const seedRouter = 'localhost:7474';
    const resolver = new DummyHostNameResolver();

    resolver.resolve(seedRouter).then(addresses => {
      expect(addresses.length).toEqual(1);
      expect(addresses[0]).toEqual(seedRouter);
      done();
    });
  });

});

describe('DnsHostNameResolver', () => {

  if (hasFeature('dns_lookup')) {

    let originalTimeout;

    beforeEach(() => {
      // it sometimes takes couple seconds to perform dns lookup, increase the async test timeout
      originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
      jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;
    });

    afterEach(() => {
      jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
    });

    it('should resolve address', done => {
      const seedRouter = 'neo4j.com';
      const resolver = new DnsHostNameResolver();

      resolver.resolve(seedRouter).then(addresses => {
        expect(addresses.length).toBeGreaterThan(0);

        addresses.forEach(address => {
          expectToBeDefined(address);
          const parsedUrl = urlUtil.parseDatabaseUrl(address);
          expect(parsedUrl.scheme).toBeNull();
          expectToBeDefined(parsedUrl.host);
          expect(parsedUrl.port).toEqual(7687); // default port should be appended
        });

        done();
      });
    });

    it('should resolve address with port', done => {
      const seedRouter = 'neo4j.com:7474';
      const resolver = new DnsHostNameResolver();

      resolver.resolve(seedRouter).then(addresses => {
        expect(addresses.length).toBeGreaterThan(0);

        addresses.forEach(address => {
          expectToBeDefined(address);
          const parsedUrl = urlUtil.parseDatabaseUrl(address);
          expect(parsedUrl.scheme).toBeNull();
          expectToBeDefined(parsedUrl.host);
          expect(parsedUrl.port).toEqual(7474);
        });

        done();
      });
    });

    it('should resolve IPv4 address to itself', done => {
      const addressToResolve = '127.0.0.1';
      const expectedResolvedAddress = '127.0.0.1:7687'; // includes default port
      testIpAddressResolution(addressToResolve, expectedResolvedAddress, done);
    });

    it('should resolve IPv4 address with port to itself', done => {
      const address = '127.0.0.1:7474';
      testIpAddressResolution(address, address, done);
    });

    it('should resolve IPv6 address to itself', done => {
      const addressToResolve = '[2001:4860:4860::8888]';
      const expectedResolvedAddress = '[2001:4860:4860::8888]:7687'; // includes default port
      testIpAddressResolution(addressToResolve, expectedResolvedAddress, done);
    });

    it('should resolve IPv6 address with port to itself', done => {
      const address = '[2001:4860:4860::8888]:7474';
      testIpAddressResolution(address, address, done);
    });

    function testIpAddressResolution(address, expectedResolvedAddress, done) {
      const resolver = new DnsHostNameResolver();

      resolver.resolve(address).then(addresses => {
        expect(addresses.length).toEqual(1);
        expect(addresses[0]).toEqual(expectedResolvedAddress);
        done();
      });
    }

  }
});

function expectToBeDefined(value) {
  expect(value).toBeDefined();
  expect(value).not.toBeNull();
}

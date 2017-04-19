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

import {DnsHostNameResolver, DummyHostNameResolver} from '../../src/v1/internal/host-name-resolvers';
import hasFeature from '../../src/v1/internal/features';
import {parseHost, parsePort, parseScheme, parseRoutingContext} from '../../src/v1/internal/connector';

describe('RoutingContextParser', ()=>{

  it('should parse routing context', done => {
    const url = "bolt://localhost:7687/cat?name=molly&age=1&color=white";
    const context = parseRoutingContext(url);
    expect(context).toEqual({name:"molly", age:"1", color:"white"});

    done();
  });

  it('should return empty routing context', done =>{
    const url1 = "bolt://localhost:7687/cat?";
    const context1 = parseRoutingContext(url1);
    expect(context1).toEqual({});

    const url2 = "bolt://localhost:7687/lalala";
    const context2 = parseRoutingContext(url2);
    expect(context2).toEqual({});

    done();
  });

  it('should error for unmatched pair', done=>{
    const url = "bolt://localhost?cat";
    expect(()=>parseRoutingContext(url)).toThrow(
      new Error("Invalid parameters: 'cat' in url 'bolt://localhost?cat'."));

    done();
  });
});

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
          expect(parseScheme(address)).toEqual('');
          expectToBeDefined(parseHost(address));
          expect(parsePort(address)).not.toBeDefined();
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
          expect(parseScheme(address)).toEqual('');
          expectToBeDefined(parseHost(address));
          expect(parsePort(address)).toEqual('7474');
        });

        done();
      });
    });

    it('should resolve unresolvable address to itself', done => {
      const seedRouter = '127.0.0.1'; // IP can't be resolved
      const resolver = new DnsHostNameResolver();

      resolver.resolve(seedRouter).then(addresses => {
        expect(addresses.length).toEqual(1);
        expect(addresses[0]).toEqual(seedRouter);
        done();
      });
    });

    it('should resolve unresolvable address with port to itself', done => {
      const seedRouter = '127.0.0.1:7474'; // IP can't be resolved
      const resolver = new DnsHostNameResolver();

      resolver.resolve(seedRouter).then(addresses => {
        expect(addresses.length).toEqual(1);
        expect(addresses[0]).toEqual(seedRouter);
        done();
      });
    });

  }
});

function expectToBeDefined(value) {
  expect(value).toBeDefined();
  expect(value).not.toBeNull();
}

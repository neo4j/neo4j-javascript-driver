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

import {parseHost, parsePort} from './util';

class HostNameResolver {

  resolve() {
    throw new Error('Abstract function');
  }
}

export class DummyHostNameResolver extends HostNameResolver {

  resolve(seedRouter) {
    return resolveToItself(seedRouter);
  }
}

export class DnsHostNameResolver extends HostNameResolver {

  constructor() {
    super();
    this._dns = require('dns');
  }

  resolve(seedRouter) {
    const seedRouterHost = parseHost(seedRouter);
    const seedRouterPort = parsePort(seedRouter);

    return new Promise((resolve) => {
      this._dns.lookup(seedRouterHost, {all: true}, (error, addresses) => {
        if (error) {
          resolve(resolveToItself(seedRouter));
        } else {
          const addressesWithPorts = addresses.map(address => addressWithPort(address, seedRouterPort));
          resolve(addressesWithPorts);
        }
      });
    });
  }
}

function resolveToItself(address) {
  return Promise.resolve([address]);
}

function addressWithPort(addressObject, port) {
  const address = addressObject.address;
  if (port) {
    return address + ':' + port;
  }
  return address;
}

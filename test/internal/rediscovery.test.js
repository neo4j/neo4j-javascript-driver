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

import Rediscovery from '../../src/v1/internal/rediscovery';
import RoutingUtil from '../../src/v1/internal/routing-util';
import {newError, PROTOCOL_ERROR} from '../../src/v1/error';
import Record from '../../src/v1/record';
import {int} from '../../src/v1/integer';
import RoutingTable from '../../src/v1/internal/routing-table';

const ROUTER_ADDRESS = 'bolt+routing://test.router.com';

describe('rediscovery', () => {

  it('should return null when connection error happens', done => {
    const util = new FakeRoutingUtil({
      callRoutingProcedure: () => null,
    });

    lookupRoutingTableOnRouter(util).then(routingTable => {
      expect(routingTable).toBeNull();
      done();
    });
  });

  it('should throw when no records are returned', done => {
    const util = new FakeRoutingUtil({
      callRoutingProcedure: () => [],
    });

    lookupRoutingTableOnRouter(util).catch(error => {
      expectProtocolError(error, 'Illegal response from router');
      done();
    });
  });

  it('should throw when multiple records are returned', done => {
    const util = new FakeRoutingUtil({
      callRoutingProcedure: () => [new Record(['a'], ['aaa']), new Record(['b'], ['bbb'])]
    });

    lookupRoutingTableOnRouter(util).catch(error => {
      expectProtocolError(error, 'Illegal response from router');
      done();
    });
  });

  it('should throw when ttl parsing throws', done => {
    const util = new FakeRoutingUtil({
      callRoutingProcedure: () => [new Record(['a'], ['aaa'])],
      parseTtl: () => {
        throw newError('Unable to parse TTL', PROTOCOL_ERROR);
      }
    });

    lookupRoutingTableOnRouter(util).catch(error => {
      expectProtocolError(error, 'Unable to parse TTL');
      done();
    });
  });

  it('should throw when servers parsing throws', done => {
    const util = new FakeRoutingUtil({
      callRoutingProcedure: () => [new Record(['a'], ['aaa'])],
      parseTtl: () => int(42),
      parseServers: () => {
        throw newError('Unable to parse servers', PROTOCOL_ERROR);
      }
    });

    lookupRoutingTableOnRouter(util).catch(error => {
      expectProtocolError(error, 'Unable to parse servers');
      done();
    });
  });

  it('should throw when no routers', done => {
    const util = new FakeRoutingUtil({
      callRoutingProcedure: () => [new Record(['a'], ['aaa'])],
      parseTtl: () => int(42),
      parseServers: () => {
        return {
          routers: [],
          readers: ['reader1'],
          writers: ['writer1']
        };
      }
    });

    lookupRoutingTableOnRouter(util).catch(error => {
      expectProtocolError(error, 'Received no routers');
      done();
    });
  });

  it('should throw when no readers', done => {
    const util = new FakeRoutingUtil({
      callRoutingProcedure: () => [new Record(['a'], ['aaa'])],
      parseTtl: () => int(42),
      parseServers: () => {
        return {
          routers: ['router1'],
          readers: [],
          writers: ['writer1']
        };
      }
    });

    lookupRoutingTableOnRouter(util).catch(error => {
      expectProtocolError(error, 'Received no readers');
      done();
    });
  });

  it('should return routing table when no writers', done => {
    const util = new FakeRoutingUtil({
      callRoutingProcedure: () => [new Record(['a'], ['aaa'])],
      parseTtl: () => int(42),
      parseServers: () => {
        return {
          routers: ['router1'],
          readers: ['reader1'],
          writers: []
        };
      }
    });

    lookupRoutingTableOnRouter(util).then(routingTable => {
      expect(routingTable).toBeDefined();
      expect(routingTable).not.toBeNull();
      done();
    });
  });

  it('should return valid routing table with 1 router, 1 reader and 1 writer', done => {
    testValidRoutingTable(['router1'], ['reader1'], ['writer1'], int(42), done);
  });

  it('should return valid routing table with 2 routers, 2 readers and 2 writers', done => {
    testValidRoutingTable(['router1', 'router2'], ['reader1', 'reader2'], ['writer1', 'writer2'], int(Date.now()), done);
  });

  it('should return valid routing table with 1 router, 3 readers and 1 writer', done => {
    testValidRoutingTable(['router1'], ['reader1', 'reader2', 'reader3'], ['writer1'], int(12345), done);
  });

  function testValidRoutingTable(routerAddresses, readerAddresses, writerAddresses, expires, done) {
    const util = new FakeRoutingUtil({
      callRoutingProcedure: () => [new Record(['a'], ['aaa'])],
      parseTtl: () => expires,
      parseServers: () => {
        return {
          routers: routerAddresses,
          readers: readerAddresses,
          writers: writerAddresses
        };
      }
    });

    lookupRoutingTableOnRouter(util).then(routingTable => {
      expect(routingTable).toBeDefined();
      expect(routingTable).not.toBeNull();

      expect(routingTable.expirationTime).toEqual(expires);

      const allServers = routingTable.serversDiff(new RoutingTable()).sort();
      const allExpectedServers = [...routerAddresses, ...readerAddresses, ...writerAddresses].sort();
      expect(allServers).toEqual(allExpectedServers);

      done();
    });
  }

  function lookupRoutingTableOnRouter(routingUtil) {
    const rediscovery = new Rediscovery(routingUtil);
    return rediscovery.lookupRoutingTableOnRouter(null, ROUTER_ADDRESS);
  }

  function expectProtocolError(error, messagePrefix) {
    expect(error.code).toEqual(PROTOCOL_ERROR);
    expect(error.message.indexOf(messagePrefix)).toEqual(0);
  }

  function shouldNotBeCalled() {
    throw new Error('Should not be called');
  }

  class FakeRoutingUtil extends RoutingUtil {

    constructor({callRoutingProcedure = shouldNotBeCalled, parseTtl = shouldNotBeCalled, parseServers = shouldNotBeCalled}) {
      super();
      this._callAvailableRoutingProcedure = callRoutingProcedure;
      this._parseTtl = parseTtl;
      this._parseServers = parseServers;
    }

    callRoutingProcedure(session, routerAddress) {
      return new Promise((resolve, reject) => {
        try {
          resolve(this._callAvailableRoutingProcedure());
        } catch (error) {
          reject(error);
        }
      });
    }

    parseTtl(record, routerAddress) {
      return this._parseTtl();
    }

    parseServers(record, routerAddress) {
      return this._parseServers();
    }
  }
});

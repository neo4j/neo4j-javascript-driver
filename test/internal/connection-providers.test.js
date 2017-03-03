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

import {READ, WRITE} from '../../src/v1/driver';
import Integer, {int} from '../../src/v1/integer';
import {SERVICE_UNAVAILABLE} from '../../src/v1/error';
import RoutingTable from '../../src/v1/internal/routing-table';
import RoundRobinArray from '../../src/v1/internal/round-robin-array';
import {DirectConnectionProvider, LoadBalancer} from '../../src/v1/internal/connection-providers';
import Pool from '../../src/v1/internal/pool';

describe('DirectConnectionProvider', () => {

  it('acquires connection from the pool', done => {
    const pool = newPool();
    const connectionProvider = new DirectConnectionProvider('localhost:123', pool);

    connectionProvider.acquireConnection(READ).then(connection => {
      expect(connection).toBeDefined();
      expect(connection.address).toEqual('localhost:123');
      expect(connection.release).toBeDefined();
      expect(pool.has('localhost:123')).toBeTruthy();

      done();
    });
  });

});

describe('LoadBalancer', () => {

  it('can forget address', () => {
    const loadBalancer = newLoadBalancer(
      ['server-1', 'server-2'],
      ['server-3', 'server-2'],
      ['server-2', 'server-4']
    );

    loadBalancer.forget('server-2');

    expectRoutingTable(loadBalancer,
      ['server-1', 'server-2'],
      ['server-3'],
      ['server-4']
    );
  });

  it('can not forget unknown address', () => {
    const loadBalancer = newLoadBalancer(
      ['server-1', 'server-2'],
      ['server-3', 'server-4'],
      ['server-5', 'server-6']
    );

    loadBalancer.forget('server-42');

    expectRoutingTable(loadBalancer,
      ['server-1', 'server-2'],
      ['server-3', 'server-4'],
      ['server-5', 'server-6']
    );
  });

  it('purges connections when address is forgotten', () => {
    const pool = newPool();

    pool.acquire('server-1');
    pool.acquire('server-3');
    pool.acquire('server-5');
    expectPoolToContain(pool, ['server-1', 'server-3', 'server-5']);

    const loadBalancer = newLoadBalancer(
      ['server-1', 'server-2'],
      ['server-3', 'server-2'],
      ['server-2', 'server-4'],
      pool
    );

    loadBalancer.forget('server-1');
    loadBalancer.forget('server-5');

    expectPoolToContain(pool, ['server-3']);
    expectPoolToNotContain(pool, ['server-1', 'server-5']);
  });

  it('can forget writer address', () => {
    const loadBalancer = newLoadBalancer(
      ['server-1', 'server-2'],
      ['server-3', 'server-2'],
      ['server-2', 'server-4']
    );

    loadBalancer.forgetWriter('server-2');

    expectRoutingTable(loadBalancer,
      ['server-1', 'server-2'],
      ['server-3', 'server-2'],
      ['server-4']
    );
  });

  it('can not forget unknown writer address', () => {
    const loadBalancer = newLoadBalancer(
      ['server-1', 'server-2'],
      ['server-3', 'server-4'],
      ['server-5', 'server-6']
    );

    loadBalancer.forgetWriter('server-42');

    expectRoutingTable(loadBalancer,
      ['server-1', 'server-2'],
      ['server-3', 'server-4'],
      ['server-5', 'server-6']
    );
  });

  it('initializes routing table with the given router', () => {
    const loadBalancer = new LoadBalancer('server-ABC', newPool());

    expectRoutingTable(loadBalancer,
      ['server-ABC'],
      [],
      []
    );
  });

  it('acquires read connection with up-to-date routing table', done => {
    const pool = newPool();
    const loadBalancer = newLoadBalancer(
      ['server-1', 'server-2'],
      ['server-3', 'server-4'],
      ['server-5', 'server-6'],
      pool
    );

    loadBalancer.acquireConnection(READ).then(connection => {
      expect(connection.address).toEqual('server-3');
      expect(pool.has('server-3')).toBeTruthy();

      loadBalancer.acquireConnection(READ).then(connection => {
        expect(connection.address).toEqual('server-4');
        expect(pool.has('server-4')).toBeTruthy();

        done();
      });
    });
  });

  it('acquires write connection with up-to-date routing table', done => {
    const pool = newPool();
    const loadBalancer = newLoadBalancer(
      ['server-1', 'server-2'],
      ['server-3', 'server-4'],
      ['server-5', 'server-6'],
      pool
    );

    loadBalancer.acquireConnection(WRITE).then(connection => {
      expect(connection.address).toEqual('server-5');
      expect(pool.has('server-5')).toBeTruthy();

      loadBalancer.acquireConnection(WRITE).then(connection => {
        expect(connection.address).toEqual('server-6');
        expect(pool.has('server-6')).toBeTruthy();

        done();
      });
    });
  });

  it('throws for illegal access mode', done => {
    const loadBalancer = newLoadBalancer(
      ['server-1', 'server-2'],
      ['server-3', 'server-4'],
      ['server-5', 'server-6']
    );

    loadBalancer.acquireConnection('WRONG').catch(error => {
      expect(error.message).toEqual('Illegal mode WRONG');
      done();
    });
  });

  it('refreshes stale routing table to get read connection', done => {
    const pool = newPool();
    const updatedRoutingTable = newRoutingTable(
      ['server-A', 'server-B'],
      ['server-C', 'server-D'],
      ['server-E', 'server-F']
    );
    const loadBalancer = newLoadBalancer(
      ['server-1', 'server-2'],
      ['server-3', 'server-4'],
      ['server-5', 'server-6'],
      pool,
      int(0), // expired routing table
      {'server-1': updatedRoutingTable}
    );

    loadBalancer.acquireConnection(READ).then(connection => {
      expect(connection.address).toEqual('server-C');
      expect(pool.has('server-C')).toBeTruthy();

      loadBalancer.acquireConnection(READ).then(connection => {
        expect(connection.address).toEqual('server-D');
        expect(pool.has('server-D')).toBeTruthy();

        done();
      });
    });
  });

  it('refreshes stale routing table to get write connection', done => {
    const pool = newPool();
    const updatedRoutingTable = newRoutingTable(
      ['server-A', 'server-B'],
      ['server-C', 'server-D'],
      ['server-E', 'server-F']
    );
    const loadBalancer = newLoadBalancer(
      ['server-1', 'server-2'],
      ['server-3', 'server-4'],
      ['server-5', 'server-6'],
      pool,
      int(0), // expired routing table
      {'server-1': updatedRoutingTable}
    );

    loadBalancer.acquireConnection(WRITE).then(connection => {
      expect(connection.address).toEqual('server-E');
      expect(pool.has('server-E')).toBeTruthy();

      loadBalancer.acquireConnection(WRITE).then(connection => {
        expect(connection.address).toEqual('server-F');
        expect(pool.has('server-F')).toBeTruthy();

        done();
      });
    });
  });

  it('refreshes stale routing table to get read connection when one router fails', done => {
    const pool = newPool();
    const updatedRoutingTable = newRoutingTable(
      ['server-A', 'server-B'],
      ['server-C', 'server-D'],
      ['server-E', 'server-F']
    );
    const loadBalancer = newLoadBalancer(
      ['server-1', 'server-2'],
      ['server-3', 'server-4'],
      ['server-5', 'server-6'],
      pool,
      int(0), // expired routing table
      {
        'server-1': null, // did not return any routing table
        'server-2': updatedRoutingTable,
      }
    );

    loadBalancer.acquireConnection(READ).then(connection => {
      expect(connection.address).toEqual('server-C');
      expect(pool.has('server-C')).toBeTruthy();

      loadBalancer.acquireConnection(READ).then(connection => {
        expect(connection.address).toEqual('server-D');
        expect(pool.has('server-D')).toBeTruthy();

        done();
      });
    });
  });

  it('refreshes stale routing table to get write connection', done => {
    const pool = newPool();
    const updatedRoutingTable = newRoutingTable(
      ['server-A', 'server-B'],
      ['server-C', 'server-D'],
      ['server-E', 'server-F']
    );
    const loadBalancer = newLoadBalancer(
      ['server-1', 'server-2'],
      ['server-3', 'server-4'],
      ['server-5', 'server-6'],
      pool,
      int(0), // expired routing table
      {
        'server-1': null, // did not return any routing table
        'server-2': updatedRoutingTable,
      }
    );

    loadBalancer.acquireConnection(WRITE).then(connection => {
      expect(connection.address).toEqual('server-E');
      expect(pool.has('server-E')).toBeTruthy();

      loadBalancer.acquireConnection(WRITE).then(connection => {
        expect(connection.address).toEqual('server-F');
        expect(pool.has('server-F')).toBeTruthy();

        done();
      });
    });
  });

  it('refreshes stale routing table to get read connection when one router returns illegal response', done => {
    const pool = newPool();
    const newIllegalRoutingTable = newRoutingTable(
      ['server-A', 'server-B'],
      ['server-C', 'server-D'],
      [] // no writers - table is illegal and should be skipped
    );
    const newLegalRoutingTable = newRoutingTable(
      ['server-A', 'server-B'],
      ['server-C', 'server-D'],
      ['server-E', 'server-F']
    );
    const loadBalancer = newLoadBalancer(
      ['server-1', 'server-2'],
      ['server-3', 'server-4'],
      ['server-5', 'server-6'],
      pool,
      int(0), // expired routing table
      {
        'server-1': newIllegalRoutingTable,
        'server-2': newLegalRoutingTable,
      }
    );

    loadBalancer.acquireConnection(READ).then(connection => {
      expect(connection.address).toEqual('server-C');
      expect(pool.has('server-C')).toBeTruthy();

      loadBalancer.acquireConnection(READ).then(connection => {
        expect(connection.address).toEqual('server-D');
        expect(pool.has('server-D')).toBeTruthy();

        done();
      });
    });
  });

  it('refreshes stale routing table to get write connection when one router returns illegal response', done => {
    const pool = newPool();
    const newIllegalRoutingTable = newRoutingTable(
      ['server-A', 'server-B'],
      ['server-C', 'server-D'],
      [] // no writers - table is illegal and should be skipped
    );
    const newLegalRoutingTable = newRoutingTable(
      ['server-A', 'server-B'],
      ['server-C', 'server-D'],
      ['server-E', 'server-F']
    );
    const loadBalancer = newLoadBalancer(
      ['server-1', 'server-2'],
      ['server-3', 'server-4'],
      ['server-5', 'server-6'],
      pool,
      int(0), // expired routing table
      {
        'server-1': newIllegalRoutingTable,
        'server-2': newLegalRoutingTable,
      }
    );

    loadBalancer.acquireConnection(WRITE).then(connection => {
      expect(connection.address).toEqual('server-E');
      expect(pool.has('server-E')).toBeTruthy();

      loadBalancer.acquireConnection(WRITE).then(connection => {
        expect(connection.address).toEqual('server-F');
        expect(pool.has('server-F')).toBeTruthy();

        done();
      });
    });
  });

  it('throws when all routers return nothing while getting read connection', done => {
    const loadBalancer = newLoadBalancer(
      ['server-1', 'server-2'],
      ['server-3', 'server-4'],
      ['server-5', 'server-6'],
      newPool(),
      int(0), // expired routing table
      {
        'server-1': null, // did not return any routing table
        'server-2': null  // did not return any routing table
      }
    );

    loadBalancer.acquireConnection(READ).catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE);
      done();
    });
  });

  it('throws when all routers return nothing while getting write connection', done => {
    const loadBalancer = newLoadBalancer(
      ['server-1', 'server-2'],
      ['server-3', 'server-4'],
      ['server-5', 'server-6'],
      newPool(),
      int(0), // expired routing table
      {
        'server-1': null, // did not return any routing table
        'server-2': null  // did not return any routing table
      }
    );

    loadBalancer.acquireConnection(WRITE).catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE);
      done();
    });
  });

  it('throws when all routers return illegal routing tables while getting read connection', done => {
    const newIllegalRoutingTable = newRoutingTable(
      ['server-A', 'server-B'],
      ['server-C', 'server-D'],
      [] // no writers - table is illegal and should be skipped
    );
    const loadBalancer = newLoadBalancer(
      ['server-1', 'server-2'],
      ['server-3', 'server-4'],
      ['server-5', 'server-6'],
      newPool(),
      int(0), // expired routing table
      {
        'server-1': newIllegalRoutingTable,
        'server-2': newIllegalRoutingTable
      }
    );

    loadBalancer.acquireConnection(READ).catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE);
      done();
    });
  });

  it('throws when all routers return illegal routing tables while getting write connection', done => {
    const newIllegalRoutingTable = newRoutingTable(
      ['server-A', 'server-B'],
      ['server-C', 'server-D'],
      [] // no writers - table is illegal and should be skipped
    );
    const loadBalancer = newLoadBalancer(
      ['server-1', 'server-2'],
      ['server-3', 'server-4'],
      ['server-5', 'server-6'],
      newPool(),
      int(0), // expired routing table
      {
        'server-1': newIllegalRoutingTable,
        'server-2': newIllegalRoutingTable
      }
    );

    loadBalancer.acquireConnection(WRITE).catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE);
      done();
    });
  });

  it('throws when stale routing table without routers while getting read connection', done => {
    const loadBalancer = newLoadBalancer(
      [], // no routers
      ['server-3', 'server-4'],
      ['server-5', 'server-6'],
      newPool(),
      int(0) // expired routing table
    );

    loadBalancer.acquireConnection(READ).catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE);
      done();
    });
  });

  it('throws when stale routing table without routers while getting write connection', done => {
    const loadBalancer = newLoadBalancer(
      [], // no routers
      ['server-3', 'server-4'],
      ['server-5', 'server-6'],
      newPool(),
      int(0) // expired routing table
    );

    loadBalancer.acquireConnection(WRITE).catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE);
      done();
    });
  });

  it('updates routing table after refresh', done => {
    const pool = newPool();
    const updatedRoutingTable = newRoutingTable(
      ['server-A', 'server-B'],
      ['server-C', 'server-D'],
      ['server-E', 'server-F']
    );
    const loadBalancer = newLoadBalancer(
      ['server-1', 'server-2'],
      ['server-3', 'server-4'],
      ['server-5', 'server-6'],
      pool,
      int(0), // expired routing table
      {
        'server-1': updatedRoutingTable
      }
    );

    loadBalancer.acquireConnection(READ).then(() => {
      expectRoutingTable(loadBalancer,
        ['server-A', 'server-B'],
        ['server-C', 'server-D'],
        ['server-E', 'server-F']
      );
      expectPoolToNotContain(pool, ['server-1', 'server-2', 'server-3', 'server-4', 'server-5', 'server-6']);
      done();
    });
  });

  it('forgets all routers when they fail while acquiring read connection', done => {
    const loadBalancer = newLoadBalancer(
      ['server-1', 'server-2', 'server-3'],
      ['server-4', 'server-5'],
      ['server-6', 'server-7'],
      newPool(),
      int(0) // expired routing table
    );

    loadBalancer.acquireConnection(READ).catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE);
      expectRoutingTable(loadBalancer,
        [],
        ['server-4', 'server-5'],
        ['server-6', 'server-7']
      );
      done();
    });
  });

  it('forgets all routers when they fail while acquiring write connection', done => {
    const loadBalancer = newLoadBalancer(
      ['server-1', 'server-2', 'server-3'],
      ['server-4', 'server-5'],
      ['server-6', 'server-7'],
      newPool(),
      int(0) // expired routing table
    );

    loadBalancer.acquireConnection(WRITE).catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE);
      expectRoutingTable(loadBalancer,
        [],
        ['server-4', 'server-5'],
        ['server-6', 'server-7']
      );
      done();
    });
  });

});

function newLoadBalancer(routers, readers, writers, pool = null, expirationTime = Integer.MAX_VALUE, routerToRoutingTable = {}) {
  const loadBalancer = new LoadBalancer(null, pool || newPool());
  loadBalancer._routingTable = new RoutingTable(
    new RoundRobinArray(routers),
    new RoundRobinArray(readers),
    new RoundRobinArray(writers),
    expirationTime
  );
  loadBalancer._rediscovery = new FakeRediscovery(routerToRoutingTable);
  return loadBalancer;
}

function newRoutingTable(routers, readers, writers, expirationTime = Integer.MAX_VALUE) {
  return new RoutingTable(
    new RoundRobinArray(routers),
    new RoundRobinArray(readers),
    new RoundRobinArray(writers),
    expirationTime
  );
}

function newPool() {
  return new Pool(FakeConnection.create);
}

function expectRoutingTable(loadBalancer, routers, readers, writers) {
  expect(loadBalancer._routingTable.routers.toArray()).toEqual(routers);
  expect(loadBalancer._routingTable.readers.toArray()).toEqual(readers);
  expect(loadBalancer._routingTable.writers.toArray()).toEqual(writers);
}

function expectPoolToContain(pool, addresses) {
  addresses.forEach(address => {
    expect(pool.has(address)).toBeTruthy();
  });
}

function expectPoolToNotContain(pool, addresses) {
  addresses.forEach(address => {
    expect(pool.has(address)).toBeFalsy();
  });
}

class FakeConnection {

  constructor(address, release) {
    this.address = address;
    this.release = release;
  }

  static create(address, release) {
    return new FakeConnection(address, release);
  }
}

class FakeRediscovery {

  constructor(routerToRoutingTable) {
    this._routerToRoutingTable = routerToRoutingTable;
  }

  lookupRoutingTableOnRouter(ignored, router) {
    return this._routerToRoutingTable[router];
  }
}

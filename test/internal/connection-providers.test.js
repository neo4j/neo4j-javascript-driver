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

const NO_OP_DRIVER_CALLBACK = () => {
};

describe('DirectConnectionProvider', () => {

  it('acquires connection from the pool', done => {
    const pool = newPool();
    const connectionProvider = newDirectConnectionProvider('localhost:123', pool);

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
    const loadBalancer = new LoadBalancer('server-ABC', {}, newPool(), NO_OP_DRIVER_CALLBACK);

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
        'server-1': null, // returns no routing table
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
        'server-1': null, // returns no routing table
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
        'server-1': null, // returns no routing table
        'server-2': null  // returns no routing table
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
        'server-1': null, // returns no routing table
        'server-2': null  // returns no routing table
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

  it('uses seed router address when all existing routers failed', done => {
    const illegalRoutingTable = newRoutingTable(
      ['server-A', 'server-B'],
      ['server-C', 'server-D'],
      [] // no writers - table is illegal and should be skipped
    );
    const updatedRoutingTable = newRoutingTable(
      ['server-A', 'server-B', 'server-C'],
      ['server-D', 'server-E'],
      ['server-F', 'server-G']
    );

    const loadBalancer = newLoadBalancerWithSeedRouter(
      'server-0', ['server-0'], // seed router address resolves just to itself
      ['server-1', 'server-2', 'server-3'],
      ['server-4', 'server-5'],
      ['server-6', 'server-7'],
      int(0), // expired routing table
      {
        'server-1': null, // returns no routing table
        'server-2': illegalRoutingTable,
        'server-3': null, // returns no routing table
        'server-0': updatedRoutingTable
      }
    );

    loadBalancer.acquireConnection(READ).then(connection1 => {
      expect(connection1.address).toEqual('server-D');

      loadBalancer.acquireConnection(WRITE).then(connection2 => {
        expect(connection2.address).toEqual('server-F');

        expectRoutingTable(loadBalancer,
          ['server-A', 'server-B', 'server-C'],
          ['server-D', 'server-E'],
          ['server-F', 'server-G']
        );
        done();
      });
    });
  });

  it('uses resolved seed router address when all existing routers failed', done => {
    const illegalRoutingTable = newRoutingTable(
      ['server-A'],
      ['server-B'],
      [] // no writers - table is illegal and should be skipped
    );
    const updatedRoutingTable = newRoutingTable(
      ['server-A', 'server-B'],
      ['server-C', 'server-D'],
      ['server-E', 'server-F']
    );

    const loadBalancer = newLoadBalancerWithSeedRouter(
      'server-0', ['server-01'], // seed router address resolves to a different one
      ['server-1', 'server-2', 'server-3'],
      ['server-4', 'server-5'],
      ['server-6', 'server-7'],
      int(0), // expired routing table
      {
        'server-1': illegalRoutingTable,
        'server-2': illegalRoutingTable,
        'server-3': null, // returns no routing table
        'server-01': updatedRoutingTable
      }
    );

    loadBalancer.acquireConnection(WRITE).then(connection1 => {
      expect(connection1.address).toEqual('server-E');

      loadBalancer.acquireConnection(READ).then(connection2 => {
        expect(connection2.address).toEqual('server-C');

        expectRoutingTable(loadBalancer,
          ['server-A', 'server-B'],
          ['server-C', 'server-D'],
          ['server-E', 'server-F']
        );
        done();
      });
    });
  });

  it('uses resolved seed router address that returns correct routing table when all existing routers failed', done => {
    const illegalRoutingTable = newRoutingTable(
      ['server-A', 'server-B'],
      ['server-C', 'server-D'],
      [] // no writers - table is illegal and should be skipped
    );
    const updatedRoutingTable = newRoutingTable(
      ['server-A', 'server-B'],
      ['server-C'],
      ['server-D', 'server-E']
    );

    const loadBalancer = newLoadBalancerWithSeedRouter(
      'server-0', ['server-01', 'server-02', 'server-03'], // seed router address resolves to 3 different addresses
      ['server-1'],
      ['server-2'],
      ['server-3'],
      int(0), // expired routing table
      {
        'server-1': illegalRoutingTable,
        'server-01': null, // returns no routing table
        'server-02': illegalRoutingTable,
        'server-03': updatedRoutingTable
      }
    );

    loadBalancer.acquireConnection(WRITE).then(connection1 => {
      expect(connection1.address).toEqual('server-D');

      loadBalancer.acquireConnection(WRITE).then(connection2 => {
        expect(connection2.address).toEqual('server-E');

        expectRoutingTable(loadBalancer,
          ['server-A', 'server-B'],
          ['server-C'],
          ['server-D', 'server-E']
        );
        done();
      });
    });
  });

  it('fails when existing routers fail and seed router returns an invalid routing table', done => {
    const emptyIllegalRoutingTable = newRoutingTable([], [], []);

    const loadBalancer = newLoadBalancerWithSeedRouter(
      'server-0', ['server-0'], // seed router address resolves just to itself
      ['server-1', 'server-2', 'server-3'],
      ['server-4', 'server-5'],
      ['server-6'],
      int(0), // expired routing table
      {
        'server-1': emptyIllegalRoutingTable,
        'server-2': null, // returns no routing table
        'server-3': null, // returns no routing table
        'server-0': emptyIllegalRoutingTable
      }
    );

    loadBalancer.acquireConnection(READ).catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE);

      expectRoutingTable(loadBalancer,
        ['server-1'], // only server-1 is in the table, it returned a routing table which turned out to be invalid
        ['server-4', 'server-5'],
        ['server-6'],
      );

      loadBalancer.acquireConnection(WRITE).catch(error => {
        expect(error.code).toEqual(SERVICE_UNAVAILABLE);

        expectRoutingTable(loadBalancer,
          ['server-1'], // only server-1 is in the table, it returned a routing table which turned out to be invalid
          ['server-4', 'server-5'],
          ['server-6'],
        );

        done();
      });
    });
  });

  it('fails when existing routers fail and resolved seed router returns an invalid routing table', done => {
    const illegalRoutingTable = newRoutingTable(
      ['server-A', 'server-B'],
      ['server-C', 'server-D'],
      [] // no writers - table is illegal and should be skipped
    );

    const loadBalancer = newLoadBalancerWithSeedRouter(
      'server-0', ['server-01'], // seed router address resolves to a different one
      ['server-1', 'server-2'],
      ['server-3'],
      ['server-4'],
      int(0), // expired routing table
      {
        'server-1': null, // returns no routing table
        'server-2': illegalRoutingTable,
        'server-01': null // returns no routing table
      }
    );

    loadBalancer.acquireConnection(WRITE).catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE);

      expectRoutingTable(loadBalancer,
        ['server-2'], // only server-2 is in the table, it returned a routing table which turned out to be invalid
        ['server-3'],
        ['server-4'],
      );

      loadBalancer.acquireConnection(READ).catch(error => {
        expect(error.code).toEqual(SERVICE_UNAVAILABLE);

        expectRoutingTable(loadBalancer,
          ['server-2'], // only server-2 is in the table, it returned a routing table which turned out to be invalid
          ['server-3'],
          ['server-4'],
        );

        done();
      });
    });
  });

  it('fails when existing routers fail and all resolved seed routers return an invalid routing table', done => {
    const illegalRoutingTable = newRoutingTable(
      ['server-A', 'server-B'],
      ['server-C', 'server-D'],
      [] // no writers - table is illegal and should be skipped
    );

    const loadBalancer = newLoadBalancerWithSeedRouter(
      'server-0', ['server-02', 'server-01'], // seed router address resolves to 2 different addresses
      ['server-1', 'server-2', 'server-3'],
      ['server-4'],
      ['server-5'],
      int(0), // expired routing table
      {
        'server-1': null, // returns no routing table
        'server-2': null, // returns no routing table
        'server-3': null, // returns no routing table
        'server-01': illegalRoutingTable,
        'server-02': null // returns no routing table
      }
    );

    loadBalancer.acquireConnection(READ).catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE);

      expectRoutingTable(loadBalancer,
        [], // all known seed servers failed to return routing tables and were forgotten
        ['server-4'],
        ['server-5'],
      );

      loadBalancer.acquireConnection(WRITE).catch(error => {
        expect(error.code).toEqual(SERVICE_UNAVAILABLE);

        expectRoutingTable(loadBalancer,
          [], // all known seed servers failed to return routing tables and were forgotten
          ['server-4'],
          ['server-5'],
        );

        done();
      });
    });
  });

  it('uses seed router when no existing routers', done => {
    const updatedRoutingTable = newRoutingTable(
      ['server-A', 'server-B'],
      ['server-C'],
      ['server-D']
    );

    const loadBalancer = newLoadBalancerWithSeedRouter(
      'server-0', ['server-0'], // seed router address resolves just to itself
      [], // no routers in the known routing table
      ['server-1', 'server-2'],
      ['server-3'],
      Integer.MAX_VALUE, // not expired
      {
        'server-0': updatedRoutingTable
      }
    );

    loadBalancer.acquireConnection(WRITE).then(connection1 => {
      expect(connection1.address).toEqual('server-D');

      loadBalancer.acquireConnection(READ).then(connection2 => {
        expect(connection2.address).toEqual('server-C');

        expectRoutingTable(loadBalancer,
          ['server-A', 'server-B'],
          ['server-C'],
          ['server-D']
        );
        done();
      });
    });
  });

  it('uses resolved seed router when no existing routers', done => {
    const updatedRoutingTable = newRoutingTable(
      ['server-A', 'server-B'],
      ['server-C', 'server-D'],
      ['server-F', 'server-E']
    );

    const loadBalancer = newLoadBalancerWithSeedRouter(
      'server-0', ['server-01'], // seed router address resolves to a different one
      [], // no routers in the known routing table
      ['server-1', 'server-2'],
      ['server-3', 'server-4'],
      Integer.MAX_VALUE, // not expired
      {
        'server-01': updatedRoutingTable
      }
    );

    loadBalancer.acquireConnection(READ).then(connection1 => {
      expect(connection1.address).toEqual('server-C');

      loadBalancer.acquireConnection(WRITE).then(connection2 => {
        expect(connection2.address).toEqual('server-F');

        expectRoutingTable(loadBalancer,
          ['server-A', 'server-B'],
          ['server-C', 'server-D'],
          ['server-F', 'server-E']
        );
        done();
      });
    });
  });

  it('uses resolved seed router that returns correct routing table when no existing routers exist', done => {
    const illegalRoutingTable = newRoutingTable(
      ['server-A'],
      ['server-B'],
      [] // no writers - table is illegal and should be skipped
    );
    const updatedRoutingTable = newRoutingTable(
      ['server-A', 'server-B', 'server-C'],
      ['server-D', 'server-E'],
      ['server-F']
    );

    const loadBalancer = newLoadBalancerWithSeedRouter(
      'server-0', ['server-02', 'server-01', 'server-03'], // seed router address resolves to 3 different addresses
      [], // no routers in the known routing table
      ['server-1'],
      ['server-2', 'server-3'],
      Integer.MAX_VALUE, // not expired
      {
        'server-01': null,
        'server-02': illegalRoutingTable,
        'server-03': updatedRoutingTable
      }
    );

    loadBalancer.acquireConnection(WRITE).then(connection1 => {
      expect(connection1.address).toEqual('server-F');

      loadBalancer.acquireConnection(READ).then(connection2 => {
        expect(connection2.address).toEqual('server-D');

        expectRoutingTable(loadBalancer,
          ['server-A', 'server-B', 'server-C'],
          ['server-D', 'server-E'],
          ['server-F']
        );
        done();
      });
    });
  });

  it('ignores already probed routers after seed router resolution', done => {
    const illegalRoutingTable = newRoutingTable(
      ['server-A'],
      ['server-B'],
      [] // no writers - table is illegal and should be skipped
    );
    const updatedRoutingTable = newRoutingTable(
      ['server-A', 'server-B'],
      ['server-C', 'server-D'],
      ['server-E', 'server-F']
    );

    const loadBalancer = newLoadBalancerWithSeedRouter(
      'server-0', ['server-1', 'server-01', 'server-2', 'server-02'], // seed router address resolves to 4 different addresses
      ['server-1', 'server-2'],
      ['server-3', 'server-4'],
      ['server-5', 'server-6'],
      int(0), // expired routing table
      {
        'server-1': null,
        'server-01': null,
        'server-2': illegalRoutingTable,
        'server-02': updatedRoutingTable
      }
    );
    const usedRouterArrays = [];
    setupLoadBalancerToRememberRouters(loadBalancer, usedRouterArrays);

    loadBalancer.acquireConnection(READ).then(connection1 => {
      expect(connection1.address).toEqual('server-C');

      loadBalancer.acquireConnection(WRITE).then(connection2 => {
        expect(connection2.address).toEqual('server-E');

        // two sets of routers probed:
        // 1) existing routers 'server-1' & 'server-2'
        // 2) resolved routers 'server-01' & 'server-02'
        expect(usedRouterArrays.length).toEqual(2);
        expect(usedRouterArrays[0]).toEqual(['server-1', 'server-2']);
        expect(usedRouterArrays[1]).toEqual(['server-01', 'server-02']);

        expectRoutingTable(loadBalancer,
          ['server-A', 'server-B'],
          ['server-C', 'server-D'],
          ['server-E', 'server-F']
        );
        done();
      });
    });
  });

  it('throws service unavailable when refreshed routing table has no readers', done => {
    const pool = newPool();
    const updatedRoutingTable = newRoutingTable(
      ['server-A', 'server-B'],
      [],
      ['server-C', 'server-D']
    );
    const loadBalancer = newLoadBalancer(
      ['server-1', 'server-2'],
      ['server-3', 'server-4'],
      ['server-5', 'server-6'],
      pool,
      int(0), // expired routing table
      {
        'server-1': updatedRoutingTable,
      }
    );

    loadBalancer.acquireConnection(READ).catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE);
      done();
    });
  });

});

function newDirectConnectionProvider(address, pool) {
  return new DirectConnectionProvider(address, pool, NO_OP_DRIVER_CALLBACK);
}

function newLoadBalancer(routers, readers, writers,
                         pool = null,
                         expirationTime = Integer.MAX_VALUE,
                         routerToRoutingTable = {}) {
  const seedRouter = 'server-non-existing-seed-router';
  return newLoadBalancerWithSeedRouter(seedRouter, [seedRouter], routers, readers, writers, expirationTime,
    routerToRoutingTable, pool);
}

function newLoadBalancerWithSeedRouter(seedRouter, seedRouterResolved,
                                       routers, readers, writers,
                                       expirationTime = Integer.MAX_VALUE,
                                       routerToRoutingTable = {},
                                       connectionPool = null) {
  const loadBalancer = new LoadBalancer(seedRouter, {}, connectionPool || newPool(), NO_OP_DRIVER_CALLBACK);
  loadBalancer._routingTable = new RoutingTable(
    new RoundRobinArray(routers),
    new RoundRobinArray(readers),
    new RoundRobinArray(writers),
    expirationTime
  );
  loadBalancer._rediscovery = new FakeRediscovery(routerToRoutingTable);
  loadBalancer._hostNameResolver = new FakeDnsResolver(seedRouterResolved);
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

function setupLoadBalancerToRememberRouters(loadBalancer, routersArray) {
  const originalFetch = loadBalancer._fetchNewRoutingTable.bind(loadBalancer);
  const rememberingFetch = (routerAddresses, routingTable) => {
    routersArray.push(routerAddresses);
    return originalFetch(routerAddresses, routingTable);
  };
  loadBalancer._fetchNewRoutingTable = rememberingFetch;
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

class FakeDnsResolver {

  constructor(addresses) {
    this._addresses = addresses;
  }

  resolve(seedRouter) {
    return Promise.resolve(this._addresses ? this._addresses : [seedRouter]);
  }
}

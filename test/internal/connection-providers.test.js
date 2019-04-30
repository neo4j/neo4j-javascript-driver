/**
 * Copyright (c) 2002-2019 "Neo4j,"
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

import {READ, WRITE} from '../../src/v1/driver';
import Integer, {int} from '../../src/v1/integer';
import {SERVICE_UNAVAILABLE, SESSION_EXPIRED} from '../../src/v1/error';
import RoutingTable from '../../src/v1/internal/routing-table';
import {DirectConnectionProvider, LoadBalancer} from '../../src/v1/internal/connection-providers';
import Pool from '../../src/v1/internal/pool';
import LeastConnectedLoadBalancingStrategy from '../../src/v1/internal/least-connected-load-balancing-strategy';
import Logger from '../../src/v1/internal/logger';
import SimpleHostNameResolver from '../../src/v1/internal/browser/browser-host-name-resolver';
import ServerAddress from '../../src/v1/internal/server-address';

const NO_OP_DRIVER_CALLBACK = () => {
};

describe('DirectConnectionProvider', () => {

  it('acquires connection from the pool', done => {
    const address = ServerAddress.fromUrl('localhost:123');
    const pool = newPool();
    const connectionProvider = newDirectConnectionProvider(address, pool);

    connectionProvider.acquireConnection(READ).then(connection => {
      expect(connection).toBeDefined();
      expect(connection.address).toEqual(address);
      expect(connection.release).toBeDefined();
      expect(pool.has(address)).toBeTruthy();

      done();
    });
  });

});

describe('LoadBalancer', () => {
  const server0 = ServerAddress.fromUrl('server0');
  const server1 = ServerAddress.fromUrl('server1');
  const server2 = ServerAddress.fromUrl('server2');
  const server3 = ServerAddress.fromUrl('server3');
  const server4 = ServerAddress.fromUrl('server4');
  const server5 = ServerAddress.fromUrl('server5');
  const server6 = ServerAddress.fromUrl('server6');
  const server7 = ServerAddress.fromUrl('server7');
  const server42 = ServerAddress.fromUrl('server42');

  const server01 = ServerAddress.fromUrl('server01');
  const server02 = ServerAddress.fromUrl('server02');
  const server03 = ServerAddress.fromUrl('server03');

  const serverA = ServerAddress.fromUrl('serverA');
  const serverB = ServerAddress.fromUrl('serverB');
  const serverC = ServerAddress.fromUrl('serverC');
  const serverD = ServerAddress.fromUrl('serverD');
  const serverE = ServerAddress.fromUrl('serverE');
  const serverF = ServerAddress.fromUrl('serverF');
  const serverG = ServerAddress.fromUrl('serverG');

  const serverAA = ServerAddress.fromUrl('serverAA');
  const serverBB = ServerAddress.fromUrl('serverBB');
  const serverCC = ServerAddress.fromUrl('serverCC');
  const serverDD = ServerAddress.fromUrl('serverDD');
  const serverEE = ServerAddress.fromUrl('serverEE');

  const serverABC = ServerAddress.fromUrl('serverABC');

  it('can forget address', () => {
    const loadBalancer = newLoadBalancer(
      [server1, server2],
      [server3, server2],
      [server2, server4]
    );

    loadBalancer.forget(server2);

    expectRoutingTable(loadBalancer,
      [server1, server2],
      [server3],
      [server4]
    );
  });

  it('can not forget unknown address', () => {
    const loadBalancer = newLoadBalancer(
      [server1, server2],
      [server3, server4],
      [server5, server6]
    );

    loadBalancer.forget(server42);

    expectRoutingTable(loadBalancer,
      [server1, server2],
      [server3, server4],
      [server5, server6]
    );
  });

  it('purges connections when address is forgotten', () => {
    const pool = newPool();

    pool.acquire(server1);
    pool.acquire(server3);
    pool.acquire(server5);
    expectPoolToContain(pool, [server1, server3, server5]);

    const loadBalancer = newLoadBalancer(
      [server1, server2],
      [server3, server2],
      [server2, server4],
      pool
    );

    loadBalancer.forget(server1);
    loadBalancer.forget(server5);

    expectPoolToContain(pool, [server3]);
    expectPoolToNotContain(pool, [server1, server5]);
  });

  it('can forget writer address', () => {
    const loadBalancer = newLoadBalancer(
      [server1, server2],
      [server3, server2],
      [server2, server4]
    );

    loadBalancer.forgetWriter(server2);

    expectRoutingTable(loadBalancer,
      [server1, server2],
      [server3, server2],
      [server4]
    );
  });

  it('can not forget unknown writer address', () => {
    const loadBalancer = newLoadBalancer(
      [server1, server2],
      [server3, server4],
      [server5, server6]
    );

    loadBalancer.forgetWriter(server42);

    expectRoutingTable(loadBalancer,
      [server1, server2],
      [server3, server4],
      [server5, server6]
    );
  });

  it('initializes routing table with the given router', () => {
    const connectionPool = newPool();
    const loadBalancingStrategy = new LeastConnectedLoadBalancingStrategy(connectionPool);
    const loadBalancer = new LoadBalancer(serverABC, {}, connectionPool, loadBalancingStrategy, new SimpleHostNameResolver(),
      NO_OP_DRIVER_CALLBACK, Logger.noOp());

    expectRoutingTable(loadBalancer,
      [serverABC],
      [],
      []
    );
  });

  it('acquires read connection with up-to-date routing table', done => {
    const pool = newPool();
    const loadBalancer = newLoadBalancer(
      [server1, server2],
      [server3, server4],
      [server5, server6],
      pool
    );

    loadBalancer.acquireConnection(READ).then(connection => {
      expect(connection.address).toEqual(server3);
      expect(pool.has(server3)).toBeTruthy();

      loadBalancer.acquireConnection(READ).then(connection => {
        expect(connection.address).toEqual(server4);
        expect(pool.has(server4)).toBeTruthy();

        done();
      });
    });
  });

  it('acquires write connection with up-to-date routing table', done => {
    const pool = newPool();
    const loadBalancer = newLoadBalancer(
      [server1, server2],
      [server3, server4],
      [server5, server6],
      pool
    );

    loadBalancer.acquireConnection(WRITE).then(connection => {
      expect(connection.address).toEqual(server5);
      expect(pool.has(server5)).toBeTruthy();

      loadBalancer.acquireConnection(WRITE).then(connection => {
        expect(connection.address).toEqual(server6);
        expect(pool.has(server6)).toBeTruthy();

        done();
      });
    });
  });

  it('throws for illegal access mode', done => {
    const loadBalancer = newLoadBalancer(
      [server1, server2],
      [server3, server4],
      [server5, server6]
    );

    loadBalancer.acquireConnection('WRONG').catch(error => {
      expect(error.message).toEqual('Illegal mode WRONG');
      done();
    });
  });

  it('refreshes stale routing table to get read connection', done => {
    const pool = newPool();
    const updatedRoutingTable = newRoutingTable(
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    );
    const loadBalancer = newLoadBalancer(
      [server1, server2],
      [server3, server4],
      [server5, server6],
      pool,
      int(0), // expired routing table
      { 'server1:7687': updatedRoutingTable }
    );

    loadBalancer.acquireConnection(READ).then(connection => {
      expect(connection.address).toEqual(serverC);
      expect(pool.has(serverC)).toBeTruthy();

      loadBalancer.acquireConnection(READ).then(connection => {
        expect(connection.address).toEqual(serverD);
        expect(pool.has(serverD)).toBeTruthy();

        done();
      });
    });
  });

  it('refreshes stale routing table to get write connection', done => {
    const pool = newPool();
    const updatedRoutingTable = newRoutingTable(
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    );
    const loadBalancer = newLoadBalancer(
      [server1, server2],
      [server3, server4],
      [server5, server6],
      pool,
      int(0), // expired routing table
      { 'server1:7687': updatedRoutingTable }
    );

    loadBalancer.acquireConnection(WRITE).then(connection => {
      expect(connection.address).toEqual(serverE);
      expect(pool.has(serverE)).toBeTruthy();

      loadBalancer.acquireConnection(WRITE).then(connection => {
        expect(connection.address).toEqual(serverF);
        expect(pool.has(serverF)).toBeTruthy();

        done();
      });
    });
  });

  it('refreshes stale routing table to get read connection when one router fails', done => {
    const pool = newPool();
    const updatedRoutingTable = newRoutingTable(
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    );
    const loadBalancer = newLoadBalancer(
      [server1, server2],
      [server3, server4],
      [server5, server6],
      pool,
      int(0), // expired routing table
      {
        'server1:7687': null, // returns no routing table
        'server2:7687': updatedRoutingTable,
      }
    );

    loadBalancer.acquireConnection(READ).then(connection => {
      expect(connection.address).toEqual(serverC);
      expect(pool.has(serverC)).toBeTruthy();

      loadBalancer.acquireConnection(READ).then(connection => {
        expect(connection.address).toEqual(serverD);
        expect(pool.has(serverD)).toBeTruthy();

        done();
      });
    });
  });

  it('refreshes stale routing table to get write connection when one router fails', done => {
    const pool = newPool();
    const updatedRoutingTable = newRoutingTable(
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    );
    const loadBalancer = newLoadBalancer(
      [server1, server2],
      [server3, server4],
      [server5, server6],
      pool,
      int(0), // expired routing table
      {
        'server1:7687': null, // returns no routing table
        'server2:7687': updatedRoutingTable,
      }
    );

    loadBalancer.acquireConnection(WRITE).then(connection => {
      expect(connection.address).toEqual(serverE);
      expect(pool.has(serverE)).toBeTruthy();

      loadBalancer.acquireConnection(WRITE).then(connection => {
        expect(connection.address).toEqual(serverF);
        expect(pool.has(serverF)).toBeTruthy();

        done();
      });
    });
  });

  it('refreshes routing table without readers to get read connection', done => {
    const pool = newPool();
    const updatedRoutingTable = newRoutingTable(
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    );
    const loadBalancer = newLoadBalancer(
      [server1, server2],
      [], // no readers
      [server3, server4],
      pool,
      Integer.MAX_VALUE,
      {
        'server1:7687': null, // returns no routing table
        'server2:7687': updatedRoutingTable,
      }
    );

    loadBalancer.acquireConnection(READ).then(connection => {
      expect(connection.address).toEqual(serverC);
      expect(pool.has(serverC)).toBeTruthy();

      loadBalancer.acquireConnection(READ).then(connection => {
        expect(connection.address).toEqual(serverD);
        expect(pool.has(serverD)).toBeTruthy();

        done();
      });
    });
  });

  it('refreshes routing table without writers to get write connection', done => {
    const pool = newPool();
    const updatedRoutingTable = newRoutingTable(
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    );
    const loadBalancer = newLoadBalancer(
      [server1, server2],
      [server3, server4],
      [], // no writers
      pool,
      int(0), // expired routing table
      {
        'server1:7687': null, // returns no routing table
        'server2:7687': updatedRoutingTable,
      }
    );

    loadBalancer.acquireConnection(WRITE).then(connection => {
      expect(connection.address).toEqual(serverE);
      expect(pool.has(serverE)).toBeTruthy();

      loadBalancer.acquireConnection(WRITE).then(connection => {
        expect(connection.address).toEqual(serverF);
        expect(pool.has(serverF)).toBeTruthy();

        done();
      });
    });
  });

  it('throws when all routers return nothing while getting read connection', done => {
    const loadBalancer = newLoadBalancer(
      [server1, server2],
      [server3, server4],
      [server5, server6],
      newPool(),
      int(0), // expired routing table
      {
        'server1:7687': null, // returns no routing table
        'server2:7687': null  // returns no routing table
      }
    );

    loadBalancer.acquireConnection(READ).catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE);
      done();
    });
  });

  it('throws when all routers return nothing while getting write connection', done => {
    const loadBalancer = newLoadBalancer(
      [server1, server2],
      [server3, server4],
      [server5, server6],
      newPool(),
      int(0), // expired routing table
      {
        'server1:7687': null, // returns no routing table
        'server2:7687': null  // returns no routing table
      }
    );

    loadBalancer.acquireConnection(WRITE).catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE);
      done();
    });
  });

  it('throws when all routers return routing tables without readers while getting read connection', done => {
    const updatedRoutingTable = newRoutingTable(
      [serverA, serverB],
      [], // no readers - table can't satisfy connection requirement
      [serverC, serverD]
    );
    const loadBalancer = newLoadBalancer(
      [server1, server2],
      [server3, server4],
      [server5, server6],
      newPool(),
      int(0), // expired routing table
      {
        'server1:7687': updatedRoutingTable,
        'server2:7687': updatedRoutingTable
      }
    );

    loadBalancer.acquireConnection(READ).catch(error => {
      expect(error.code).toEqual(SESSION_EXPIRED);
      done();
    });
  });

  it('throws when all routers return routing tables without writers while getting write connection', done => {
    const updatedRoutingTable = newRoutingTable(
      [serverA, serverB],
      [serverC, serverD],
      [] // no writers - table can't satisfy connection requirement
    );
    const loadBalancer = newLoadBalancer(
      [server1, server2],
      [server3, server4],
      [server5, server6],
      newPool(),
      int(0), // expired routing table
      {
        'server1:7687': updatedRoutingTable,
        'server2:7687': updatedRoutingTable
      }
    );

    loadBalancer.acquireConnection(WRITE).catch(error => {
      expect(error.code).toEqual(SESSION_EXPIRED);
      done();
    });
  });

  it('throws when stale routing table without routers while getting read connection', done => {
    const loadBalancer = newLoadBalancer(
      [], // no routers
      [server3, server4],
      [server5, server6],
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
      [server3, server4],
      [server5, server6],
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
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    );
    const loadBalancer = newLoadBalancer(
      [server1, server2],
      [server3, server4],
      [server5, server6],
      pool,
      int(0), // expired routing table
      {
        'server1:7687': updatedRoutingTable
      }
    );

    loadBalancer.acquireConnection(READ).then(() => {
      expectRoutingTable(loadBalancer,
        [serverA, serverB],
        [serverC, serverD],
        [serverE, serverF]
      );
      expectPoolToNotContain(pool, [server1, server2, server3, server4, server5, server6]);
      done();
    });
  });

  it('forgets all routers when they fail while acquiring read connection', done => {
    const loadBalancer = newLoadBalancer(
      [server1, server2, server3],
      [server4, server5],
      [server6, server7],
      newPool(),
      int(0) // expired routing table
    );

    loadBalancer.acquireConnection(READ).catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE);
      expectRoutingTable(loadBalancer,
        [],
        [server4, server5],
        [server6, server7]
      );
      done();
    });
  });

  it('forgets all routers when they fail while acquiring write connection', done => {
    const loadBalancer = newLoadBalancer(
      [server1, server2, server3],
      [server4, server5],
      [server6, server7],
      newPool(),
      int(0) // expired routing table
    );

    loadBalancer.acquireConnection(WRITE).catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE);
      expectRoutingTable(loadBalancer,
        [],
        [server4, server5],
        [server6, server7]
      );
      done();
    });
  });

  it('uses seed router address when all existing routers fail', done => {
    const updatedRoutingTable = newRoutingTable(
      [serverA, serverB, serverC],
      [serverD, serverE],
      [serverF, serverG]
    );

    const loadBalancer = newLoadBalancerWithSeedRouter(
      server0, [server0], // seed router address resolves just to itself
      [server1, server2, server3],
      [server4, server5],
      [server6, server7],
      int(0), // expired routing table
      {
        'server1:7687': null, // returns no routing table
        'server2:7687': null, // returns no routing table
        'server3:7687': null, // returns no routing table
        'server0:7687': updatedRoutingTable
      }
    );

    loadBalancer.acquireConnection(READ).then(connection1 => {
      expect(connection1.address).toEqual(serverD);

      loadBalancer.acquireConnection(WRITE).then(connection2 => {
        expect(connection2.address).toEqual(serverF);

        expectRoutingTable(loadBalancer,
          [serverA, serverB, serverC],
          [serverD, serverE],
          [serverF, serverG]
        );
        done();
      });
    });
  });

  it('uses resolved seed router address when all existing routers fail', done => {
    const updatedRoutingTable = newRoutingTable(
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    );

    const loadBalancer = newLoadBalancerWithSeedRouter(
      server0, [server01], // seed router address resolves to a different one
      [server1, server2, server3],
      [server4, server5],
      [server6, server7],
      int(0), // expired routing table
      {
        'server1:7687': null, // returns no routing table
        'server2:7687': null, // returns no routing table
        'server3:7687': null, // returns no routing table
        'server01:7687': updatedRoutingTable
      }
    );

    loadBalancer.acquireConnection(WRITE).then(connection1 => {
      expect(connection1.address).toEqual(serverE);

      loadBalancer.acquireConnection(READ).then(connection2 => {
        expect(connection2.address).toEqual(serverC);

        expectRoutingTable(loadBalancer,
          [serverA, serverB],
          [serverC, serverD],
          [serverE, serverF]
        );
        done();
      });
    });
  });

  it('uses resolved seed router address that returns correct routing table when all existing routers fail', done => {
    const updatedRoutingTable = newRoutingTable(
      [serverA, serverB],
      [serverC],
      [serverD, serverE]
    );

    const loadBalancer = newLoadBalancerWithSeedRouter(
      server0, [server01, server02, server03], // seed router address resolves to 3 different addresses
      [server1],
      [server2],
      [server3],
      int(0), // expired routing table
      {
        'server1:7687': null, // returns no routing table
        'server01:7687': null, // returns no routing table
        'server02:7687': null, // returns no routing table
        'server03:7687': updatedRoutingTable
      }
    );

    loadBalancer.acquireConnection(WRITE).then(connection1 => {
      expect(connection1.address).toEqual(serverD);

      loadBalancer.acquireConnection(WRITE).then(connection2 => {
        expect(connection2.address).toEqual(serverE);

        expectRoutingTable(loadBalancer,
          [serverA, serverB],
          [serverC],
          [serverD, serverE]
        );
        done();
      });
    });
  });

  it('fails when both existing routers and seed router fail to return a routing table', done => {
    const loadBalancer = newLoadBalancerWithSeedRouter(
      server0, [server0], // seed router address resolves just to itself
      [server1, server2, server3],
      [server4, server5],
      [server6],
      int(0), // expired routing table
      {
        'server1:7687': null, // returns no routing table
        'server2:7687': null, // returns no routing table
        'server3:7687': null, // returns no routing table
        'server0:7687': null // returns no routing table
      }
    );

    loadBalancer.acquireConnection(READ).catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE);

      expectRoutingTable(loadBalancer,
        [], // all routers were forgotten because they failed
        [server4, server5],
        [server6],
      );

      loadBalancer.acquireConnection(WRITE).catch(error => {
        expect(error.code).toEqual(SERVICE_UNAVAILABLE);

        expectRoutingTable(loadBalancer,
          [], // all routers were forgotten because they failed
          [server4, server5],
          [server6],
        );

        done();
      });
    });
  });

  it('fails when both existing routers and resolved seed router fail to return a routing table', done => {
    const loadBalancer = newLoadBalancerWithSeedRouter(
      server0, [server01], // seed router address resolves to a different one
      [server1, server2],
      [server3],
      [server4],
      int(0), // expired routing table
      {
        'server1:7687': null, // returns no routing table
        'server2:7687': null, // returns no routing table
        'server01:7687': null // returns no routing table
      }
    );

    loadBalancer.acquireConnection(WRITE).catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE);

      expectRoutingTable(loadBalancer,
        [], // all routers were forgotten because they failed
        [server3],
        [server4],
      );

      loadBalancer.acquireConnection(READ).catch(error => {
        expect(error.code).toEqual(SERVICE_UNAVAILABLE);

        expectRoutingTable(loadBalancer,
          [], // all routers were forgotten because they failed
          [server3],
          [server4],
        );

        done();
      });
    });
  });

  it('fails when both existing routers and all resolved seed routers fail to return a routing table', done => {
    const loadBalancer = newLoadBalancerWithSeedRouter(
      server0, [server02, server01], // seed router address resolves to 2 different addresses
      [server1, server2, server3],
      [server4],
      [server5],
      int(0), // expired routing table
      {
        'server1:7687': null, // returns no routing table
        'server2:7687': null, // returns no routing table
        'server3:7687': null, // returns no routing table
        'server01:7687': null, // returns no routing table
        'server02:7687': null // returns no routing table
      }
    );

    loadBalancer.acquireConnection(READ).catch(error => {
      expect(error.code).toEqual(SERVICE_UNAVAILABLE);

      expectRoutingTable(loadBalancer,
        [], // all known seed servers failed to return routing tables and were forgotten
        [server4],
        [server5],
      );

      loadBalancer.acquireConnection(WRITE).catch(error => {
        expect(error.code).toEqual(SERVICE_UNAVAILABLE);

        expectRoutingTable(loadBalancer,
          [], // all known seed servers failed to return routing tables and were forgotten
          [server4],
          [server5],
        );

        done();
      });
    });
  });

  it('uses seed router when no existing routers', done => {
    const updatedRoutingTable = newRoutingTable(
      [serverA, serverB],
      [serverC],
      [serverD]
    );

    const loadBalancer = newLoadBalancerWithSeedRouter(
      server0, [server0], // seed router address resolves just to itself
      [], // no routers in the known routing table
      [server1, server2],
      [server3],
      Integer.MAX_VALUE, // not expired
      {
        'server0:7687': updatedRoutingTable
      }
    );

    loadBalancer.acquireConnection(WRITE).then(connection1 => {
      expect(connection1.address).toEqual(serverD);

      loadBalancer.acquireConnection(READ).then(connection2 => {
        expect(connection2.address).toEqual(serverC);

        expectRoutingTable(loadBalancer,
          [serverA, serverB],
          [serverC],
          [serverD]
        );
        done();
      });
    });
  });

  it('uses resolved seed router when no existing routers', done => {
    const updatedRoutingTable = newRoutingTable(
      [serverA, serverB],
      [serverC, serverD],
      [serverF, serverE]
    );

    const loadBalancer = newLoadBalancerWithSeedRouter(
      server0, [server01], // seed router address resolves to a different one
      [], // no routers in the known routing table
      [server1, server2],
      [server3, server4],
      Integer.MAX_VALUE, // not expired
      {
        'server01:7687': updatedRoutingTable
      }
    );

    loadBalancer.acquireConnection(READ).then(connection1 => {
      expect(connection1.address).toEqual(serverC);

      loadBalancer.acquireConnection(WRITE).then(connection2 => {
        expect(connection2.address).toEqual(serverF);

        expectRoutingTable(loadBalancer,
          [serverA, serverB],
          [serverC, serverD],
          [serverF, serverE]
        );
        done();
      });
    });
  });

  it('uses resolved seed router that returns routing table when no existing routers exist', done => {
    const updatedRoutingTable = newRoutingTable(
      [serverA, serverB, serverC],
      [serverD, serverE],
      [serverF]
    );

    const loadBalancer = newLoadBalancerWithSeedRouter(
      server0, [server02, server01, server03], // seed router address resolves to 3 different addresses
      [], // no routers in the known routing table
      [server1],
      [server2, server3],
      Integer.MAX_VALUE, // not expired
      {
        'server01:7687': null, // returns no routing table
        'server02:7687': null, // returns no routing table
        'server03:7687': updatedRoutingTable
      }
    );

    loadBalancer.acquireConnection(WRITE).then(connection1 => {
      expect(connection1.address).toEqual(serverF);

      loadBalancer.acquireConnection(READ).then(connection2 => {
        expect(connection2.address).toEqual(serverD);

        expectRoutingTable(loadBalancer,
          [serverA, serverB, serverC],
          [serverD, serverE],
          [serverF]
        );
        done();
      });
    });
  });

  it('ignores already probed routers after seed router resolution', done => {
    const updatedRoutingTable = newRoutingTable(
      [serverA, serverB],
      [serverC, serverD],
      [serverE, serverF]
    );

    const loadBalancer = newLoadBalancerWithSeedRouter(
      server0, [server1, server01, server2, server02], // seed router address resolves to 4 different addresses
      [server1, server2],
      [server3, server4],
      [server5, server6],
      int(0), // expired routing table
      {
        'server1:7687': null, // returns no routing table
        'server01:7687': null, // returns no routing table
        'server2:7687': null, // returns no routing table
        'server02:7687': updatedRoutingTable
      }
    );
    const usedRouterArrays = [];
    setupLoadBalancerToRememberRouters(loadBalancer, usedRouterArrays);

    loadBalancer.acquireConnection(READ).then(connection1 => {
      expect(connection1.address).toEqual(serverC);

      loadBalancer.acquireConnection(WRITE).then(connection2 => {
        expect(connection2.address).toEqual(serverE);

        // two sets of routers probed:
        // 1) existing routers server1 & server2
        // 2) resolved routers server01 & server02
        expect(usedRouterArrays.length).toEqual(2);
        expect(usedRouterArrays[0]).toEqual([server1, server2]);
        expect(usedRouterArrays[1]).toEqual([server01, server02]);

        expectRoutingTable(loadBalancer,
          [serverA, serverB],
          [serverC, serverD],
          [serverE, serverF]
        );
        done();
      });
    });
  });

  it('throws session expired when refreshed routing table has no readers', done => {
    const pool = newPool();
    const updatedRoutingTable = newRoutingTable(
      [serverA, serverB],
      [], // no readers
      [serverC, serverD]
    );
    const loadBalancer = newLoadBalancer(
      [server1, server2],
      [server3, server4],
      [server5, server6],
      pool,
      int(0), // expired routing table
      {
        'server1:7687': updatedRoutingTable,
      }
    );

    loadBalancer.acquireConnection(READ).catch(error => {
      expect(error.code).toEqual(SESSION_EXPIRED);
      done();
    });
  });

  it('throws session expired when refreshed routing table has no writers', done => {
    const pool = newPool();
    const updatedRoutingTable = newRoutingTable(
      [serverA, serverB],
      [serverC, serverD],
      [] // no writers
    );
    const loadBalancer = newLoadBalancer(
      [server1, server2],
      [server3, server4],
      [server5, server6],
      pool,
      int(0), // expired routing table
      {
        'server1:7687': updatedRoutingTable,
      }
    );

    loadBalancer.acquireConnection(WRITE).catch(error => {
      expect(error.code).toEqual(SESSION_EXPIRED);
      done();
    });
  });

  it('should use resolved seed router after accepting table with no writers', done => {
    const routingTable1 = newRoutingTable(
      [serverA, serverB],
      [serverC, serverD],
      [] // no writers
    );
    const routingTable2 = newRoutingTable(
      [serverAA, serverBB],
      [serverCC, serverDD],
      [serverEE]
    );

    const loadBalancer = newLoadBalancerWithSeedRouter(
      server0, [server02, server01], // seed router address resolves to 2 different addresses
      [server1],
      [server2, server3],
      [server4, server5],
      int(0), // expired routing table
      {
        'server1:7687': routingTable1,
        'serverA:7687': routingTable1,
        'serverB:7687': routingTable1,
        'server01:7687': null, // returns no routing table
        'server02:7687': routingTable2
      }
    );

    loadBalancer.acquireConnection(READ).then(connection1 => {
      expect(connection1.address).toEqual(serverC);

      loadBalancer.acquireConnection(READ).then(connection2 => {
        expect(connection2.address).toEqual(serverD);

        expectRoutingTable(loadBalancer,
          [serverA, serverB],
          [serverC, serverD],
          []
        );

        loadBalancer.acquireConnection(WRITE).then(connection3 => {
          expect(connection3.address).toEqual(serverEE);

          expectRoutingTable(loadBalancer,
            [serverAA, serverBB],
            [serverCC, serverDD],
            [serverEE]
          );

          done();
        });
      });
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
  const seedRouter = ServerAddress.fromUrl('server-non-existing-seed-router');
  return newLoadBalancerWithSeedRouter(seedRouter, [seedRouter], routers, readers, writers, expirationTime,
    routerToRoutingTable, pool);
}

function newLoadBalancerWithSeedRouter(seedRouter, seedRouterResolved,
                                       routers, readers, writers,
                                       expirationTime = Integer.MAX_VALUE,
                                       routerToRoutingTable = {},
                                       connectionPool = null) {
  const pool = connectionPool || newPool();
  const loadBalancingStrategy = new LeastConnectedLoadBalancingStrategy(pool);
  const loadBalancer = new LoadBalancer(seedRouter, {}, pool, loadBalancingStrategy, new SimpleHostNameResolver(),
    NO_OP_DRIVER_CALLBACK, Logger.noOp());
  loadBalancer._routingTable = new RoutingTable(routers, readers, writers, expirationTime);
  loadBalancer._rediscovery = new FakeRediscovery(routerToRoutingTable);
  loadBalancer._hostNameResolver = new FakeDnsResolver(seedRouterResolved);
  return loadBalancer;
}

function newRoutingTable(routers, readers, writers, expirationTime = Integer.MAX_VALUE) {
  return new RoutingTable(routers, readers, writers, expirationTime);
}

function setupLoadBalancerToRememberRouters(loadBalancer, routersArray) {
  const originalFetch = loadBalancer._fetchRoutingTable.bind(loadBalancer);
  const rememberingFetch = (routerAddresses, routingTable) => {
    routersArray.push(routerAddresses);
    return originalFetch(routerAddresses, routingTable);
  };
  loadBalancer._fetchRoutingTable = rememberingFetch;
}

function newPool() {
  return new Pool((address, release) => Promise.resolve(new FakeConnection(address, release)));
}

function expectRoutingTable(loadBalancer, routers, readers, writers) {
  expect(loadBalancer._routingTable.routers).toEqual(routers);
  expect(loadBalancer._routingTable.readers).toEqual(readers);
  expect(loadBalancer._routingTable.writers).toEqual(writers);
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
}

class FakeRediscovery {

  constructor(routerToRoutingTable) {
    this._routerToRoutingTable = routerToRoutingTable;
  }

  lookupRoutingTableOnRouter(ignored, router) {
    return this._routerToRoutingTable[router.asKey()];
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

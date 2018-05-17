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

import {newError, SERVICE_UNAVAILABLE, SESSION_EXPIRED} from '../error';
import {READ, WRITE} from '../driver';
import Session from '../session';
import RoutingTable from './routing-table';
import Rediscovery from './rediscovery';
import hasFeature from './features';
import {DnsHostNameResolver, DummyHostNameResolver} from './host-name-resolvers';
import RoutingUtil from './routing-util';

class ConnectionProvider {

  acquireConnection(mode) {
    throw new Error('Abstract function');
  }

  _withAdditionalOnErrorCallback(connectionPromise, driverOnErrorCallback) {
    // install error handler from the driver on the connection promise; this callback is installed separately
    // so that it does not handle errors, instead it is just an additional error reporting facility.
    connectionPromise.catch(error => {
      driverOnErrorCallback(error);
    });
    // return the original connection promise
    return connectionPromise;
  }
}

export class DirectConnectionProvider extends ConnectionProvider {

  constructor(hostPort, connectionPool, driverOnErrorCallback) {
    super();
    this._hostPort = hostPort;
    this._connectionPool = connectionPool;
    this._driverOnErrorCallback = driverOnErrorCallback;
  }

  acquireConnection(mode) {
    const connectionPromise = this._connectionPool.acquire(this._hostPort);
    return this._withAdditionalOnErrorCallback(connectionPromise, this._driverOnErrorCallback);
  }
}

export class LoadBalancer extends ConnectionProvider {

  constructor(hostPort, routingContext, connectionPool, loadBalancingStrategy, driverOnErrorCallback) {
    super();
    this._seedRouter = hostPort;
    this._routingTable = new RoutingTable([this._seedRouter]);
    this._rediscovery = new Rediscovery(new RoutingUtil(routingContext));
    this._connectionPool = connectionPool;
    this._driverOnErrorCallback = driverOnErrorCallback;
    this._hostNameResolver = LoadBalancer._createHostNameResolver();
    this._loadBalancingStrategy = loadBalancingStrategy;
    this._useSeedRouter = false;
  }

  acquireConnection(accessMode) {
    const connectionPromise = this._freshRoutingTable(accessMode).then(routingTable => {
      if (accessMode === READ) {
        const address = this._loadBalancingStrategy.selectReader(routingTable.readers);
        return this._acquireConnectionToServer(address, 'read');
      } else if (accessMode === WRITE) {
        const address = this._loadBalancingStrategy.selectWriter(routingTable.writers);
        return this._acquireConnectionToServer(address, 'write');
      } else {
        throw newError('Illegal mode ' + accessMode);
      }
    });
    return this._withAdditionalOnErrorCallback(connectionPromise, this._driverOnErrorCallback);
  }

  forget(address) {
    this._routingTable.forget(address);
    this._connectionPool.purge(address);
  }

  forgetWriter(address) {
    this._routingTable.forgetWriter(address);
  }

  _acquireConnectionToServer(address, serverName) {
    if (!address) {
      return Promise.reject(newError(
        `Failed to obtain connection towards ${serverName} server. Known routing table is: ${this._routingTable}`,
        SESSION_EXPIRED));
    }
    return this._connectionPool.acquire(address);
  }

  _freshRoutingTable(accessMode) {
    const currentRoutingTable = this._routingTable;

    if (!currentRoutingTable.isStaleFor(accessMode)) {
      return Promise.resolve(currentRoutingTable);
    }
    return this._refreshRoutingTable(currentRoutingTable);
  }

  _refreshRoutingTable(currentRoutingTable) {
    const knownRouters = currentRoutingTable.routers;

    if (this._useSeedRouter) {
      return this._fetchRoutingTableFromSeedRouterFallbackToKnownRouters(knownRouters, currentRoutingTable);
    }
    return this._fetchRoutingTableFromKnownRoutersFallbackToSeedRouter(knownRouters, currentRoutingTable);
  }

  _fetchRoutingTableFromSeedRouterFallbackToKnownRouters(knownRouters, currentRoutingTable) {
    // we start with seed router, no routers were probed before
    const seenRouters = [];
    return this._fetchRoutingTableUsingSeedRouter(seenRouters, this._seedRouter).then(newRoutingTable => {
      if (newRoutingTable) {
        this._useSeedRouter = false;
        return newRoutingTable;
      }

      // seed router did not return a valid routing table - try to use other known routers
      return this._fetchRoutingTableUsingKnownRouters(knownRouters, currentRoutingTable);
    }).then(newRoutingTable => {
      this._applyRoutingTableIfPossible(newRoutingTable);
      return newRoutingTable;
    });
  }

  _fetchRoutingTableFromKnownRoutersFallbackToSeedRouter(knownRouters, currentRoutingTable) {
    return this._fetchRoutingTableUsingKnownRouters(knownRouters, currentRoutingTable).then(newRoutingTable => {
      if (newRoutingTable) {
        return newRoutingTable;
      }

      // none of the known routers returned a valid routing table - try to use seed router address for rediscovery
      return this._fetchRoutingTableUsingSeedRouter(knownRouters, this._seedRouter);
    }).then(newRoutingTable => {
      this._applyRoutingTableIfPossible(newRoutingTable);
      return newRoutingTable;
    });
  }

  _fetchRoutingTableUsingKnownRouters(knownRouters, currentRoutingTable) {
    return this._fetchRoutingTable(knownRouters, currentRoutingTable).then(newRoutingTable => {
      if (newRoutingTable) {
        // one of the known routers returned a valid routing table - use it
        return newRoutingTable;
      }

      // returned routing table was undefined, this means a connection error happened and the last known
      // router did not return a valid routing table, so we need to forget it
      const lastRouterIndex = knownRouters.length - 1;
      LoadBalancer._forgetRouter(currentRoutingTable, knownRouters, lastRouterIndex);

      return null;
    });
  }

  _fetchRoutingTableUsingSeedRouter(seenRouters, seedRouter) {
    return this._hostNameResolver.resolve(seedRouter).then(resolvedRouterAddresses => {
      // filter out all addresses that we've already tried
      const newAddresses = resolvedRouterAddresses.filter(address => seenRouters.indexOf(address) < 0);
      return this._fetchRoutingTable(newAddresses, null);
    });
  }

  _fetchRoutingTable(routerAddresses, routingTable) {
    return routerAddresses.reduce((refreshedTablePromise, currentRouter, currentIndex) => {
      return refreshedTablePromise.then(newRoutingTable => {
        if (newRoutingTable) {
          // valid routing table was fetched - just return it, try next router otherwise
          return newRoutingTable;
        } else {
          // returned routing table was undefined, this means a connection error happened and we need to forget the
          // previous router and try the next one
          const previousRouterIndex = currentIndex - 1;
          LoadBalancer._forgetRouter(routingTable, routerAddresses, previousRouterIndex);
        }

        // try next router
        return this._createSessionForRediscovery(currentRouter).then(session => {
          return this._rediscovery.lookupRoutingTableOnRouter(session, currentRouter)
        });
      });
    }, Promise.resolve(null));
  }

  _createSessionForRediscovery(routerAddress) {
    return this._connectionPool.acquire(routerAddress).then(connection => {
      // initialized connection is required for routing procedure call
      // server version needs to be known to decide which routing procedure to use
      const initializedConnectionPromise = connection.initializationCompleted();
      const connectionProvider = new SingleConnectionProvider(initializedConnectionPromise);
      return new Session(READ, connectionProvider);
    });
  }

  _applyRoutingTableIfPossible(newRoutingTable) {
    if (!newRoutingTable) {
      // none of routing servers returned valid routing table, throw exception
      throw newError(
        `Could not perform discovery. No routing servers available. Known routing table: ${this._routingTable}`,
        SERVICE_UNAVAILABLE);
    }

    if (newRoutingTable.writers.length === 0) {
      // use seed router next time. this is important when cluster is partitioned. it tries to make sure driver
      // does not always get routing table without writers because it talks exclusively to a minority partition
      this._useSeedRouter = true;
    }

    this._updateRoutingTable(newRoutingTable);
  }

  _updateRoutingTable(newRoutingTable) {
    const currentRoutingTable = this._routingTable;

    // close old connections to servers not present in the new routing table
    const staleServers = currentRoutingTable.serversDiff(newRoutingTable);
    staleServers.forEach(server => this._connectionPool.purge(server));

    // make this driver instance aware of the new table
    this._routingTable = newRoutingTable;
  }

  static _forgetRouter(routingTable, routersArray, routerIndex) {
    const address = routersArray[routerIndex];
    if (routingTable && address) {
      routingTable.forgetRouter(address);
    }
  }

  static _createHostNameResolver() {
    if (hasFeature('dns_lookup')) {
      return new DnsHostNameResolver();
    }
    return new DummyHostNameResolver();
  }
}

export class SingleConnectionProvider extends ConnectionProvider {

  constructor(connectionPromise) {
    super();
    this._connectionPromise = connectionPromise;
  }

  acquireConnection(mode) {
    const connectionPromise = this._connectionPromise;
    this._connectionPromise = null;
    return connectionPromise;
  }
}

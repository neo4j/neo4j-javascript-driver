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

import {newError, SERVICE_UNAVAILABLE, SESSION_EXPIRED} from '../error';
import {READ, WRITE} from '../driver';
import Session from '../session';
import RoutingTable from './routing-table';
import Rediscovery from './rediscovery';
import RoutingUtil from './routing-util';
import { HostNameResolver } from './node';

const UNAUTHORIZED_ERROR_CODE = 'Neo.ClientError.Security.Unauthorized';

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

  constructor(address, connectionPool, driverOnErrorCallback) {
    super();
    this._address = address;
    this._connectionPool = connectionPool;
    this._driverOnErrorCallback = driverOnErrorCallback;
  }

  acquireConnection(mode) {
    const connectionPromise = this._connectionPool.acquire(this._address);
    return this._withAdditionalOnErrorCallback(connectionPromise, this._driverOnErrorCallback);
  }
}

export class LoadBalancer extends ConnectionProvider {

  constructor(address, routingContext, connectionPool, loadBalancingStrategy, hostNameResolver, driverOnErrorCallback, log) {
    super();
    this._seedRouter = address;
    this._routingTable = new RoutingTable([this._seedRouter]);
    this._rediscovery = new Rediscovery(new RoutingUtil(routingContext));
    this._connectionPool = connectionPool;
    this._driverOnErrorCallback = driverOnErrorCallback;
    this._loadBalancingStrategy = loadBalancingStrategy;
    this._hostNameResolver = hostNameResolver;
    this._dnsResolver = new HostNameResolver();
    this._log = log;
    this._useSeedRouter = true;
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
    this._log.info(`Routing table is stale for ${accessMode}: ${currentRoutingTable}`);
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
    const resolvedAddresses = this._resolveSeedRouter(seedRouter);
    return resolvedAddresses.then(resolvedRouterAddresses => {
      // filter out all addresses that we've already tried
      const newAddresses = resolvedRouterAddresses.filter(address => seenRouters.indexOf(address) < 0);
      return this._fetchRoutingTable(newAddresses, null);
    });
  }

  _resolveSeedRouter(seedRouter) {
    const customResolution = this._hostNameResolver.resolve(seedRouter);
    const dnsResolutions = customResolution.then(resolvedAddresses => {
      return Promise.all(resolvedAddresses.map(address => {
        return this._dnsResolver.resolve(address);
      }));
    });
    return dnsResolutions.then(results => {
      return [].concat.apply([], results);
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
          if (session) {
            return this._rediscovery.lookupRoutingTableOnRouter(session, currentRouter).catch(error => {
              this._log.warn(`unable to fetch routing table because of an error ${error}`);
              return null;
            });
          } else {
            // unable to acquire connection and create session towards the current router
            // return null to signal that the next router should be tried
            return null;
          }
        });
      });
    }, Promise.resolve(null));
  }

  _createSessionForRediscovery(routerAddress) {
    return this._connectionPool.acquire(routerAddress)
      .then(connection => {
        const connectionProvider = new SingleConnectionProvider(connection);
        return new Session(READ, connectionProvider);
      })
      .catch(error => {
        // unable to acquire connection towards the given router
        if (error && error.code === UNAUTHORIZED_ERROR_CODE) {
          // auth error is a sign of a configuration issue, rediscovery should not proceed
          throw error;
        }
        return null;
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
    this._log.info(`Updated routing table ${newRoutingTable}`);
  }

  static _forgetRouter(routingTable, routersArray, routerIndex) {
    const address = routersArray[routerIndex];
    if (routingTable && address) {
      routingTable.forgetRouter(address);
    }
  }
}

export class SingleConnectionProvider extends ConnectionProvider {

  constructor(connection) {
    super();
    this._connection = connection;
  }

  acquireConnection(mode) {
    const connection = this._connection;
    this._connection = null;
    return Promise.resolve(connection);
  }
}

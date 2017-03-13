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

import {newError, SERVICE_UNAVAILABLE, SESSION_EXPIRED} from '../error';
import {READ, WRITE} from '../driver';
import Session from '../session';
import RoundRobinArray from './round-robin-array';
import RoutingTable from './routing-table';
import Rediscovery from './rediscovery';

class ConnectionProvider {

  acquireConnection(mode) {
    throw new Error('Abstract method');
  }

  _withAdditionalOnErrorCallback(connectionPromise, driverOnErrorCallback) {
    // install error handler from the driver on the connection promise; this callback is installed separately
    // so that it does not handle errors, instead it is just an additional error reporting facility.
    connectionPromise.catch(error => {
      driverOnErrorCallback(error)
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
    const connection = this._connectionPool.acquire(this._address);
    const connectionPromise = Promise.resolve(connection);
    return this._withAdditionalOnErrorCallback(connectionPromise, this._driverOnErrorCallback);
  }
}

export class LoadBalancer extends ConnectionProvider {

  constructor(address, connectionPool, driverOnErrorCallback) {
    super();
    this._routingTable = new RoutingTable(new RoundRobinArray([address]));
    this._rediscovery = new Rediscovery();
    this._connectionPool = connectionPool;
    this._driverOnErrorCallback = driverOnErrorCallback;
  }

  acquireConnection(mode) {
    const connectionPromise = this._freshRoutingTable().then(routingTable => {
      if (mode === READ) {
        return this._acquireConnectionToServer(routingTable.readers, 'read');
      } else if (mode === WRITE) {
        return this._acquireConnectionToServer(routingTable.writers, 'write');
      } else {
        throw newError('Illegal mode ' + mode);
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

  _acquireConnectionToServer(serversRoundRobinArray, serverName) {
    const address = serversRoundRobinArray.next();
    if (!address) {
      return Promise.reject(newError('No ' + serverName + ' servers available', SESSION_EXPIRED));
    }
    return this._connectionPool.acquire(address);
  }

  _freshRoutingTable() {
    const currentRoutingTable = this._routingTable;

    if (!currentRoutingTable.isStale()) {
      return Promise.resolve(currentRoutingTable);
    }
    return this._refreshRoutingTable(currentRoutingTable);
  }

  _refreshRoutingTable(currentRoutingTable) {
    const knownRouters = currentRoutingTable.routers.toArray();

    const refreshedTablePromise = knownRouters.reduce((refreshedTablePromise, currentRouter, currentIndex) => {
      return refreshedTablePromise.then(newRoutingTable => {
        if (newRoutingTable) {
          if (!newRoutingTable.writers.isEmpty()) {
            // valid routing table was fetched - just return it, try next router otherwise
            return newRoutingTable;
          }
        } else {
          // returned routing table was undefined, this means a connection error happened and we need to forget the
          // previous router and try the next one
          const previousRouterIndex = currentIndex - 1;
          this._forgetRouter(currentRoutingTable, knownRouters, previousRouterIndex);
        }

        // try next router
        const session = this._createSessionForRediscovery(currentRouter);
        return this._rediscovery.lookupRoutingTableOnRouter(session, currentRouter);
      });
    }, Promise.resolve(null));

    return refreshedTablePromise.then(newRoutingTable => {
      if (newRoutingTable && !newRoutingTable.writers.isEmpty()) {
        this._updateRoutingTable(newRoutingTable);
        return newRoutingTable;
      }

      // forget the last known router because it did not return a valid routing table
      const lastRouterIndex = knownRouters.length - 1;
      this._forgetRouter(currentRoutingTable, knownRouters, lastRouterIndex);

      // none of the existing routers returned valid routing table, throw exception
      throw newError('Could not perform discovery. No routing servers available.', SERVICE_UNAVAILABLE);
    });
  }

  _createSessionForRediscovery(routerAddress) {
    const connection = this._connectionPool.acquire(routerAddress);
    const connectionPromise = Promise.resolve(connection);
    const connectionProvider = new SingleConnectionProvider(connectionPromise);
    return new Session(READ, connectionProvider);
  }

  _updateRoutingTable(newRoutingTable) {
    const currentRoutingTable = this._routingTable;

    // close old connections to servers not present in the new routing table
    const staleServers = currentRoutingTable.serversDiff(newRoutingTable);
    staleServers.forEach(server => this._connectionPool.purge(server));

    // make this driver instance aware of the new table
    this._routingTable = newRoutingTable;
  }

  _forgetRouter(routingTable, routersArray, routerIndex) {
    const address = routersArray[routerIndex];
    if (address) {
      routingTable.forgetRouter(address);
    }
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

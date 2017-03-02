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

import Session from './session';
import {Driver, READ, WRITE} from './driver';
import {newError, SERVICE_UNAVAILABLE, SESSION_EXPIRED} from './error';
import RoundRobinArray from './internal/round-robin-array';
import RoutingTable from './internal/routing-table';
import Rediscovery from './internal/rediscovery';

/**
 * A driver that supports routing in a core-edge cluster.
 */
class RoutingDriver extends Driver {

  constructor(url, userAgent, token = {}, config = {}) {
    super(url, userAgent, token, RoutingDriver._validateConfig(config));
    this._routingTable = new RoutingTable(new RoundRobinArray([url]));
    this._rediscovery = new Rediscovery();
  }

  _createSession(connectionPromise) {
    return new RoutingSession(connectionPromise, (error, conn) => {
      if (error.code === SERVICE_UNAVAILABLE || error.code === SESSION_EXPIRED) {
        if (conn) {
          this._forget(conn.url)
        } else {
          connectionPromise.then((conn) => {
            this._forget(conn.url);
          }).catch(() => {/*ignore*/});
        }
        return error;
      } else if (error.code === 'Neo.ClientError.Cluster.NotALeader') {
        let url = 'UNKNOWN';
        if (conn) {
          url = conn.url;
          this._routingTable.forgetWriter(conn.url);
        } else {
          connectionPromise.then((conn) => {
            this._routingTable.forgetWriter(conn.url);
          }).catch(() => {/*ignore*/});
        }
        return newError('No longer possible to write to server at ' + url, SESSION_EXPIRED);
      } else {
        return error;
      }
    });
  }

  _acquireConnection(mode) {
    return this._freshRoutingTable().then(routingTable => {
      if (mode === READ) {
        return this._acquireConnectionToServer(routingTable.readers, "read");
      } else if (mode === WRITE) {
        return this._acquireConnectionToServer(routingTable.writers, "write");
      } else {
        throw newError('Illegal session mode ' + mode);
      }
    });
  }

  _acquireConnectionToServer(serversRoundRobinArray, serverName) {
    const address = serversRoundRobinArray.next();
    if (!address) {
      return Promise.reject(newError('No ' + serverName + ' servers available', SESSION_EXPIRED));
    }
    return this._pool.acquire(address);
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
          const previousRouter = knownRouters[currentIndex - 1];
          if (previousRouter) {
            currentRoutingTable.forgetRouter(previousRouter);
          }
        }

        // try next router
        const session = this._createSessionForRediscovery(currentRouter);
        return this._rediscovery.lookupRoutingTableOnRouter(session, currentRouter);
      })
    }, Promise.resolve(null));

    return refreshedTablePromise.then(newRoutingTable => {
      if (newRoutingTable && !newRoutingTable.writers.isEmpty()) {
        this._updateRoutingTable(newRoutingTable);
        return newRoutingTable
      }
      throw newError('Could not perform discovery. No routing servers available.', SERVICE_UNAVAILABLE);
    });
  }

  _createSessionForRediscovery(routerAddress) {
    const connection = this._pool.acquire(routerAddress);
    const connectionPromise = Promise.resolve(connection);
    // error transformer here is a no-op unlike the one in a regular session, this is so because errors are
    // handled in the rediscovery promise chain and we do not need to do this in the error transformer
    const errorTransformer = error => error;
    return new RoutingSession(connectionPromise, errorTransformer);
  }

  _forget(url) {
    this._routingTable.forget(url);
    this._pool.purge(url);
  }

  _updateRoutingTable(newRoutingTable) {
    const currentRoutingTable = this._routingTable;

    // close old connections to servers not present in the new routing table
    const staleServers = currentRoutingTable.serversDiff(newRoutingTable);
    staleServers.forEach(server => this._pool.purge(server));

    // make this driver instance aware of the new table
    this._routingTable = newRoutingTable;
  }

  static _validateConfig(config) {
    if(config.trust === 'TRUST_ON_FIRST_USE') {
      throw newError('The chosen trust mode is not compatible with a routing driver');
    }
    return config;
  }
}

class RoutingSession extends Session {
  constructor(connectionPromise, onFailedConnection) {
    super(connectionPromise);
    this._onFailedConnection = onFailedConnection;
  }

  _onRunFailure() {
    return this._onFailedConnection;
  }
}

export default RoutingDriver

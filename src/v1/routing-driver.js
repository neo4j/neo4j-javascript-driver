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
import {newError, SERVICE_UNAVAILABLE, SESSION_EXPIRED} from "./error";
import RoundRobinArray from './internal/round-robin-array';
import {int} from './integer'
import Integer from './integer'

/**
 * A driver that supports routing in a core-edge cluster.
 */
class RoutingDriver extends Driver {

  constructor(url, userAgent, token = {}, config = {}) {
    super(url, userAgent, token, RoutingDriver._validateConfig(config));
    this._clusterView = new ClusterView(new RoundRobinArray([url]));
  }

  _createSession(connectionPromise, cb) {
    return new RoutingSession(connectionPromise, cb, (err, conn) => {
      let code = err.code;
      let msg = err.message;
      if (!code) {
        try {
          code = err.fields[0].code;
        } catch (e) {
          code = 'UNKNOWN';
        }
      }
      if (!msg) {
        try {
          msg = err.fields[0].message;
        } catch (e) {
          msg = 'Unknown failure occurred';
        }
      }
      //just to simplify later error handling
      err.code = code;
      err.message = msg;

      if (code === SERVICE_UNAVAILABLE || code === SESSION_EXPIRED) {
        if (conn) {
          this._forget(conn.url)
        } else {
          connectionPromise.then((conn) => {
            this._forget(conn.url);
          }).catch(() => {/*ignore*/});
        }
        return err;
      } else if (code === 'Neo.ClientError.Cluster.NotALeader') {
        let url = 'UNKNOWN';
        if (conn) {
          url = conn.url;
          this._clusterView.writers.remove(conn.url);
        } else {
          connectionPromise.then((conn) => {
            this._clusterView.writers.remove(conn.url);
          }).catch(() => {/*ignore*/});
        }
        return newError("No longer possible to write to server at " + url, SESSION_EXPIRED);
      } else {
        return err;
      }
    });
  }

  _updatedClusterView() {
    if (!this._clusterView.needsUpdate()) {
      return Promise.resolve(this._clusterView);
    } else {
      let call = () => {
        let conn = this._pool.acquire(routers.next());
        let session = this._createSession(Promise.resolve(conn));
        return newClusterView(session).catch((err) => {
          this._forget(conn);
          return Promise.reject(err);
        });
      };
      let routers = this._clusterView.routers;
      //Build a promise chain that ends on the first successful call
      //i.e. call().catch(call).catch(call).catch(call)...
      //each call will try a different router
      let acc = Promise.reject();
      for (let i = 0; i < routers.size(); i++) {
        acc = acc.catch(call);
      }
      return acc;
    }
  }

  _diff(oldView, updatedView) {
    let oldSet = oldView.all();
    let newSet = updatedView.all();
    newSet.forEach((item) => {
      oldSet.delete(item);
    });
    return oldSet;
  }

  _acquireConnection(mode) {
    let m = mode || WRITE;
    //make sure we have enough servers
    return this._updatedClusterView().then((view) => {
      let toRemove = this._diff(this._clusterView, view);
      let self = this;
      toRemove.forEach((url) => {
        self._pool.purge(url);
      });
      //update our cached view
      this._clusterView = view;
      if (m === READ) {
        let key = view.readers.next();
        if (!key) {
          return Promise.reject(newError('No read servers available', SESSION_EXPIRED));
        }
        return this._pool.acquire(key);
      } else if (m === WRITE) {
        let key = view.writers.next();
        if (!key) {
          return Promise.reject(newError('No write servers available', SESSION_EXPIRED));
        }
        return this._pool.acquire(key);
      } else {
        return Promise.reject(m + " is not a valid option");
      }
    }).catch((err) => {return Promise.reject(err)});
  }

  _forget(url) {
    this._pool.purge(url);
    this._clusterView.remove(url);
  }

  static _validateConfig(config) {
    if(config.trust === 'TRUST_ON_FIRST_USE') {
      throw newError('The chosen trust mode is not compatible with a routing driver');
    }
    return config;
  }
}

class ClusterView {
  constructor(routers, readers, writers, expires) {
    this.routers = routers || new RoundRobinArray();
    this.readers = readers || new RoundRobinArray();
    this.writers = writers || new RoundRobinArray();
    this._expires = expires || int(-1);

  }

  needsUpdate() {
    return this._expires.lessThan(Date.now()) ||
      this.routers.size() <= 1 ||
      this.readers.empty() ||
      this.writers.empty();
  }

  all() {
    let seen = new Set(this.routers.toArray());
    let writers = this.writers.toArray();
    let readers = this.readers.toArray();
    for (let i = 0; i < writers.length; i++) {
      seen.add(writers[i]);
    }
    for (let i = 0; i < readers.length; i++) {
      seen.add(readers[i]);
    }
    return seen;
  }

  remove(item) {
    this.routers.remove(item);
    this.readers.remove(item);
    this.writers.remove(item);
  }
}

class RoutingSession extends Session {
  constructor(connectionPromise, onClose, onFailedConnection) {
    super(connectionPromise, onClose);
    this._onFailedConnection = onFailedConnection;
  }

  _onRunFailure() {
    return this._onFailedConnection;
  }
}

let GET_SERVERS = "CALL dbms.cluster.routing.getServers";

/**
 * Calls `getServers` and retrieves a new promise of a ClusterView.
 * @param session
 * @returns {Promise.<ClusterView>}
 */
function newClusterView(session) {
  return session.run(GET_SERVERS)
    .then((res) => {
      session.close();
      if (res.records.length != 1) {
        return Promise.reject(newError("Invalid routing response from server", SERVICE_UNAVAILABLE));
      }
      let record = res.records[0];
      let now = int(Date.now());
      let expires = record.get('ttl').multiply(1000).add(now);
      //if the server uses a really big expire time like Long.MAX_VALUE
      //this may have overflowed
      if (expires.lessThan(now)) {
        expires = Integer.MAX_VALUE;
      }
      let servers = record.get('servers');
      let routers = new RoundRobinArray();
      let readers = new RoundRobinArray();
      let writers = new RoundRobinArray();
      for (let i = 0; i < servers.length; i++) {
        let server = servers[i];

        let role = server['role'];
        let addresses = server['addresses'];
        if (role === 'ROUTE') {
          routers.pushAll(addresses);
        } else if (role === 'WRITE') {
          writers.pushAll(addresses);
        } else if (role === 'READ') {
          readers.pushAll(addresses);
        }
      }
      if (routers.empty() || writers.empty()) {
        return Promise.reject(newError("Invalid routing response from server", SERVICE_UNAVAILABLE))
      }
      return new ClusterView(routers, readers, writers, expires);
    })
    .catch((e) => {
      if (e.code === 'Neo.ClientError.Procedure.ProcedureNotFound') {
        return Promise.reject(newError("Server could not perform routing, make sure you are connecting to a causal cluster", SERVICE_UNAVAILABLE));
      } else {
        return Promise.reject(newError("No servers could be found at this instant.", SERVICE_UNAVAILABLE));
      }
    });
}

export default RoutingDriver

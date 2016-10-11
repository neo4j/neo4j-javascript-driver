/**
 * Copyright (c) 2002-2016 "Neo Technology,"
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
import "babel-polyfill";



/**
 * A driver that supports routing in a core-edge cluster.
 */
class RoutingDriver extends Driver {

  constructor(url, userAgent = 'neo4j-javascript/0.0', token = {}, config = {}) {
    super(url, userAgent, token, config);
    this._clusterView = new ClusterView(new RoundRobinArray([url]));
  }

  session(mode) {
    let conn = this._acquireConnection(mode);
    return this._createSession(conn);
  }

  _updatedClusterView() {
    if (!this._clusterView.needsUpdate()) {
      return Promise.resolve(this._clusterView);
    } else {
      let routers = this._clusterView.routers;
      let acc = Promise.reject();
      for (let i = 0; i < routers.size(); i++) {
        acc = acc.catch(() => {
          let conn = this._pool.acquire(routers.hop());
          let session = this._createSession(Promise.resolve(conn));
          return newClusterView(session).catch((err) => {
            this._forget(conn);
            return Promise.reject(err);
          });
        });
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
        return this._pool.acquire(view.readers.hop());
      } else if (m === WRITE) {
        return this._pool.acquire(view.writers.hop());
      } else {
        return Promise.reject(m + " is not a valid option");
      }
    });
  }

  _forget(url) {
    this._pool.purge(url);
    this._clusterView.remove(url);
  }
}


class ClusterView {
  constructor(routers, readers, writers, expires) {
    this.routers = routers || new RoundRobinArray();
    this.readers = readers || new RoundRobinArray();
    this.writers = writers || new RoundRobinArray();
    this._expires = expires || -1;

  }

  needsUpdate() {
    return this._expires < Date.now() ||
      this.routers.empty() ||
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
      //Note we are loosing precision here but let's hope that in
      //the 140000 years to come before this precision loss
      //hits us, that we get native 64 bit integers in javascript
      let expires = record.get('ttl').toNumber();
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
      return new ClusterView(routers, readers, writers, expires);
    });
}

export default RoutingDriver

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
import Pool from './internal/pool';
import Integer from './integer';
import {connect, parseScheme, parseUrl} from "./internal/connector";
import StreamObserver from './internal/stream-observer';
import VERSION from '../version';
import {newError, SERVICE_UNAVAILABLE, SESSION_EXPIRED} from "./error";
import "babel-polyfill";

let READ = 'READ', WRITE = 'WRITE';
/**
 * A driver maintains one or more {@link Session sessions} with a remote
 * Neo4j instance. Through the {@link Session sessions} you can send statements
 * and retrieve results from the database.
 *
 * Drivers are reasonably expensive to create - you should strive to keep one
 * driver instance around per Neo4j Instance you connect to.
 *
 * @access public
 */
class Driver {
  /**
   * You should not be calling this directly, instead use {@link driver}.
   * @constructor
   * @param {string} url
   * @param {string} userAgent
   * @param {Object} token
   * @param {Object} config
   * @access private
   */
  constructor(url, userAgent = 'neo4j-javascript/0.0', token = {}, config = {}) {
    this._url = url;
    this._userAgent = userAgent;
    this._openSessions = {};
    this._sessionIdGenerator = 0;
    this._token = token;
    this._config = config;
    this._pool = new Pool(
      this._createConnection.bind(this),
      this._destroyConnection.bind(this),
      Driver._validateConnection.bind(this),
      config.connectionPoolSize
    );
  }

  /**
   * Create a new connection instance.
   * @return {Connection} new connector-api session instance, a low level session API.
   * @access private
   */
  _createConnection(url, release) {
    let sessionId = this._sessionIdGenerator++;
    let streamObserver = new _ConnectionStreamObserver(this);
    let conn = connect(url, this._config);
    conn.initialize(this._userAgent, this._token, streamObserver);
    conn._id = sessionId;
    conn._release = () => release(this._url, conn);

    this._openSessions[sessionId] = conn;
    return conn;
  }

  /**
   * Check that a connection is usable
   * @return {boolean} true if the connection is open
   * @access private
   **/
  static _validateConnection(conn) {
    return conn.isOpen();
  }

  /**
   * Dispose of a live session, closing any associated resources.
   * @return {Session} new session.
   * @access private
   */
  _destroyConnection(conn) {
    delete this._openSessions[conn._id];
    conn.close();
  }

  /**
   * Acquire a session to communicate with the database. The driver maintains
   * a pool of sessions, so calling this method is normally cheap because you
   * will be pulling a session out of the common pool.
   *
   * This comes with some responsibility - make sure you always call
   * {@link Session#close()} when you are done using a session, and likewise,
   * make sure you don't close your session before you are done using it. Once
   * it is returned to the pool, the session will be reset to a clean state and
   * made available for others to use.
   *
   * @return {Session} new session.
   */
  session() {
    let conn = this._pool.acquire(this._url);
    return this._createSession(Promise.resolve(conn));
  }

  _createSession(connectionPromise) {
    return new Session(connectionPromise, (cb) => {
      // This gets called on Session#close(), and is where we return
      // the pooled 'connection' instance.

      // We don't pool Session instances, to avoid users using the Session
      // after they've called close. The `Session` object is just a thin
      // wrapper around Connection anyway, so it makes little difference.

      // Queue up a 'reset', to ensure the next user gets a clean
      // session to work with.
      connectionPromise.then( (conn) => {
        conn.reset();
        conn.sync();

        // Return connection to the pool
        conn._release();
      });


      // Call user callback
      if (cb) {
        cb();
      }
    });
  }

  /**
   * Close all open sessions and other associated resources. You should
   * make sure to use this when you are done with this driver instance.
   * @return undefined
   */
  close() {
    for (let sessionId in this._openSessions) {
      if (this._openSessions.hasOwnProperty(sessionId)) {
        this._openSessions[sessionId].close();
      }
    }
  }
}

class RoundRobinArray {
  constructor(items) {
    this._items = items || [];
    this._index = 0;
  }

  hop() {
    let elem = this._items[this._index];
    if (this._items.length === 0) {
      this._index = 0;
    } else {
      this._index = (this._index + 1) % (this._items.length);
    }
    return elem;
  }

  push(elem) {
    this._items.push(elem);
  }

  pushAll(elems) {
    Array.prototype.push.apply(this._items, elems);
  }

  empty() {
    return this._items.length === 0;
  }

  clear() {
    this._items = [];
    this._index = 0;
  }

  size() {
    return this._items.length;
  }

  toArray() {
    return this._items;
  }

  remove(item) {
    let index = this._items.indexOf(item);
    while (index != -1) {
      this._items.splice(index, 1);
      if (index < this._index) {
        this._index -= 1;
      }
      //make sure we are in range
      if (this._items.length === 0) {
        this._index = 0;
      } else {
        this._index %= this._items.length;
      }
    }
  }
}

let GET_SERVERS = "CALL dbms.cluster.routing.getServers";

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

class RoutingDriver extends Driver {

  constructor(url, userAgent = 'neo4j-javascript/0.0', token = {}, config = {}) {
    super(url, userAgent, token, config);
    this._clusterView = new ClusterView(new RoundRobinArray([parseUrl(url)]));
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

/** Internal stream observer used for connection state */
class _ConnectionStreamObserver extends StreamObserver {
  constructor(driver) {
    super();
    this._driver = driver;
    this._hasFailed = false;
  }

  onError(error) {
    if (!this._hasFailed) {
      super.onError(error);
      if (this._driver.onError) {
        this._driver.onError(error);
      }
      this._hasFailed = true;
    }
  }

  onCompleted(message) {
    if (this._driver.onCompleted) {
      this._driver.onCompleted(message);
    }
  }
}

let USER_AGENT = "neo4j-javascript/" + VERSION;

/**
 * Construct a new Neo4j Driver. This is your main entry point for this
 * library.
 *
 * ## Configuration
 *
 * This function optionally takes a configuration argument. Available configuration
 * options are as follows:
 *
 *     {
 *       // Encryption level: one of ENCRYPTION_ON, ENCRYPTION_OFF or ENCRYPTION_NON_LOCAL.
 *       // ENCRYPTION_NON_LOCAL is on by default in modern NodeJS installs,
 *       // but off by default in the Web Bundle and old (<=1.0.0) NodeJS installs
 *       // due to technical limitations on those platforms.
 *       encrypted: ENCRYPTION_ON|ENCRYPTION_OFF|ENCRYPTION_NON_LOCAL
 *
 *       // Trust strategy to use if encryption is enabled. There is no mode to disable
 *       // trust other than disabling encryption altogether. The reason for
 *       // this is that if you don't know who you are talking to, it is easy for an
 *       // attacker to hijack your encrypted connection, rendering encryption pointless.
 *       //
 *       // TRUST_ON_FIRST_USE is the default for modern NodeJS deployments, and works
 *       // similarly to how `ssl` works - the first time we connect to a new host,
 *       // we remember the certificate they use. If the certificate ever changes, we
 *       // assume it is an attempt to hijack the connection and require manual intervention.
 *       // This means that by default, connections "just work" while still giving you
 *       // good encrypted protection.
 *       //
 *       // TRUST_CUSTOM_CA_SIGNED_CERTIFICATES is the classic approach to trust verification -
 *       // whenever we establish an encrypted connection, we ensure the host is using
 *       // an encryption certificate that is in, or is signed by, a certificate listed
 *       // as trusted. In the web bundle, this list of trusted certificates is maintained
 *       // by the web browser. In NodeJS, you configure the list with the next config option.
 *       //
 *       // TRUST_SYSTEM_CA_SIGNED_CERTIFICATES meand that you trust whatever certificates
 *       // are in the default certificate chain of th
 *       trust: "TRUST_ON_FIRST_USE" | "TRUST_SIGNED_CERTIFICATES" | TRUST_CUSTOM_CA_SIGNED_CERTIFICATES |
 * TRUST_SYSTEM_CA_SIGNED_CERTIFICATES,
 *
 *       // List of one or more paths to trusted encryption certificates. This only
 *       // works in the NodeJS bundle, and only matters if you use "TRUST_CUSTOM_CA_SIGNED_CERTIFICATES".
 *       // The certificate files should be in regular X.509 PEM format.
 *       // For instance, ['./trusted.pem']
 *       trustedCertificates: [],
 *
 *       // Path to a file where the driver saves hosts it has seen in the past, this is
 *       // very similar to the ssl tool's known_hosts file. Each time we connect to a
 *       // new host, a hash of their certificate is stored along with the domain name and
 *       // port, and this is then used to verify the host certificate does not change.
 *       // This setting has no effect unless TRUST_ON_FIRST_USE is enabled.
 *       knownHosts:"~/.neo4j/known_hosts",
 *     }
 *
 * @param {string} url The URL for the Neo4j database, for instance "bolt://localhost"
 * @param {Map<String,String>} authToken Authentication credentials. See {@link auth} for helpers.
 * @param {Object} config Configuration object. See the configuration section above for details.
 * @returns {Driver}
 */
function driver(url, authToken, config = {}) {
  let scheme = parseScheme(url);
  if (scheme === "bolt+routing://") {
      return new RoutingDriver(parseUrl(url), USER_AGENT, authToken, config);
  } else if (scheme === "bolt://") {
    return new Driver(parseUrl(url), USER_AGENT, authToken, config);
  } else {
    throw new Error("Unknown scheme: " + scheme);

  }
}

export {Driver, driver, READ, WRITE}

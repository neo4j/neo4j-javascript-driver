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
import {connect, scheme} from "./internal/connector";
import StreamObserver from './internal/stream-observer';
import VERSION from '../version';
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
  _createConnection(release) {
    let sessionId = this._sessionIdGenerator++;
    let streamObserver = new _ConnectionStreamObserver(this);
    let conn = connect(this._url, this._config);
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
    return this._createSession(conn);
  }

  _createSession(conn) {
    return new Session(new Promise((resolve, reject) => resolve(conn)), (cb) => {
      // This gets called on Session#close(), and is where we return
      // the pooled 'connection' instance.

      // We don't pool Session instances, to avoid users using the Session
      // after they've called close. The `Session` object is just a thin
      // wrapper around Connection anyway, so it makes little difference.

      // Queue up a 'reset', to ensure the next user gets a clean
      // session to work with.
      conn.reset();
      conn.sync();

      // Return connection to the pool
      conn._release();

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
    this._index = (this._index + 1) % (this._items.length - 1);
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
      this._index %= (this._items.length - 1);
    }
  }
}

let GET_SERVERS = "CALL dbms.cluster.routing.getServers";

class ClusterView {
  constructor(expires, routers, readers, writers) {
    this.expires = expires;
    this.routers = routers;
    this.readers = readers;
    this.routers = writers;
  }
}

function newClusterView(session) {
  return session.run(GET_SERVERS)
    .then((res) => {
      session.close();
      let record = res.records[0];
      //Note we are loosing precision here but we are not
      //terribly worried since it is only
      //for dates more than 140000 years into the future.
      let expires = record.get('ttl').toNumber();
      let servers = record.get('servers');
      let routers = new RoundRobinArray();
      let readers = new RoundRobinArray();
      let writers = new RoundRobinArray();
      for (let i = 0; i <= servers.length; i++) {
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

      return new ClusterView(expires, routers, readers, writers);
    });
}

class RoutingDriver extends Driver {

  constructor(url, userAgent = 'neo4j-javascript/0.0', token = {}, config = {}) {
    super(url, userAgent, token, config);
    this._routers = new RoundRobinArray();
    this._routers.push(url);
    this._readers = new RoundRobinArray();
    this._writers = new RoundRobinArray();
    this._expires = Date.now();
  }

  //TODO make nice, expose constants?
  session(mode) {
    //Check so that we have servers available
    this._checkServers().then( () => {
      let conn = this._acquireConnection(mode);
      return this._createSession(conn);
    });
  }

  async _checkServers() {
    if (this._expires < Date.now() ||
      this._routers.empty() ||
      this._readers.empty() ||
      this._writers.empty()) {
      return await this._callServers();
    } else {
      return new Promise((resolve, reject) => resolve(false));
    }
  }

  async _callServers() {
    let seen = this._allServers();
    //clear writers and readers
    this._writers.clear();
    this._readers.clear();
    //we have to wait to clear routers until
    //we have discovered new ones
    let newRouters = new RoundRobinArray();
    let success = false;

    while (!this._routers.empty() && !success) {
      let url = this._routers.hop();
      try {
        let res = await this._call(url);
        console.log("got result");
        if (res.records.length != 1) continue;
        let record = res.records[0];
        //Note we are loosing precision here but we are not
        //terribly worried since it is only
        //for dates more than 140000 years into the future.
        this._expires += record.get('ttl').toNumber();
        let servers = record.get('servers');
        console.log(servers);
        for (let i = 0; i <= servers.length; i++) {
          let server = servers[i];
          seen.remove(server);

          let role = server['role'];
          let addresses = server['addresses'];
          if (role === 'ROUTE') {
            newRouters.push(server);
          } else if (role === 'WRITE') {
            this._writers.push(server);
          } else if (role === 'READ') {
            this._readers.push(server);
          }
        }

        if (newRouters.empty()) continue;
        //we have results
        this._routers = newRouters();
        //these are no longer valid according to server
        let self = this;
        seen.forEach((key) => {
          console.log("remove seen");
          self._pools.purge(key);
        });
        success = true;
        return new Promise((resolve, reject) => resolve(true));
      } catch (error) {
        //continue
        console.log(error);
        this._forget(url);
      }
    }

    let errorMsg = "Server could not perform discovery, please open a new driver with a different seed address.";
    if (this.onError) {
      this.onError(errorMsg);
    }

    return new Promise((resolve, reject) => reject(errorMsg));
  }

  _acquireConnection(mode) {
    //make sure we have enough servers
    let m = mode || WRITE;
    if (m === READ) {
      return this._pool.acquire(this._readers.hop());
    } else if (m === WRITE) {
      return this._pool.acquire(this._writers.hop());
    } else {
      //TODO fail
    }
  }

  _allServers() {
    let seen = new Set(this._routers.toArray());
    let writers = this._writers.toArray();
    let readers = this._readers.toArray();
    for (let i = 0; i < writers.length; i++) {
      seen.add(writers[i]);
    }
    for (let i = 0; i < readers.length; i++) {
      seen.add(writers[i]);
    }
    return seen;
  }

  async _call(url) {
    let conn = this._pool.acquire(url);
    let session = this._createSession(conn);
    return session.run(GET_SERVERS)
      .then((res) => {
        session.close();
        return res;
      }).catch((err) => {
        console.log(err);
        this._forget(url);
        return Promise.reject(err);
      });
  }

  _forget(url) {
    console.log("forget");
    this._pools.purge(url);
    this._routers.remove(url);
    this._readers.remove(url);
    this._writers.remove(url);
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
  let sch = scheme(url);
  if (sch === "bolt+routing://") {
      return new RoutingDriver(url, USER_AGENT, authToken, config);
  } else if (sch === "bolt://") {
    return new Driver(url, USER_AGENT, authToken, config);
  } else {
    throw new Error("Unknown scheme: " + sch);

  }
}

export {Driver, driver}

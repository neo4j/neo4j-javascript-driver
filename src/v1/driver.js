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
import {Pool} from './internal/pool';
import {connect} from "./internal/connector";
import StreamObserver from './internal/stream-observer';
import {VERSION} from '../version';

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
      this._validateConnection.bind(this),
      config.connectionPoolSize
    );
  }

  /**
   * Create a new connection instance.
   * @return {Connection} new connector-api session instance, a low level session API.
   * @access private
   */
  _createConnection( release ) {
    let sessionId = this._sessionIdGenerator++;
    let streamObserver = new _ConnectionStreamObserver(this);
    let conn = connect(this._url, this._config);
    conn.initialize(this._userAgent, this._token, streamObserver);
    conn._id = sessionId;
    conn._release = () => release(conn);

    this._openSessions[sessionId] = conn;
    return conn;
  }

  /**
   * Check that a connection is usable
   * @return {boolean} true if the connection is open
   * @access private
   **/
  _validateConnection( conn ) {
    return conn.isOpen();
  }

  /**
   * Dispose of a live session, closing any associated resources.
   * @return {Session} new session.
   * @access private
   */
  _destroyConnection( conn ) {
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
    let conn = this._pool.acquire();
    return new Session( conn, (cb) => {
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
      if(cb) { cb(); }
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
      if(this._driver.onError) {
        this._driver.onError(error);
      }
      this._hasFailed = true;
    }
  }
  onCompleted(message) {
    if(this._driver.onCompleted) {
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
 *       // Enable TLS encryption. This is on by default in modern NodeJS installs,
 *       // but off by default in the Web Bundle and old (<=1.0.0) NodeJS installs
 *       // due to technical limitations on those platforms.
 *       encrypted: true|false,
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
 *       trust: "TRUST_ON_FIRST_USE" | "TRUST_SIGNED_CERTIFICATES" | TRUST_CUSTOM_CA_SIGNED_CERTIFICATES | TRUST_SYSTEM_CA_SIGNED_CERTIFICATES,
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
function driver(url, authToken, config={}) {
  return new Driver(url, USER_AGENT, authToken, config);
}

export {Driver, driver}

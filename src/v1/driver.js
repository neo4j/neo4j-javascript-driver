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

import Session from './session';
import Pool from './internal/pool';
import Connection from './internal/connection';
import StreamObserver from './internal/stream-observer';
import {newError, SERVICE_UNAVAILABLE} from './error';
import {DirectConnectionProvider} from './internal/connection-providers';
import Bookmark from './internal/bookmark';
import ConnectivityVerifier from './internal/connectivity-verifier';
import PoolConfig, {DEFAULT_ACQUISITION_TIMEOUT, DEFAULT_MAX_SIZE} from './internal/pool-config';
import Logger from './internal/logger';
import ConnectionErrorHandler from './internal/connection-error-handler';
import {ACCESS_MODE_READ, ACCESS_MODE_WRITE} from './internal/constants';

const DEFAULT_MAX_CONNECTION_LIFETIME = 60 * 60 * 1000; // 1 hour

/**
 * Constant that represents read session access mode.
 * Should be used like this: `driver.session(neo4j.session.READ)`.
 * @type {string}
 */
const READ = ACCESS_MODE_READ;

/**
 * Constant that represents write session access mode.
 * Should be used like this: `driver.session(neo4j.session.WRITE)`.
 * @type {string}
 */
const WRITE = ACCESS_MODE_WRITE;

let idGenerator = 0;

/**
 * A driver maintains one or more {@link Session}s with a remote
 * Neo4j instance. Through the {@link Session}s you can send statements
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
   * @param {string} hostPort
   * @param {string} userAgent
   * @param {object} authToken
   * @param {object} config
   * @protected
   */
  constructor(hostPort, userAgent, authToken = {}, config = {}) {
    sanitizeConfig(config);

    this._id = idGenerator++;
    this._hostPort = hostPort;
    this._userAgent = userAgent;
    this._openConnections = {};
    this._authToken = authToken;
    this._config = config;
    this._log = Logger.create(config);
    this._pool = new Pool(
      this._createConnection.bind(this),
      this._destroyConnection.bind(this),
      this._validateConnection.bind(this),
      PoolConfig.fromDriverConfig(config),
      this._log
    );

    /**
     * Reference to the connection provider. Initialized lazily by {@link _getOrCreateConnectionProvider}.
     * @type {ConnectionProvider}
     * @protected
     */
    this._connectionProvider = null;

    this._onCompleted = null;

    this._afterConstruction();
  }

  /**
   * @protected
   */
  _afterConstruction() {
    this._log.info(`Direct driver ${this._id} created for server address ${this._hostPort}`);
  }

  /**
   * Get the installed connectivity verification callback.
   * @return {null|function}
   * @deprecated driver can be used directly once instantiated, use of this callback is not required.
   */
  get onCompleted() {
    return this._onCompleted;
  }

  /**
   * Install a connectivity verification callback.
   * @param {null|function} callback the new function to be notified about successful connection.
   * @deprecated driver can be used directly once instantiated, use of this callback is not required.
   */
  set onCompleted(callback) {
    this._onCompleted = callback;
    if (this._onCompleted) {
      const connectionProvider = this._getOrCreateConnectionProvider();
      const connectivityVerifier = new ConnectivityVerifier(connectionProvider, this._onCompleted);
      connectivityVerifier.verify();
    }
  }

  /**
   * Create a new connection and initialize it.
   * @return {Promise<Connection>} promise resolved with a new connection or rejected when failed to connect.
   * @access private
   */
  _createConnection(hostPort, release) {
    const connection = Connection.create(hostPort, this._config, this._createConnectionErrorHandler(), this._log);
    connection._release = () => release(hostPort, connection);
    this._openConnections[connection.id] = connection;

    return connection.connect(this._userAgent, this._authToken)
      .catch(error => {
        if (this.onError) {
          // notify Driver.onError callback about connection initialization errors
          this.onError(error);
        }
        // propagate the error because connection failed to connect / initialize
        throw error;
      });
  }

  /**
   * Check that a connection is usable
   * @return {boolean} true if the connection is open
   * @access private
   **/
  _validateConnection(conn) {
    if (!conn.isOpen()) {
      return false;
    }

    const maxConnectionLifetime = this._config.maxConnectionLifetime;
    const lifetime = Date.now() - conn.creationTimestamp;
    return lifetime <= maxConnectionLifetime;
  }

  /**
   * Dispose of a connection.
   * @return {Connection} the connection to dispose.
   * @access private
   */
  _destroyConnection(conn) {
    delete this._openConnections[conn.id];
    conn.close();
  }

  /**
   * Acquire a session to communicate with the database. The session will
   * borrow connections from the underlying connection pool as required and
   * should be considered lightweight and disposable.
   *
   * This comes with some responsibility - make sure you always call
   * {@link close} when you are done using a session, and likewise,
   * make sure you don't close your session before you are done using it. Once
   * it is closed, the underlying connection will be released to the connection
   * pool and made available for others to use.
   *
   * @param {string} [mode=WRITE] the access mode of this session, allowed values are {@link READ} and {@link WRITE}.
   * @param {string|string[]} [bookmarkOrBookmarks=null] the initial reference or references to some previous
   * transactions. Value is optional and absence indicates that that the bookmarks do not exist or are unknown.
   * @return {Session} new session.
   */
  session(mode, bookmarkOrBookmarks) {
    const sessionMode = Driver._validateSessionMode(mode);
    const connectionProvider = this._getOrCreateConnectionProvider();
    const bookmark = bookmarkOrBookmarks ? new Bookmark(bookmarkOrBookmarks) : Bookmark.empty();
    return new Session(sessionMode, connectionProvider, bookmark, this._config);
  }

  static _validateSessionMode(rawMode) {
    const mode = rawMode || WRITE;
    if (mode !== ACCESS_MODE_READ && mode !== ACCESS_MODE_WRITE) {
      throw newError('Illegal session mode ' + mode);
    }
    return mode;
  }

  // Extension point
  _createConnectionProvider(hostPort, connectionPool, driverOnErrorCallback) {
    return new DirectConnectionProvider(hostPort, connectionPool, driverOnErrorCallback);
  }

  // Extension point
  _createConnectionErrorHandler() {
    return new ConnectionErrorHandler(SERVICE_UNAVAILABLE);
  }

  _getOrCreateConnectionProvider() {
    if (!this._connectionProvider) {
      const driverOnErrorCallback = this._driverOnErrorCallback.bind(this);
      this._connectionProvider = this._createConnectionProvider(this._hostPort, this._pool, driverOnErrorCallback);
    }
    return this._connectionProvider;
  }

  _driverOnErrorCallback(error) {
    const userDefinedOnErrorCallback = this.onError;
    if (userDefinedOnErrorCallback && error.code === SERVICE_UNAVAILABLE) {
      userDefinedOnErrorCallback(error);
    } else {
      // we don't need to tell the driver about this error
    }
  }

  /**
   * Close all open sessions and other associated resources. You should
   * make sure to use this when you are done with this driver instance.
   * @return undefined
   */
  close() {
    this._log.info(`Driver ${this._id} closing`);

    try {
      // purge all idle connections in the connection pool
      this._pool.purgeAll();
    } finally {
      // then close all connections driver has ever created
      // it is needed to close connections that are active right now and are acquired from the pool
      for (let connectionId in this._openConnections) {
        if (this._openConnections.hasOwnProperty(connectionId)) {
          this._openConnections[connectionId].close();
        }
      }
    }
  }
}

/** Internal stream observer used for connection state */
class _ConnectionStreamObserver extends StreamObserver {
  constructor(driver, conn) {
    super();
    this._driver = driver;
    this._conn = conn;
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
}

/**
 * @private
 */
function sanitizeConfig(config) {
  config.maxConnectionLifetime = sanitizeIntValue(config.maxConnectionLifetime, DEFAULT_MAX_CONNECTION_LIFETIME);
  config.maxConnectionPoolSize = sanitizeIntValue(config.maxConnectionPoolSize, DEFAULT_MAX_SIZE);
  config.connectionAcquisitionTimeout = sanitizeIntValue(config.connectionAcquisitionTimeout, DEFAULT_ACQUISITION_TIMEOUT);
}

function sanitizeIntValue(rawValue, defaultWhenAbsent) {
  const sanitizedValue = parseInt(rawValue, 10);
  if (sanitizedValue > 0 || sanitizedValue === 0) {
    return sanitizedValue;
  } else if (sanitizedValue < 0) {
    return Number.MAX_SAFE_INTEGER;
  } else {
    return defaultWhenAbsent;
  }
}

export {Driver, READ, WRITE}

export default Driver

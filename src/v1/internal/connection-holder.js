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

import {newError} from '../error';

/**
 * Utility to lazily initialize connections and return them back to the pool when unused.
 */
export default class ConnectionHolder {

  /**
   * @constructor
   * @param {string} mode - the access mode for new connection holder.
   * @param {ConnectionProvider} connectionProvider - the connection provider to acquire connections from.
   */
  constructor(mode, connectionProvider) {
    this._mode = mode;
    this._connectionProvider = connectionProvider;
    this._referenceCount = 0;
    this._connectionPromise = Promise.resolve(null);
  }

  /**
   * Make this holder initialize new connection if none exists already.
   * @return {undefined}
   */
  initializeConnection() {
    if (this._referenceCount === 0) {
      this._connectionPromise = this._connectionProvider.acquireConnection(this._mode);
    }
    this._referenceCount++;
  }

  /**
   * Get the current connection promise.
   * @param {StreamObserver} streamObserver an observer for this connection.
   * @return {Promise<Connection>} promise resolved with the current connection.
   */
  getConnection(streamObserver) {
    return this._connectionPromise.then(connection => {
      streamObserver.resolveConnection(connection);
      return connection.initializationCompleted();
    });
  }

  /**
   * Notify this holder that single party does not require current connection any more.
   * @return {Promise<Connection>} promise resolved with the current connection, never a rejected promise.
   */
  releaseConnection() {
    if (this._referenceCount === 0) {
      return this._connectionPromise;
    }

    this._referenceCount--;
    if (this._referenceCount === 0) {
      return this._releaseConnection();
    }
    return this._connectionPromise;
  }

  /**
   * Closes this holder and releases current connection (if any) despite any existing users.
   * @return {Promise<Connection>} promise resolved when current connection is released to the pool.
   */
  close() {
    if (this._referenceCount === 0) {
      return this._connectionPromise;
    }
    this._referenceCount = 0;
    return this._releaseConnection();
  }

  /**
   * Return the current pooled connection instance to the connection pool.
   * We don't pool Session instances, to avoid users using the Session after they've called close.
   * The `Session` object is just a thin wrapper around Connection anyway, so it makes little difference.
   * @return {Promise} - promise resolved then connection is returned to the pool.
   * @private
   */
  _releaseConnection() {
    this._connectionPromise = this._connectionPromise.then(connection => {
      if (connection) {
        return connection.resetAndFlush()
          .catch(ignoreError)
          .then(() => connection._release());
      } else {
        return Promise.resolve();
      }
    }).catch(ignoreError);

    return this._connectionPromise;
  }
}

class EmptyConnectionHolder extends ConnectionHolder {

  initializeConnection() {
    // nothing to initialize
  }

  getConnection(streamObserver) {
    return Promise.reject(newError('This connection holder does not serve connections'));
  }

  releaseConnection() {
    return Promise.resolve();
  }

  close() {
    return Promise.resolve();
  }
}

function ignoreError(error) {
}

/**
 * Connection holder that does not manage any connections.
 * @type {ConnectionHolder}
 */
export const EMPTY_CONNECTION_HOLDER = new EmptyConnectionHolder();

/**
 * Copyright (c) 2002-2020 "Neo4j,"
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

import { newError } from '../error'
import { assertString } from './util'
import { ACCESS_MODE_WRITE } from './constants'
import Bookmark from './bookmark'

/**
 * Utility to lazily initialize connections and return them back to the pool when unused.
 */
export default class ConnectionHolder {
  /**
   * @constructor
   * @param {string} mode - the access mode for new connection holder.
   * @param {string} database - the target database name.
   * @param {ConnectionProvider} connectionProvider - the connection provider to acquire connections from.
   */
  constructor ({
    mode = ACCESS_MODE_WRITE,
    database = '',
    bookmark,
    connectionProvider
  } = {}) {
    this._mode = mode
    this._database = database ? assertString(database, 'database') : ''
    this._bookmark = bookmark || Bookmark.empty()
    this._connectionProvider = connectionProvider
    this._referenceCount = 0
    this._connectionPromise = Promise.resolve(null)
  }

  /**
   * Returns the assigned access mode.
   * @returns {string} access mode
   */
  mode () {
    return this._mode
  }

  /**
   * Returns the target database name
   * @returns {string} the database name
   */
  database () {
    return this._database
  }

  /**
   * Make this holder initialize new connection if none exists already.
   * @return {boolean}
   */
  initializeConnection () {
    console.log(
      `> ConnectionHolder.initializeConnection: start { refecenceCount=${this._referenceCount} }`
    )
    if (this._referenceCount === 0) {
      this._connectionPromise = this._connectionProvider.acquireConnection({
        accessMode: this._mode,
        database: this._database,
        bookmark: this._bookmark
      })
    } else {
      this._referenceCount++
      console.log(
        `> ConnectionHolder.initializeConnection: return false { refecenceCount=${this._referenceCount} }`
      )
      return false
    }
    this._referenceCount++
    console.log(
      `> ConnectionHolder.initializeConnection: return true { refecenceCount=${this._referenceCount} }`
    )
    return true
  }

  /**
   * Get the current connection promise.
   * @return {Promise<Connection>} promise resolved with the current connection.
   */
  getConnection () {
    return this._connectionPromise
  }

  /**
   * Notify this holder that single party does not require current connection any more.
   * @return {Promise<Connection>} promise resolved with the current connection, never a rejected promise.
   */
  releaseConnection () {
    console.log(
      `> ConnectionHolder.releaseConnection: start { refecenceCount=${this._referenceCount} }`
    )
    if (this._referenceCount === 0) {
      console.log(
        `> ConnectionHolder.releaseConnection: return _connectionPromise (referenceCount === 0) { refecenceCount=${this._referenceCount} }`
      )
      return this._connectionPromise
    }

    this._referenceCount--
    if (this._referenceCount === 0) {
      console.log(
        `> ConnectionHolder.releaseConnection: return _releaseConnection (--referenceCount === 0) { refecenceCount=${this._referenceCount} }`
      )
      return this._releaseConnection()
    }
    console.log(
      `> ConnectionHolder.releaseConnection: return _connectionPromise (--referenceCount > 0) { refecenceCount=${this._referenceCount} }`
    )
    return this._connectionPromise
  }

  /**
   * Closes this holder and releases current connection (if any) despite any existing users.
   * @return {Promise<Connection>} promise resolved when current connection is released to the pool.
   */
  close () {
    console.log(
      `> ConnectionHolder.close: start { refecenceCount=${this._referenceCount} }`
    )

    if (this._referenceCount === 0) {
      console.log(
        `> ConnectionHolder.close: return _connectionPromise { refecenceCount=${this._referenceCount} }`
      )
      return this._connectionPromise
    }
    this._referenceCount = 0
    console.log(
      `> ConnectionHolder.close: return _releaseConnection { refecenceCount=${this._referenceCount} }`
    )
    return this._releaseConnection()
  }

  /**
   * Return the current pooled connection instance to the connection pool.
   * We don't pool Session instances, to avoid users using the Session after they've called close.
   * The `Session` object is just a thin wrapper around Connection anyway, so it makes little difference.
   * @return {Promise} - promise resolved then connection is returned to the pool.
   * @private
   */
  _releaseConnection () {
    this._connectionPromise = this._connectionPromise
      .then(connection => {
        if (connection) {
          return connection
            .resetAndFlush()
            .catch(ignoreError)
            .then(() => connection._release())
        } else {
          return Promise.resolve()
        }
      })
      .catch(ignoreError)

    return this._connectionPromise
  }
}

class EmptyConnectionHolder extends ConnectionHolder {
  initializeConnection () {
    // nothing to initialize
    return true
  }

  getConnection () {
    return Promise.reject(
      newError('This connection holder does not serve connections')
    )
  }

  releaseConnection () {
    return Promise.resolve()
  }

  close () {
    return Promise.resolve()
  }
}

// eslint-disable-next-line handle-callback-err
function ignoreError (error) {}

/**
 * Connection holder that does not manage any connections.
 * @type {ConnectionHolder}
 */
export const EMPTY_CONNECTION_HOLDER = new EmptyConnectionHolder()

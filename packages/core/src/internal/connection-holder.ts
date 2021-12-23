/**
 * Copyright (c) "Neo4j"
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
import Connection from '../connection'
import { ACCESS_MODE_WRITE } from './constants'
import { Bookmark } from './bookmark'
import ConnectionProvider from '../connection-provider'
import { Point } from '..'

/**
 * @private
 */
interface ConnectionHolderInterface {
  /**
   * Returns the assigned access mode.
   * @returns {string} access mode
   */
  mode(): string | undefined

  /**
   * Returns the target database name
   * @returns {string} the database name
   */
  database(): string | undefined

  /**
   * Returns the bookmark
   */
  bookmark(): Bookmark

  /**
   * Make this holder initialize new connection if none exists already.
   * @return {boolean}
   */
  initializeConnection(): boolean

  /**
   * Get the current connection promise.
   * @return {Promise<Connection>} promise resolved with the current connection.
   */
  getConnection(): Promise<Connection | void>

  /**
   * Notify this holder that single party does not require current connection any more.
   * @return {Promise<Connection>} promise resolved with the current connection, never a rejected promise.
   */
  releaseConnection(): Promise<Connection | void>

  /**
   * Closes this holder and releases current connection (if any) despite any existing users.
   * @return {Promise<Connection>} promise resolved when current connection is released to the pool.
   */
  close(): Promise<Connection | void>
}

/**
 * Utility to lazily initialize connections and return them back to the pool when unused.
 * @private
 */
class ConnectionHolder implements ConnectionHolderInterface {
  private _mode: string
  private _database?: string
  private _bookmark: Bookmark
  private _connectionProvider?: ConnectionProvider
  private _referenceCount: number
  private _connectionPromise: Promise<Connection | void>
  private _impersonatedUser?: string
  private _onDatabaseNameResolved?: (databaseName?: string) => void

  /**
   * @constructor
   * @param {object} params
   * @property {string} params.mode - the access mode for new connection holder.
   * @property {string} params.database - the target database name.
   * @property {Bookmark} params.bookmark - the last bookmark
   * @property {ConnectionProvider} params.connectionProvider - the connection provider to acquire connections from.
   * @property {string?} params.impersonatedUser - the user which will be impersonated
   * @property {function(databaseName:string)} params.onDatabaseNameResolved - callback called when the database name is resolved
   */
  constructor({
    mode = ACCESS_MODE_WRITE,
    database = '',
    bookmark,
    connectionProvider,
    impersonatedUser,
    onDatabaseNameResolved
  }: {
    mode?: string
    database?: string
    bookmark?: Bookmark
    connectionProvider?: ConnectionProvider,
    impersonatedUser?: string,
    onDatabaseNameResolved?: (databaseName?: string) => void
  } = {}) {
    this._mode = mode
    this._database = database ? assertString(database, 'database') : ''
    this._bookmark = bookmark || Bookmark.empty()
    this._connectionProvider = connectionProvider
    this._impersonatedUser = impersonatedUser
    this._referenceCount = 0
    this._connectionPromise = Promise.resolve()
    this._onDatabaseNameResolved = onDatabaseNameResolved
  }

  mode(): string | undefined {
    return this._mode
  }

  database(): string | undefined {
    return this._database
  }

  setDatabase(database?: string) {
    this._database = database
  }

  bookmark(): Bookmark {
    return this._bookmark
  }

  connectionProvider(): ConnectionProvider | undefined {
    return this._connectionProvider
  }

  referenceCount(): number {
    return this._referenceCount
  }

  initializeConnection(): boolean {
    if (this._referenceCount === 0 && this._connectionProvider) {
      this._connectionPromise = this._connectionProvider.acquireConnection({
        accessMode: this._mode,
        database: this._database,
        bookmarks: this._bookmark,
        impersonatedUser: this._impersonatedUser,
        onDatabaseNameResolved: this._onDatabaseNameResolved
      })
    } else {
      this._referenceCount++
      return false
    }
    this._referenceCount++
    return true
  }
  getConnection(): Promise<Connection | void> {
    return this._connectionPromise
  }

  releaseConnection(): Promise<void | Connection> {
    if (this._referenceCount === 0) {
      return this._connectionPromise
    }

    this._referenceCount--

    if (this._referenceCount === 0) {
      return this._releaseConnection()
    }
    return this._connectionPromise
  }

  close(): Promise<void | Connection> {
    if (this._referenceCount === 0) {
      return this._connectionPromise
    }
    this._referenceCount = 0
    return this._releaseConnection()
  }

  /**
   * Return the current pooled connection instance to the connection pool.
   * We don't pool Session instances, to avoid users using the Session after they've called close.
   * The `Session` object is just a thin wrapper around Connection anyway, so it makes little difference.
   * @return {Promise} - promise resolved then connection is returned to the pool.
   * @private
   */
  private _releaseConnection(): Promise<Connection | void> {
    this._connectionPromise = this._connectionPromise
      .then((connection?: Connection|void) => {
        if (connection) {
          if (connection.isOpen()) {
            return connection
              .resetAndFlush()
              .catch(ignoreError)
              .then(() => connection._release())
          }
          return connection._release()
        } else {
          return Promise.resolve()
        }
      })
      .catch(ignoreError)

    return this._connectionPromise
  }
}

/**
 * Provides a interaction with a ConnectionHolder without change it state by
 * releasing or initilizing
 */
export default class ReadOnlyConnectionHolder extends ConnectionHolder {
  private _connectionHolder: ConnectionHolder

  /**
   * Contructor
   * @param {ConnectionHolder} connectionHolder the connection holder which will treat the requests
   */
  constructor(connectionHolder: ConnectionHolder) {
    super({
      mode: connectionHolder.mode(),
      database: connectionHolder.database(),
      bookmark: connectionHolder.bookmark(),
      connectionProvider: connectionHolder.connectionProvider()
    })
    this._connectionHolder = connectionHolder
  }

  /**
   * Return the true if the connection is suppose to be initilized with the command.
   *
   * @return {boolean}
   */
  initializeConnection(): boolean {
    if (this._connectionHolder.referenceCount() === 0) {
      return false
    }
    return true
  }

  /**
   * Get the current connection promise.
   * @return {Promise<Connection>} promise resolved with the current connection.
   */
  getConnection(): Promise<Connection | void> {
    return this._connectionHolder.getConnection()
  }

  /**
   * Get the current connection promise, doesn't performs the release
   * @return {Promise<Connection>} promise with the resolved current connection
   */
  releaseConnection(): Promise<Connection | void> {
    return this._connectionHolder.getConnection().catch(() => Promise.resolve())
  }

  /**
   * Get the current connection promise, doesn't performs the connection close
   * @return {Promise<Connection>} promise with the resolved current connection
   */
  close(): Promise<Connection | void> {
    return this._connectionHolder.getConnection().catch(() => Promise.resolve())
  }
}

class EmptyConnectionHolder extends ConnectionHolder {
  mode(): undefined {
    return undefined
  }

  database(): undefined {
    return undefined
  }

  initializeConnection() {
    // nothing to initialize
    return true
  }

  getConnection(): Promise<Connection> {
    return Promise.reject(
      newError('This connection holder does not serve connections')
    )
  }

  releaseConnection(): Promise<void> {
    return Promise.resolve()
  }

  close(): Promise<void> {
    return Promise.resolve()
  }
}

/**
 * Connection holder that does not manage any connections.
 * @type {ConnectionHolder}
 * @private
 */
const EMPTY_CONNECTION_HOLDER: EmptyConnectionHolder = new EmptyConnectionHolder()

// eslint-disable-next-line handle-callback-err
function ignoreError(error: Error) { }

export { ConnectionHolder, ReadOnlyConnectionHolder, EMPTY_CONNECTION_HOLDER }

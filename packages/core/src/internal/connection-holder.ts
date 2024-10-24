/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [https://neo4j.com]
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
/* eslint-disable @typescript-eslint/promise-function-async */

import { newError } from '../error'
import { assertString } from './util'
import Connection from '../connection'
import { ACCESS_MODE_WRITE, AccessMode } from './constants'
import { Bookmarks } from './bookmarks'
import ConnectionProvider, { Releasable } from '../connection-provider'
import { AuthToken } from '../types'
import { Logger } from './logger'

/**
 * @private
 */
interface ConnectionHolderInterface {
  /**
   * Returns the assigned access mode.
   * @returns {string} access mode
   */
  mode: () => string | undefined

  /**
   * Returns the target database name
   * @returns {string} the database name
   */
  database: () => string | undefined

  /**
   * Returns the bookmarks
   */
  bookmarks: () => Bookmarks

  /**
   * Make this holder initialize new connection if none exists already.
   * @return {boolean}
   */
  initializeConnection: () => boolean

  /**
   * Get the current connection promise.
   * @return {Promise<Connection>} promise resolved with the current connection.
   */
  getConnection: () => Promise<Connection | null>

  /**
   * Notify this holder that single party does not require current connection any more.
   * @return {Promise<Connection>} promise resolved with the current connection, never a rejected promise.
   */
  releaseConnection: () => Promise<Connection | null>

  /**
   * Closes this holder and releases current connection (if any) despite any existing users.
   * @return {Promise<Connection>} promise resolved when current connection is released to the pool.
   */
  close: () => Promise<Connection | null>
}

/**
 * Utility to lazily initialize connections and return them back to the pool when unused.
 * @private
 */
class ConnectionHolder implements ConnectionHolderInterface {
  private readonly _mode: AccessMode
  private _database?: string
  private readonly _bookmarks: Bookmarks
  private readonly _connectionProvider?: ConnectionProvider
  private _referenceCount: number
  private _connectionPromise: Promise<Connection & Releasable | null>
  private readonly _impersonatedUser?: string
  private readonly _getConnectionAcquistionBookmarks: () => Promise<Bookmarks>
  private readonly _onDatabaseNameResolved?: (databaseName?: string) => void
  private readonly _auth?: AuthToken
  private readonly _log: Logger
  private _closed: boolean

  /**
   * @constructor
   * @param {object} params
   * @property {string} params.mode - the access mode for new connection holder.
   * @property {string} params.database - the target database name.
   * @property {Bookmarks} params.bookmarks - initial bookmarks
   * @property {ConnectionProvider} params.connectionProvider - the connection provider to acquire connections from.
   * @property {string?} params.impersonatedUser - the user which will be impersonated
   * @property {function(databaseName:string)} params.onDatabaseNameResolved - callback called when the database name is resolved
   * @property {function():Promise<Bookmarks>} params.getConnectionAcquistionBookmarks - called for getting Bookmarks for acquiring connections
   * @property {AuthToken} params.auth - the target auth for the to-be-acquired connection
   */
  constructor ({
    mode,
    database = '',
    bookmarks,
    connectionProvider,
    impersonatedUser,
    onDatabaseNameResolved,
    getConnectionAcquistionBookmarks,
    auth,
    log
  }: {
    mode?: AccessMode
    database?: string
    bookmarks?: Bookmarks
    connectionProvider?: ConnectionProvider
    impersonatedUser?: string
    onDatabaseNameResolved?: (databaseName?: string) => void
    getConnectionAcquistionBookmarks?: () => Promise<Bookmarks>
    auth?: AuthToken
    log: Logger
  }) {
    this._mode = mode ?? ACCESS_MODE_WRITE
    this._closed = false
    this._database = database != null ? assertString(database, 'database') : ''
    this._bookmarks = bookmarks ?? Bookmarks.empty()
    this._connectionProvider = connectionProvider
    this._impersonatedUser = impersonatedUser
    this._referenceCount = 0
    this._connectionPromise = Promise.resolve(null)
    this._onDatabaseNameResolved = onDatabaseNameResolved
    this._auth = auth
    this._log = log
    this._logError = this._logError.bind(this)
    this._getConnectionAcquistionBookmarks = getConnectionAcquistionBookmarks ?? (() => Promise.resolve(Bookmarks.empty()))
  }

  mode (): AccessMode | undefined {
    return this._mode
  }

  database (): string | undefined {
    return this._database
  }

  setDatabase (database?: string): void {
    this._database = database
  }

  bookmarks (): Bookmarks {
    return this._bookmarks
  }

  connectionProvider (): ConnectionProvider | undefined {
    return this._connectionProvider
  }

  referenceCount (): number {
    return this._referenceCount
  }

  initializeConnection (homeDatabaseTable?: any): boolean {
    if (this._referenceCount === 0 && (this._connectionProvider != null)) {
      this._connectionPromise = this._createConnectionPromise(this._connectionProvider, homeDatabaseTable)
    } else {
      this._referenceCount++
      return false
    }
    this._referenceCount++
    return true
  }

  private async _createConnectionPromise (connectionProvider: ConnectionProvider, homeDatabaseTable?: any): Promise<Connection & Releasable | null> {
    return await connectionProvider.acquireConnection({
      accessMode: this._mode,
      database: this._database ?? '',
      bookmarks: await this._getBookmarks(),
      impersonatedUser: this._impersonatedUser,
      onDatabaseNameResolved: this._onDatabaseNameResolved,
      auth: this._auth,
      homeDbTable: homeDatabaseTable
    })
  }

  private async _getBookmarks (): Promise<Bookmarks> {
    return await this._getConnectionAcquistionBookmarks()
  }

  getConnection (): Promise<Connection | null> {
    return this._connectionPromise
  }

  releaseConnection (): Promise<null | Connection> {
    if (this._referenceCount === 0) {
      return this._connectionPromise
    }

    this._referenceCount--

    if (this._referenceCount === 0) {
      return this._releaseConnection()
    }
    return this._connectionPromise
  }

  close (hasTx?: boolean): Promise<null | Connection> {
    this._closed = true
    if (this._referenceCount === 0) {
      return this._connectionPromise
    }
    this._referenceCount = 0
    return this._releaseConnection(hasTx)
  }

  log (): Logger {
    return this._log
  }

  /**
   * Return the current pooled connection instance to the connection pool.
   * We don't pool Session instances, to avoid users using the Session after they've called close.
   * The `Session` object is just a thin wrapper around Connection anyway, so it makes little difference.
   * @return {Promise} - promise resolved then connection is returned to the pool.
   * @private
   */
  private _releaseConnection (hasTx?: boolean): Promise<Connection | null> {
    this._connectionPromise = this._connectionPromise
      .then((connection?: Connection & Releasable | null) => {
        if (connection != null) {
          if (connection.isOpen() && (connection.hasOngoingObservableRequests() || hasTx === true)) {
            return connection
              .resetAndFlush()
              .catch(ignoreError)
              .then(() => connection.release().then(() => null))
          }
          return connection.release().then(() => null)
        } else {
          return Promise.resolve(null)
        }
      })
      .catch(this._logError)

    return this._connectionPromise
  }

  _logError (error: Error): null {
    if (this._log.isWarnEnabled()) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      this._log.warn(`ConnectionHolder got an error while releasing the connection. Error ${error}. Stacktrace: ${error.stack}`)
    }

    return null
  }
}

/**
 * Provides a interaction with a ConnectionHolder without change it state by
 * releasing or initilizing
 */
export default class ReadOnlyConnectionHolder extends ConnectionHolder {
  private readonly _connectionHolder: ConnectionHolder

  /**
   * Constructor
   * @param {ConnectionHolder} connectionHolder the connection holder which will treat the requests
   */
  constructor (connectionHolder: ConnectionHolder) {
    super({
      mode: connectionHolder.mode(),
      database: connectionHolder.database(),
      bookmarks: connectionHolder.bookmarks(),
      // @ts-expect-error
      getConnectionAcquistionBookmarks: connectionHolder._getConnectionAcquistionBookmarks,
      connectionProvider: connectionHolder.connectionProvider(),
      log: connectionHolder.log()
    })
    this._connectionHolder = connectionHolder
  }

  /**
   * Return the true if the connection is suppose to be initilized with the command.
   *
   * @return {boolean}
   */
  initializeConnection (): boolean {
    if (this._connectionHolder.referenceCount() === 0) {
      return false
    }
    return true
  }

  /**
   * Get the current connection promise.
   * @return {Promise<Connection>} promise resolved with the current connection.
   */
  getConnection (): Promise<Connection | null> {
    return this._connectionHolder.getConnection()
  }

  /**
   * Get the current connection promise, doesn't performs the release
   * @return {Promise<Connection>} promise with the resolved current connection
   */
  releaseConnection (): Promise<Connection | null> {
    return this._connectionHolder.getConnection().catch(() => Promise.resolve(null))
  }

  /**
   * Get the current connection promise, doesn't performs the connection close
   * @return {Promise<Connection>} promise with the resolved current connection
   */
  close (): Promise<Connection | null> {
    return this._connectionHolder.getConnection().catch(() => Promise.resolve(null))
  }
}

class EmptyConnectionHolder extends ConnectionHolder {
  constructor () {
    super({
      // Empty logger
      log: Logger.create({})
    })
  }

  mode (): undefined {
    return undefined
  }

  database (): undefined {
    return undefined
  }

  initializeConnection (): boolean {
    // nothing to initialize
    return true
  }

  async getConnection (): Promise<Connection> {
    return await Promise.reject(
      newError('This connection holder does not serve connections')
    )
  }

  async releaseConnection (): Promise<null> {
    return await Promise.resolve(null)
  }

  async close (): Promise<null> {
    return await Promise.resolve(null)
  }
}

/**
 * Connection holder that does not manage any connections.
 * @type {ConnectionHolder}
 * @private
 */
const EMPTY_CONNECTION_HOLDER: EmptyConnectionHolder = new EmptyConnectionHolder()

// eslint-disable-next-line n/handle-callback-err
function ignoreError (error: Error): null {
  return null
}

export { ConnectionHolder, ReadOnlyConnectionHolder, EMPTY_CONNECTION_HOLDER }

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

import { newError } from './error'
import ConnectionProvider from './internal/connection-provider'
import Bookmark from './internal/bookmark'
import DirectConnectionProvider from './internal/connection-provider-direct'
import ConnectivityVerifier from './internal/connectivity-verifier'
import { ACCESS_MODE_READ, ACCESS_MODE_WRITE } from './internal/constants'
import Logger from './internal/logger'
import {
  DEFAULT_ACQUISITION_TIMEOUT,
  DEFAULT_MAX_SIZE
} from './internal/pool-config'
import Session from './session'
import RxSession from './session-rx'

const DEFAULT_MAX_CONNECTION_LIFETIME = 60 * 60 * 1000 // 1 hour

/**
 * Constant that represents read session access mode.
 * Should be used like this: `driver.session({ defaultAccessMode: neo4j.session.READ })`.
 * @type {string}
 */
const READ = ACCESS_MODE_READ

/**
 * Constant that represents write session access mode.
 * Should be used like this: `driver.session({ defaultAccessMode: neo4j.session.WRITE })`.
 * @type {string}
 */
const WRITE = ACCESS_MODE_WRITE

let idGenerator = 0

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
   * @param {ServerAddress} address
   * @param {string} userAgent
   * @param {object} authToken
   * @param {object} config
   * @protected
   */
  constructor (address, userAgent, authToken = {}, config = {}) {
    sanitizeConfig(config)

    this._id = idGenerator++
    this._address = address
    this._userAgent = userAgent
    this._authToken = authToken
    this._config = config
    this._log = Logger.create(config)

    /**
     * Reference to the connection provider. Initialized lazily by {@link _getOrCreateConnectionProvider}.
     * @type {ConnectionProvider}
     * @protected
     */
    this._connectionProvider = null

    this._afterConstruction()
  }

  /**
   * @protected
   */
  _afterConstruction () {
    this._log.info(
      `Direct driver ${this._id} created for server address ${this._address}`
    )
  }

  /**
   * Verifies connectivity of this driver by trying to open a connection with the provided driver options.
   * @param {string} [database=''] the target database to verify connectivity for.
   * @returns {Promise<object>} promise resolved with server info or rejected with error.
   */
  verifyConnectivity ({ database = '' } = {}) {
    const connectionProvider = this._getOrCreateConnectionProvider()
    const connectivityVerifier = new ConnectivityVerifier(connectionProvider)
    return connectivityVerifier.verify({ database })
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
   * @param {Object} args -
   * @param {string} args.defaultAccessMode='WRITE' - the access mode of this session, allowed values are {@link READ} and {@link WRITE}.
   * @param {string|string[]} args.bookmarks - the initial reference or references to some previous
   * transactions. Value is optional and absence indicates that that the bookmarks do not exist or are unknown.
   * @param {string} args.database='' - the database this session will connect to.
   * @return {Session} new session.
   */
  session ({
    defaultAccessMode = WRITE,
    bookmarks: bookmarkOrBookmarks,
    database = ''
  } = {}) {
    return this._newSession({
      defaultAccessMode,
      bookmarkOrBookmarks,
      database,
      reactive: false
    })
  }

  rxSession ({ defaultAccessMode = WRITE, bookmarks, database = '' } = {}) {
    return new RxSession({
      session: this._newSession({
        defaultAccessMode,
        bookmarks,
        database,
        reactive: true
      }),
      config: this._config
    })
  }

  _newSession ({ defaultAccessMode, bookmarkOrBookmarks, database, reactive }) {
    const sessionMode = Driver._validateSessionMode(defaultAccessMode)
    const connectionProvider = this._getOrCreateConnectionProvider()
    const bookmark = bookmarkOrBookmarks
      ? new Bookmark(bookmarkOrBookmarks)
      : Bookmark.empty()
    return new Session({
      mode: sessionMode,
      database,
      connectionProvider,
      bookmark,
      config: this._config,
      reactive
    })
  }

  static _validateSessionMode (rawMode) {
    const mode = rawMode || WRITE
    if (mode !== ACCESS_MODE_READ && mode !== ACCESS_MODE_WRITE) {
      throw newError('Illegal session mode ' + mode)
    }
    return mode
  }

  // Extension point
  _createConnectionProvider (address, userAgent, authToken) {
    return new DirectConnectionProvider({
      id: this._id,
      config: this._config,
      log: this._log,
      address: address,
      userAgent: userAgent,
      authToken: authToken
    })
  }

  _getOrCreateConnectionProvider () {
    if (!this._connectionProvider) {
      this._connectionProvider = this._createConnectionProvider(
        this._address,
        this._userAgent,
        this._authToken
      )
    }

    return this._connectionProvider
  }

  /**
   * Close all open sessions and other associated resources. You should
   * make sure to use this when you are done with this driver instance.
   * @return undefined
   */
  close () {
    this._log.info(`Driver ${this._id} closing`)
    if (this._connectionProvider) {
      this._connectionProvider.close()
    }
  }
}

/**
 * @private
 */
function sanitizeConfig (config) {
  config.maxConnectionLifetime = sanitizeIntValue(
    config.maxConnectionLifetime,
    DEFAULT_MAX_CONNECTION_LIFETIME
  )
  config.maxConnectionPoolSize = sanitizeIntValue(
    config.maxConnectionPoolSize,
    DEFAULT_MAX_SIZE
  )
  config.connectionAcquisitionTimeout = sanitizeIntValue(
    config.connectionAcquisitionTimeout,
    DEFAULT_ACQUISITION_TIMEOUT
  )
}

function sanitizeIntValue (rawValue, defaultWhenAbsent) {
  const sanitizedValue = parseInt(rawValue, 10)
  if (sanitizedValue > 0 || sanitizedValue === 0) {
    return sanitizedValue
  } else if (sanitizedValue < 0) {
    return Number.MAX_SAFE_INTEGER
  } else {
    return defaultWhenAbsent
  }
}

export { Driver, READ, WRITE }

export default Driver

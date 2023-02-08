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

import { createChannelConnection, ConnectionErrorHandler } from '../connection'
import Pool, { PoolConfig } from '../pool'
import { error, ConnectionProvider, ServerInfo, newError } from 'neo4j-driver-core'
import AuthenticationProvider from './authentication-provider'
import { object } from '../lang'

const { SERVICE_UNAVAILABLE } = error
const AUTHENTICATION_ERRORS = [
  'Neo.ClientError.Security.CredentialsExpired',
  'Neo.ClientError.Security.Forbidden',
  'Neo.ClientError.Security.TokenExpired',
  'Neo.ClientError.Security.Unauthorized'
]

export default class PooledConnectionProvider extends ConnectionProvider {
  constructor (
    { id, config, log, userAgent, authTokenProvider, newPool = (...args) => new Pool(...args) },
    createChannelConnectionHook = null
  ) {
    super()

    this._id = id
    this._config = config
    this._log = log
    this._authenticationProvider = new AuthenticationProvider({ authTokenProvider, userAgent })
    this._createChannelConnection =
      createChannelConnectionHook ||
      (address => {
        return createChannelConnection(
          address,
          this._config,
          this._createConnectionErrorHandler(),
          this._log
        )
      })
    this._connectionPool = newPool({
      create: this._createConnection.bind(this),
      destroy: this._destroyConnection.bind(this),
      validateOnAcquire: this._validateConnectionOnAcquire.bind(this),
      validateOnRelease: this._validateConnectionOnRelease.bind(this),
      installIdleObserver: PooledConnectionProvider._installIdleObserverOnConnection.bind(
        this
      ),
      removeIdleObserver: PooledConnectionProvider._removeIdleObserverOnConnection.bind(
        this
      ),
      config: PoolConfig.fromDriverConfig(config),
      log: this._log
    })
    this._userAgent = userAgent
    this._openConnections = {}
  }

  async verifyAuthentication ({ auth, database, accessMode, allowStickyConnection } = {}) {
    try {
      const connection = await this.acquireConnection({ accessMode, database, auth, allowStickyConnection })
      const address = connection.address
      const lastMessageIsNotLogin = !connection.protocol().isLastMessageLogin()
      try {
        if (lastMessageIsNotLogin && connection.supportsReAuth) {
          await connection.connect(this._userAgent, auth)
        }
      } finally {
        await connection._release()
      }
      if (lastMessageIsNotLogin && !connection.supportsReAuth) {
        const stickyConnection = await this._connectionPool.acquire({ auth }, address, { requireNew: true })
        stickyConnection._sticky = true
        await stickyConnection._release()
      }
      return true
    } catch (error) {
      if (AUTHENTICATION_ERRORS.includes(error.code)) {
        return false
      }
      throw error
    }
  }

  _createConnectionErrorHandler () {
    return new ConnectionErrorHandler(SERVICE_UNAVAILABLE)
  }

  /**
   * Create a new connection and initialize it.
   * @return {Promise<Connection>} promise resolved with a new connection or rejected when failed to connect.
   * @access private
   */
  _createConnection ({ auth }, address, release) {
    return this._createChannelConnection(address).then(connection => {
      connection._release = () => {
        return release(address, connection)
      }
      this._openConnections[connection.id] = connection
      return this._authenticationProvider.authenticate({ connection, auth })
        .catch(error => {
          // let's destroy this connection
          this._destroyConnection(connection)
          // propagate the error because connection failed to connect / initialize
          throw error
        })
    })
  }

  async _validateConnectionOnAcquire ({ auth }, conn) {
    if (!this._validateConnection(conn)) {
      return false
    }

    try {
      await this._authenticationProvider.authenticate({ connection: conn, auth })
      return true
    } catch (error) {
      this._log.debug(
        `The connection ${conn.id} is not valid because of an error ${error.code} '${error.message}'`
      )
      return false
    }
  }

  _validateConnectionOnRelease (conn) {
    return conn._sticky !== true && this._validateConnection(conn)
  }

  /**
   * Check that a connection is usable
   * @return {boolean} true if the connection is open
   * @access private
   **/
  _validateConnection (conn) {
    if (!conn.isOpen()) {
      return false
    }

    const maxConnectionLifetime = this._config.maxConnectionLifetime
    const lifetime = Date.now() - conn.creationTimestamp
    if (lifetime > maxConnectionLifetime) {
      return false
    }

    return true
  }

  /**
   * Dispose of a connection.
   * @return {Connection} the connection to dispose.
   * @access private
   */
  _destroyConnection (conn) {
    delete this._openConnections[conn.id]
    return conn.close()
  }

  /**
   * Acquire a connection from the pool and return it ServerInfo
   * @param {object} param
   * @param {string} param.address the server address
   * @return {Promise<ServerInfo>} the server info
   */
  async _verifyConnectivityAndGetServerVersion ({ address }) {
    const connection = await this._connectionPool.acquire({}, address)
    const serverInfo = new ServerInfo(connection.server, connection.protocol().version)
    try {
      if (!connection.protocol().isLastMessageLogon()) {
        await connection.resetAndFlush()
      }
    } finally {
      await connection._release()
    }
    return serverInfo
  }

  async _getStickyConnection ({ auth, connection, address, allowStickyConnection }) {
    const connectionWithSameCredentials = object.equals(auth, connection.authToken)
    const shouldCreateStickyConnection = !connectionWithSameCredentials
    connection._sticky = connectionWithSameCredentials && !connection.supportsReAuth

    if (allowStickyConnection !== true && (shouldCreateStickyConnection || connection._sticky)) {
      await connection._release()
      throw newError('Driver is connected to a database that does not support user switch.')
    } else if (allowStickyConnection === true && shouldCreateStickyConnection) {
      await connection._release()
      connection = await this._connectionPool.acquire({ auth }, address, { requireNew: true })
      connection._sticky = true
      return connection
    } else if (connection._sticky) {
      return connection
    }
  }

  async close () {
    // purge all idle connections in the connection pool
    await this._connectionPool.close()

    // then close all connections driver has ever created
    // it is needed to close connections that are active right now and are acquired from the pool
    await Promise.all(Object.values(this._openConnections).map(c => c.close()))
  }

  static _installIdleObserverOnConnection (conn, observer) {
    conn._queueObserver(observer)
  }

  static _removeIdleObserverOnConnection (conn) {
    conn._updateCurrentObserver()
  }
}

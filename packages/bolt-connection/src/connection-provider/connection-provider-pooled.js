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
    { id, config, log, userAgent, boltAgent, authTokenManager, newPool = (...args) => new Pool(...args) },
    createChannelConnectionHook = null
  ) {
    super()

    this._id = id
    this._config = config
    this._log = log
    this._authenticationProvider = new AuthenticationProvider({ authTokenManager, userAgent, boltAgent })
    this._userAgent = userAgent
    this._boltAgent = boltAgent
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
    this._openConnections = {}
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

  async _validateConnectionOnAcquire ({ auth, skipReAuth }, conn) {
    if (!this._validateConnection(conn)) {
      return false
    }

    try {
      await this._authenticationProvider.authenticate({ connection: conn, auth, skipReAuth })
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

  async _verifyAuthentication ({ getAddress, auth }) {
    const connectionsToRelease = []
    try {
      const address = await getAddress()
      const connection = await this._connectionPool.acquire({ auth, skipReAuth: true }, address)
      connectionsToRelease.push(connection)

      const lastMessageIsNotLogin = !connection.protocol().isLastMessageLogon()

      if (!connection.supportsReAuth) {
        throw newError('Driver is connected to a database that does not support user switch.')
      }
      if (lastMessageIsNotLogin && connection.supportsReAuth) {
        await this._authenticationProvider.authenticate({ connection, auth, waitReAuth: true, forceReAuth: true })
      } else if (lastMessageIsNotLogin && !connection.supportsReAuth) {
        const stickyConnection = await this._connectionPool.acquire({ auth }, address, { requireNew: true })
        stickyConnection._sticky = true
        connectionsToRelease.push(stickyConnection)
      }
      return true
    } catch (error) {
      if (AUTHENTICATION_ERRORS.includes(error.code)) {
        return false
      }
      throw error
    } finally {
      await Promise.all(connectionsToRelease.map(conn => conn._release()))
    }
  }

  async _verifyStickyConnection ({ auth, connection, address }) {
    const connectionWithSameCredentials = object.equals(auth, connection.authToken)
    const shouldCreateStickyConnection = !connectionWithSameCredentials
    connection._sticky = connectionWithSameCredentials && !connection.supportsReAuth

    if (shouldCreateStickyConnection || connection._sticky) {
      await connection._release()
      throw newError('Driver is connected to a database that does not support user switch.')
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

  _handleAuthorizationExpired (error, address, connection) {
    const handled = this._authenticationProvider.handleError({ connection, code: error.code })

    if (handled) {
      error.retriable = true
    }

    if (error.code === 'Neo.ClientError.Security.AuthorizationExpired') {
      this._connectionPool.apply(address, (conn) => { conn.authToken = null })
    }

    if (connection) {
      connection.close().catch(() => undefined)
    }

    return error
  }
}

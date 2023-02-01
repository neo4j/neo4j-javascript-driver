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

import PooledConnectionProvider from './connection-provider-pooled.js'
import {
  createChannelConnection,
  DelegateConnection,
  ConnectionErrorHandler
} from '../connection/index.js'
import { internal, error } from '../../core/index.ts'

const {
  constants: { BOLT_PROTOCOL_V3, BOLT_PROTOCOL_V4_0, BOLT_PROTOCOL_V4_4 }
} = internal

const { SERVICE_UNAVAILABLE } = error

export default class DirectConnectionProvider extends PooledConnectionProvider {
  constructor ({ id, config, log, address, userAgent, authTokenProvider, newPool }) {
    super({ id, config, log, userAgent, authTokenProvider, newPool })

    this._address = address
  }

  /**
   * See {@link ConnectionProvider} for more information about this method and
   * its arguments.
   */
  async acquireConnection ({ accessMode, database, bookmarks, auth, allowStickyConnection } = {}) {
    const databaseSpecificErrorHandler = ConnectionErrorHandler.create({
      errorCode: SERVICE_UNAVAILABLE,
      handleAuthorizationExpired: (error, address, conn) =>
        this._handleAuthorizationExpired(error, address, conn, database)
    })

    const connection = await this._connectionPool.acquire({ auth }, this._address)

    if (auth) {
      const stickyConnection = await this._getStickyConnection({ auth, connection, allowStickyConnection })
      if (stickyConnection) {
        return stickyConnection
      }
    }

    return new DelegateConnection(connection, databaseSpecificErrorHandler)
  }

  _handleAuthorizationExpired (error, address, connection, database) {
    this._log.warn(
      `Direct driver ${this._id} will close connection to ${address} for database '${database}' because of an error ${error.code} '${error.message}'`
    )

    this._authenticationProvider.handleError({ connection, code: error.code })

    if (error.code === 'Neo.ClientError.Security.AuthorizationExpired') {
      this._connectionPool.apply(address, (conn) => { conn.authToken = null })
    }

    connection.close().catch(() => undefined)

    return error
  }

  async _hasProtocolVersion (versionPredicate) {
    const connection = await createChannelConnection(
      this._address,
      this._config,
      this._createConnectionErrorHandler(),
      this._log
    )

    const protocolVersion = connection.protocol()
      ? connection.protocol().version
      : null

    await connection.close()

    if (protocolVersion) {
      return versionPredicate(protocolVersion)
    }

    return false
  }

  async supportsMultiDb () {
    return await this._hasProtocolVersion(
      version => version >= BOLT_PROTOCOL_V4_0
    )
  }

  getNegotiatedProtocolVersion () {
    return new Promise((resolve, reject) => {
      this._hasProtocolVersion(resolve)
        .catch(reject)
    })
  }

  async supportsTransactionConfig () {
    return await this._hasProtocolVersion(
      version => version >= BOLT_PROTOCOL_V3
    )
  }

  async supportsUserImpersonation () {
    return await this._hasProtocolVersion(
      version => version >= BOLT_PROTOCOL_V4_4
    )
  }

  async verifyConnectivityAndGetServerInfo () {
    return await this._verifyConnectivityAndGetServerVersion({ address: this._address })
  }
}

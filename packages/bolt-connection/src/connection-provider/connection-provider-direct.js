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

import PooledConnectionProvider from './connection-provider-pooled'
import {
  DelegateConnection,
  ConnectionErrorHandler
} from '../connection'
import { internal, error } from 'neo4j-driver-core'

const {
  constants: {
    BOLT_PROTOCOL_V3,
    BOLT_PROTOCOL_V4_0,
    BOLT_PROTOCOL_V4_4,
    BOLT_PROTOCOL_V5_1
  }
} = internal

const { SERVICE_UNAVAILABLE } = error

export default class DirectConnectionProvider extends PooledConnectionProvider {
  constructor ({ id, config, log, address, userAgent, boltAgent, authTokenManager, newPool }) {
    super({ id, config, log, userAgent, boltAgent, authTokenManager, newPool })

    this._address = address
  }

  /**
   * See {@link ConnectionProvider} for more information about this method and
   * its arguments.
   */
  async acquireConnection ({ accessMode, database, bookmarks, auth, forceReAuth } = {}) {
    const databaseSpecificErrorHandler = ConnectionErrorHandler.create({
      errorCode: SERVICE_UNAVAILABLE,
      handleSecurityError: (error, address, conn) =>
        this._handleSecurityError(error, address, conn, database)
    })

    const connection = await this._connectionPool.acquire({ auth, forceReAuth }, this._address)

    if (auth) {
      await this._verifyStickyConnection({
        auth,
        connection,
        address: this._address
      })
      return connection
    }

    return new DelegateConnection(connection, databaseSpecificErrorHandler)
  }

  _handleSecurityError (error, address, connection, database) {
    this._log.warn(
      `Direct driver ${this._id} will close connection to ${address} for database '${database}' because of an error ${error.code} '${error.message}'`
    )

    return super._handleSecurityError(error, address, connection)
  }

  async _hasProtocolVersion (versionPredicate) {
    const connection = await this._createChannelConnection(this._address)

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

  async supportsSessionAuth () {
    return await this._hasProtocolVersion(
      version => version >= BOLT_PROTOCOL_V5_1
    )
  }

  async verifyAuthentication ({ auth }) {
    return this._verifyAuthentication({
      auth,
      getAddress: () => this._address
    })
  }

  async verifyConnectivityAndGetServerInfo () {
    return await this._verifyConnectivityAndGetServerVersion({ address: this._address })
  }
}

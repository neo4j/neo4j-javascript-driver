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

import PooledConnectionProvider from './connection-provider-pooled'
import {
  createChannelConnection,
  DelegateConnection,
  ConnectionErrorHandler
} from '../connection'
import { internal, error } from 'neo4j-driver-core'

const {
  constants: { BOLT_PROTOCOL_V3, BOLT_PROTOCOL_V4_0, BOLT_PROTOCOL_V4_4 }
} = internal

const { SERVICE_UNAVAILABLE, newError } = error

export default class DirectConnectionProvider extends PooledConnectionProvider {
  constructor ({ id, config, log, address, userAgent, authToken }) {
    super({ id, config, log, userAgent, authToken })

    this._address = address
  }

  /**
   * See {@link ConnectionProvider} for more information about this method and
   * its arguments.
   */
  acquireConnection ({ accessMode, database, bookmarks } = {}) {
    const databaseSpecificErrorHandler = ConnectionErrorHandler.create({
      errorCode: SERVICE_UNAVAILABLE,
      handleAuthorizationExpired: (error, address) =>
        this._handleAuthorizationExpired(error, address, database)
    })

    return this._connectionPool
      .acquire(this._address)
      .then(
        connection =>
          new DelegateConnection(connection, databaseSpecificErrorHandler)
      )
  }

  _handleAuthorizationExpired (error, address, database) {
    this._log.warn(
      `Direct driver ${this._id} will close connection to ${address} for database '${database}' because of an error ${error.code} '${error.message}'`
    )
    this._connectionPool.purge(address).catch(() => {})
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
}

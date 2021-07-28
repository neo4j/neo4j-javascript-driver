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

import { ConnectionHolder } from './connection-holder'
import ConnectionProvider from '../connection-provider'
import { ACCESS_MODE_READ } from './constants'
import { newError } from '../error'
import { ServerInfo } from '../result-summary'

/**
 * Verifies connectivity using the given connection provider.
 */
export class ConnectivityVerifier {
  private readonly _connectionProvider: ConnectionProvider

  /**
   * @constructor
   * @param {ConnectionProvider} connectionProvider the provider to obtain connections from.
   */
  constructor(connectionProvider: ConnectionProvider) {
    this._connectionProvider = connectionProvider
  }

  /**
   * Try to obtain a working connection from the connection provider.
   * @returns {Promise<object>} promise resolved with server info or rejected with error.
   */
  verify({ database = '' } = {}): Promise<ServerInfo> {
    return acquireAndReleaseDummyConnection(this._connectionProvider, database)
  }
}

/**
 * @private
 * @param {ConnectionProvider} connectionProvider the provider to obtain connections from.
 * @param {string|undefined} database The database name
 * @return {Promise<object>} promise resolved with server info or rejected with error.
 */
function acquireAndReleaseDummyConnection(
  connectionProvider: ConnectionProvider,
  database?: string
): Promise<ServerInfo> {
  const connectionHolder = new ConnectionHolder({
    mode: ACCESS_MODE_READ,
    database,
    connectionProvider
  })
  connectionHolder.initializeConnection()

  return connectionHolder
    .getConnection()
    .then(connection => {
      // able to establish a connection
      if (!connection) {
        throw newError('Unexpected error acquiring transaction')
      }
      return connectionHolder.close().then(() => connection.server)
    })
    .catch(error => {
      // failed to establish a connection
      return connectionHolder
        .close()
        .catch(ignoredError => {
          // ignore connection release error
        })
        .then(() => {
          return Promise.reject(error)
        })
    })
}

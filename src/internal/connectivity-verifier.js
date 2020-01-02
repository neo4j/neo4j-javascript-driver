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

import ConnectionHolder from './connection-holder'
import { READ } from '../driver'
import { ResultStreamObserver } from './stream-observers'

/**
 * Verifies connectivity using the given connection provider.
 */
export default class ConnectivityVerifier {
  /**
   * @constructor
   * @param {ConnectionProvider} connectionProvider the provider to obtain connections from.
   */
  constructor (connectionProvider) {
    this._connectionProvider = connectionProvider
  }

  /**
   * Try to obtain a working connection from the connection provider.
   * @returns {Promise<object>} promise resolved with server info or rejected with error.
   */
  verify ({ database = '' } = {}) {
    return acquireAndReleaseDummyConnection(this._connectionProvider, database)
  }
}

/**
 * @private
 * @param {ConnectionProvider} connectionProvider the provider to obtain connections from.
 * @return {Promise<object>} promise resolved with server info or rejected with error.
 */
function acquireAndReleaseDummyConnection (connectionProvider, database) {
  const connectionHolder = new ConnectionHolder({
    mode: READ,
    database,
    connectionProvider
  })
  connectionHolder.initializeConnection()

  return connectionHolder
    .getConnection()
    .then(connection => {
      // able to establish a connection
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

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

import Connection from './connection.ts'
import { bookmarks } from './internal/index.ts'
import { ServerInfo } from './result-summary.ts'
import { AuthToken } from './types.ts'

/**
 * Interface define a releasable resource shape
 *
 * @private
 * @interface
 */
class Releasable {
  /**
   * @returns {Promise<void>}
   */
  release (): Promise<void> {
    throw new Error('Not implemented')
  }
}

/**
 * Interface define a common way to acquire a connection
 *
 * @private
 */
class ConnectionProvider {
  /**
   * This method acquires a connection against the specified database.
   *
   * Access mode and Bookmarks only applies to routing driver. Access mode only
   * differentiates the target server for the connection, where WRITE selects a
   * WRITER server, whereas READ selects a READ server. Bookmarks, when specified,
   * is only passed to the routing discovery procedure, for the system database to
   * synchronize on creation of databases and is never used in direct drivers.
   *
   * @param {object} param - object parameter
   * @property {string} param.accessMode - the access mode for the to-be-acquired connection
   * @property {string} param.database - the target database for the to-be-acquired connection
   * @property {Bookmarks} param.bookmarks - the bookmarks to send to routing discovery
   * @property {string} param.impersonatedUser - the impersonated user
   * @property {function (databaseName:string?)} param.onDatabaseNameResolved - Callback called when the database name get resolved
   * @returns {Promise<Connection>}
   */
  acquireConnection (param?: {
    accessMode?: string
    database?: string
    bookmarks: bookmarks.Bookmarks
    impersonatedUser?: string
    onDatabaseNameResolved?: (databaseName?: string) => void
    auth?: AuthToken
  }): Promise<Connection & Releasable> {
    throw Error('Not implemented')
  }

  /**
   * This method checks whether the backend database supports multi database functionality
   * by checking protocol handshake result.
   *
   * @returns {Promise<boolean>}
   */
  supportsMultiDb (): Promise<boolean> {
    throw Error('Not implemented')
  }

  /**
   * This method checks whether the backend database supports transaction config functionality
   * by checking protocol handshake result.
   *
   * @returns {Promise<boolean>}
   */
  supportsTransactionConfig (): Promise<boolean> {
    throw Error('Not implemented')
  }

  /**
   * This method checks whether the backend database supports user impersonation functionality
   * by checking protocol handshake result.
   *
   * @returns {Promise<boolean>}
   */
  supportsUserImpersonation (): Promise<boolean> {
    throw Error('Not implemented')
  }

  /**
   * This method checks whether the driver session re-auth functionality
   * by checking protocol handshake result
   *
   * @returns {Promise<boolean>}
   */
  supportsSessionAuth (): Promise<boolean> {
    throw Error('Not implemented')
  }

  /**
   * This method verifies the connectivity of the database by trying to acquire a connection
   * for each server available in the cluster.
   *
   * @param {object} param - object parameter
   * @property {string} param.database - the target database for the to-be-acquired connection
   * @property {string} param.accessMode - the access mode for the to-be-acquired connection
   *
   * @returns {Promise<ServerInfo>} promise resolved with server info or rejected with error.
   */
  verifyConnectivityAndGetServerInfo (param?: { database?: string, accessMode?: string }): Promise<ServerInfo> {
    throw Error('Not implemented')
  }

  /**
   * This method verifies the authorization credentials work by trying to acquire a connection
   * to one of the servers with the given credentials.
   *
   * @param {object} param - object parameter
   * @property {AuthToken} param.auth - the target auth for the to-be-acquired connection
   * @property {string} param.database - the target database for the to-be-acquired connection
   * @property {string} param.accessMode - the access mode for the to-be-acquired connection
   *
   * @returns {Promise<boolean>} promise resolved with true if succeed, false if failed with
   *  authentication issue and rejected with error if non-authentication error happens.
   */
  verifyAuthentication (param?: { auth?: AuthToken, database?: string, accessMode?: string }): Promise<boolean> {
    throw Error('Not implemented')
  }

  /**
   * Returns the protocol version negotiated via handshake.
   *
   * Note that this function call _always_ causes a round-trip to the server.
   *
   * @returns {Promise<number>} the protocol version negotiated via handshake.
   * @throws {Error} When protocol negotiation fails
   */
  getNegotiatedProtocolVersion (): Promise<number> {
    throw Error('Not Implemented')
  }

  /**
   * Closes this connection provider along with its internals (connections, pools, etc.)
   *
   * @returns {Promise<void>}
   */
  close (): Promise<void> {
    throw Error('Not implemented')
  }
}

export default ConnectionProvider
export {
  Releasable
}

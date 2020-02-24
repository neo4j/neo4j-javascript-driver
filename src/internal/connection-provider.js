import Bookmark from './bookmark'

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

export default class ConnectionProvider {
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
   * @param {string} param.accessMode - the access mode for the to-be-acquired connection
   * @param {string} param.database - the target database for the to-be-acquired connection
   * @param {Bookmark} param.bookmarks - the bookmarks to send to routing discovery
   */
  acquireConnection ({ accessMode, database, bookmarks } = {}) {
    throw new Error('not implemented')
  }

  /**
   * This method checks whether the backend database supports multi database functionality
   * by checking protocol handshake result.
   *
   * @returns {Promise<boolean>}
   */
  supportsMultiDb () {
    throw new Error('not implemented')
  }

  /**
   * This method checks whether the backend database supports transaction config functionality
   * by checking protocol handshake result.
   *
   * @returns {Promise<boolean>}
   */
  supportsTransactionConfig () {
    throw new Error('not implemented')
  }

  /**
   * Closes this connection provider along with its internals (connections, pools, etc.)
   *
   * @returns {Promise<void>}
   */
  close () {
    throw new Error('not implemented')
  }
}

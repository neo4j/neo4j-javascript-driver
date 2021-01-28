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
import ConnectionHolder from './connection-holder'

/**
 * Provides a interaction with a ConnectionHolder without change it state by
 * releasing or initilizing
 */
export default class ReadOnlyConnectionHolder extends ConnectionHolder {
  /**
   * Contructor
   * @param {ConnectionHolder} connectionHolder the connection holder which will treat the requests
   */
  constructor (connectionHolder) {
    super({
      mode: connectionHolder._mode,
      database: connectionHolder._database,
      bookmark: connectionHolder._bookmark,
      connectionProvider: connectionHolder._connectionProvider
    })
    this._connectionHolder = connectionHolder
  }

  /**
   * Return the true if the connection is suppose to be initilized with the command.
   *
   * @return {boolean}
   */
  initializeConnection () {
    if (this._connectionHolder._referenceCount === 0) {
      return false
    }
    return true
  }

  /**
   * Get the current connection promise.
   * @return {Promise<Connection>} promise resolved with the current connection.
   */
  getConnection () {
    return this._connectionHolder.getConnection()
  }

  /**
   * Get the current connection promise, doesn't performs the release
   * @return {Promise<Connection>} promise with the resolved current connection
   */
  releaseConnection () {
    return this._connectionHolder.getConnection().catch(() => Promise.resolve())
  }

  /**
   * Get the current connection promise, doesn't performs the connection close
   * @return {Promise<Connection>} promise with the resolved current connection
   */
  close () {
    return this._connectionHolder
      .getConnection()
      .catch(() => () => Promise.resolve())
  }
}

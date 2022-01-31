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

import { Driver as CoreDriver, driver, internal } from 'neo4j-driver-core'
import RxSession from './session-rx'

const {
  constants: { FETCH_ALL }
} = internal

const { READ, WRITE } = driver

/**
 * A driver maintains one or more {@link Session}s with a remote
 * Neo4j instance. Through the {@link Session}s you can send queries
 * and retrieve results from the database.
 *
 * Drivers are reasonably expensive to create - you should strive to keep one
 * driver instance around per Neo4j Instance you connect to.
 *
 * @access public
 */
class Driver extends CoreDriver {
  /**
   * Acquire a reactive session to communicate with the database. The session will
   * borrow connections from the underlying connection pool as required and
   * should be considered lightweight and disposable.
   *
   * This comes with some responsibility - make sure you always call
   * {@link close} when you are done using a session, and likewise,
   * make sure you don't close your session before you are done using it. Once
   * it is closed, the underlying connection will be released to the connection
   * pool and made available for others to use.
   *
   * @public
   * @param {Object} param
   * @param {string} param.defaultAccessMode=WRITE - The access mode of this session, allowed values are {@link READ} and {@link WRITE}.
   * @param {string|string[]} param.bookmarks - The initial reference or references to some previous transactions. Value is optional and
   * absence indicates that the bookmarks do not exist or are unknown.
   * @param {string} param.database - The database this session will operate on.
   * @param {string} param.impersonatedUser - The name of the user which should be impersonated for the duration of the session.
   * @returns {RxSession} new reactive session.
   */
  rxSession ({
    defaultAccessMode = WRITE,
    bookmarks,
    database = '',
    fetchSize,
    impersonatedUser
  } = {}) {
    return new RxSession({
      session: this._newSession({
        defaultAccessMode,
        bookmarkOrBookmarks: bookmarks,
        database,
        impersonatedUser,
        reactive: true,
        fetchSize: validateFetchSizeValue(fetchSize, this._config.fetchSize)
      }),
      config: this._config
    })
  }
}

/**
 * @private
 */
function validateFetchSizeValue (rawValue, defaultWhenAbsent) {
  const fetchSize = parseInt(rawValue, 10)
  if (fetchSize > 0 || fetchSize === FETCH_ALL) {
    return fetchSize
  } else if (fetchSize === 0 || fetchSize < 0) {
    throw new Error(
      `The fetch size can only be a positive value or ${FETCH_ALL} for ALL. However fetchSize = ${fetchSize}`
    )
  } else {
    return defaultWhenAbsent
  }
}

export { Driver, READ, WRITE }

export default Driver

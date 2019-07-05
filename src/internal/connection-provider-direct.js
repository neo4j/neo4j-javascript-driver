/**
 * Copyright (c) 2002-2019 "Neo4j,"
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

import ConnectionProvider from './connection-provider'

export default class DirectConnectionProvider extends ConnectionProvider {
  constructor (address, connectionPool, driverOnErrorCallback) {
    super()
    this._address = address
    this._connectionPool = connectionPool
    this._driverOnErrorCallback = driverOnErrorCallback
  }

  acquireConnection (accessMode, database) {
    const connectionPromise = this._connectionPool.acquire(this._address)
    return this._withAdditionalOnErrorCallback(
      connectionPromise,
      this._driverOnErrorCallback
    )
  }
}

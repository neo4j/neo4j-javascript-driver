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

export default class ConnectionProvider {
  acquireConnection (accessMode, database) {
    throw new Error('Abstract function')
  }

  _withAdditionalOnErrorCallback (connectionPromise, driverOnErrorCallback) {
    // install error handler from the driver on the connection promise; this callback is installed separately
    // so that it does not handle errors, instead it is just an additional error reporting facility.
    connectionPromise.catch(error => {
      driverOnErrorCallback(error)
    })
    // return the original connection promise
    return connectionPromise
  }
}

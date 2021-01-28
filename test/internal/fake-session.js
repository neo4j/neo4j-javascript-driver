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

export default class FakeSession {
  constructor (runResponse, fakeConnection) {
    this._runResponse = runResponse
    this._fakeConnection = fakeConnection
    this._closed = false
  }

  static successful (result) {
    return new FakeSession(Promise.resolve(result), null)
  }

  static failed (error) {
    return new FakeSession(Promise.reject(error), null)
  }

  static withFakeConnection (connection) {
    return new FakeSession(null, connection)
  }

  _run (ignoreQuery, ignoreParameters, queryRunner) {
    if (this._runResponse) {
      return this._runResponse
    }
    queryRunner(this._fakeConnection)
    return Promise.resolve()
  }

  withBookmark (bookmark) {
    this._lastBookmark = bookmark
    return this
  }

  withDatabase (database) {
    this._database = database || ''
    return this
  }

  withMode (mode) {
    this._mode = mode
    return this
  }

  withOnComplete (onComplete) {
    this._onComplete = onComplete
    return this
  }

  close () {
    this._closed = true
    return Promise.resolve()
  }

  isClosed () {
    return this._closed
  }
}

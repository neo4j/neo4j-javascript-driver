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

import Connection from './connection'

export default class DelegateConnection extends Connection {
  /**
   * @param delegate {Connection} the delegated connection
   * @param errorHandler {ConnectionErrorHandler} the error handler
   */
  constructor (delegate, errorHandler) {
    super(errorHandler)

    if (errorHandler) {
      this._originalErrorHandler = delegate._errorHandler
      delegate._errorHandler = this._errorHandler
    }

    this._delegate = delegate
  }

  get id () {
    return this._delegate.id
  }

  get databaseId () {
    return this._delegate.databaseId
  }

  set databaseId (value) {
    this._delegate.databaseId = value
  }

  get server () {
    return this._delegate.server
  }

  get address () {
    return this._delegate.address
  }

  get version () {
    return this._delegate.version
  }

  set version (value) {
    this._delegate.version = value
  }

  isOpen () {
    return this._delegate.isOpen()
  }

  protocol () {
    return this._delegate.protocol()
  }

  connect (userAgent, authToken) {
    return this._delegate.connect(userAgent, authToken)
  }

  write (message, observer, flush) {
    return this._delegate.write(message, observer, flush)
  }

  resetAndFlush () {
    return this._delegate.resetAndFlush()
  }

  close () {
    return this._delegate.close()
  }

  _release () {
    if (this._originalErrorHandler) {
      this._delegate._errorHandler = this._originalErrorHandler
    }

    return this._delegate._release()
  }
}

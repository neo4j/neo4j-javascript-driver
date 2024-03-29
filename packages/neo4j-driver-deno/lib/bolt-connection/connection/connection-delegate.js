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

import Connection from './connection.js'

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

  beginTransaction (config) {
    return this._delegate.beginTransaction(config)
  }

  run (query, param, config) {
    return this._delegate.run(query, param, config)
  }

  commitTransaction (config) {
    return this._delegate.commitTransaction(config)
  }

  rollbackTransaction (config) {
    return this._delegate.rollbackTransaction(config)
  }

  getProtocolVersion () {
    return this._delegate.getProtocolVersion()
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

  get authToken () {
    return this._delegate.authToken
  }

  get supportsReAuth () {
    return this._delegate.supportsReAuth
  }

  set authToken (value) {
    this._delegate.authToken = value
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

  get creationTimestamp () {
    return this._delegate.creationTimestamp
  }

  set idleTimestamp (value) {
    this._delegate.idleTimestamp = value
  }

  get idleTimestamp () {
    return this._delegate.idleTimestamp
  }

  isOpen () {
    return this._delegate.isOpen()
  }

  protocol () {
    return this._delegate.protocol()
  }

  connect (userAgent, boltAgent, authToken, waitReAuth) {
    return this._delegate.connect(userAgent, boltAgent, authToken, waitReAuth)
  }

  write (message, observer, flush) {
    return this._delegate.write(message, observer, flush)
  }

  resetAndFlush () {
    return this._delegate.resetAndFlush()
  }

  hasOngoingObservableRequests () {
    return this._delegate.hasOngoingObservableRequests()
  }

  close () {
    return this._delegate.close()
  }

  release () {
    if (this._originalErrorHandler) {
      this._delegate._errorHandler = this._originalErrorHandler
    }

    return this._delegate.release()
  }
}

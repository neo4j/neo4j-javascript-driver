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

import { ResultStreamObserver, BoltProtocol } from '../bolt'

export default class Connection {
  /**
   * @param {ConnectionErrorHandler} errorHandler the error handler
   */
  constructor (errorHandler) {
    this._errorHandler = errorHandler
  }

  get id () {
    throw new Error('not implemented')
  }

  get databaseId () {
    throw new Error('not implemented')
  }

  set databaseId (value) {
    throw new Error('not implemented')
  }

  /**
   * @returns {boolean} whether this connection is in a working condition
   */
  isOpen () {
    throw new Error('not implemented')
  }

  /**
   * @returns {BoltProtocol} the underlying bolt protocol assigned to this connection
   */
  protocol () {
    throw new Error('not implemented')
  }

  /**
   * @returns {ServerAddress} the server address this connection is opened against
   */
  get address () {
    throw new Error('not implemented')
  }

  /**
   * @returns {ServerVersion} the version of the server this connection is connected to
   */
  get version () {
    throw new Error('not implemented')
  }

  set version (value) {
    throw new Error('not implemented')
  }

  get server () {
    throw new Error('not implemented')
  }

  /**
   * Connect to the target address, negotiate Bolt protocol and send initialization message.
   * @param {string} userAgent the user agent for this driver.
   * @param {Object} authToken the object containing auth information.
   * @return {Promise<Connection>} promise resolved with the current connection if connection is successful. Rejected promise otherwise.
   */
  connect (userAgent, authToken) {
    throw new Error('not implemented')
  }

  /**
   * Write a message to the network channel.
   * @param {RequestMessage} message the message to write.
   * @param {ResultStreamObserver} observer the response observer.
   * @param {boolean} flush `true` if flush should happen after the message is written to the buffer.
   */
  write (message, observer, flush) {
    throw new Error('not implemented')
  }

  /**
   * Send a RESET-message to the database. Message is immediately flushed to the network.
   * @return {Promise<void>} promise resolved when SUCCESS-message response arrives, or failed when other response messages arrives.
   */
  resetAndFlush () {
    throw new Error('not implemented')
  }

  /**
   * Call close on the channel.
   * @returns {Promise<void>} - A promise that will be resolved when the connection is closed.
   *
   */
  close () {
    throw new Error('not implemented')
  }

  /**
   *
   * @param error
   * @param address
   * @returns {Neo4jError|*}
   */
  handleAndTransformError (error, address) {
    if (this._errorHandler) {
      return this._errorHandler.handleAndTransformError(error, address)
    }

    return error
  }
}

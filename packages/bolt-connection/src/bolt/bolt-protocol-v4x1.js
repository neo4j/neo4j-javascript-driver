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
import BoltProtocolV4 from './bolt-protocol-v4x0'
import RequestMessage from './request-message'
import { LoginObserver } from './stream-observers'
import { internal } from 'neo4j-driver-core'

const {
  constants: { BOLT_PROTOCOL_V4_1 }
} = internal

export default class BoltProtocol extends BoltProtocolV4 {
  /**
   * @constructor
   * @param {Object} server the server informatio.
   * @param {Chunker} chunker the chunker.
   * @param {Object} packstreamConfig Packstream configuration
   * @param {boolean} packstreamConfig.disableLosslessIntegers if this connection should convert all received integers to native JS numbers.
   * @param {boolean} packstreamConfig.useBigInt if this connection should convert all received integers to native BigInt numbers.
   * @param {CreateResponseHandler} createResponseHandler Function which creates the response handler
   * @param {Logger} log the logger
   * @param {Object} serversideRouting
   *
   */
  constructor (
    server,
    chunker,
    packstreamConfig,
    createResponseHandler = () => null,
    log,
    onProtocolError,
    serversideRouting
  ) {
    super(
      server,
      chunker,
      packstreamConfig,
      createResponseHandler,
      log,
      onProtocolError
    )
    this._serversideRouting = serversideRouting
  }

  get version () {
    return BOLT_PROTOCOL_V4_1
  }

  initialize ({ userAgent, authToken, onError, onComplete } = {}) {
    const observer = new LoginObserver({
      onError: error => this._onLoginError(error, onError),
      onCompleted: metadata => this._onLoginCompleted(metadata, onComplete)
    })

    this.write(
      RequestMessage.hello(userAgent, authToken, this._serversideRouting),
      observer,
      true
    )

    return observer
  }
}

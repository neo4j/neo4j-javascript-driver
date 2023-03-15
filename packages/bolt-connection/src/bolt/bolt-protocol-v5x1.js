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
import BoltProtocolV5x0 from './bolt-protocol-v5x0'

import { assertNotificationFilterIsEmpty } from './bolt-protocol-util'
import transformersFactories from './bolt-protocol-v5x1.transformer'
import Transformer from './transformer'
import RequestMessage from './request-message'
import { LoginObserver, LogoffObserver } from './stream-observers'

import { internal } from 'neo4j-driver-core'

const {
  constants: { BOLT_PROTOCOL_V5_1 }
} = internal

export default class BoltProtocol extends BoltProtocolV5x0 {
  get version () {
    return BOLT_PROTOCOL_V5_1
  }

  get transformer () {
    if (this._transformer === undefined) {
      this._transformer = new Transformer(Object.values(transformersFactories).map(create => create(this._config, this._log)))
    }
    return this._transformer
  }

  get supportsReAuth () {
    return true
  }

  /**
   * Initialize a connection with the server
   *
   * @param {Object} args The params
   * @param {string} args.userAgent The user agent
   * @param {any} args.authToken The auth token
   * @param {NotificationFilter} args.notificationFilter The notification filters.
   * @param {function(error)} args.onError On error callback
   * @param {function(onComplete)} args.onComplete On complete callback
   * @returns {LoginObserver} The Login observer
   */
  initialize ({ userAgent, authToken, notificationFilter, onError, onComplete } = {}) {
    const state = {}
    const observer = new LoginObserver({
      onError: error => this._onLoginError(error, onError),
      onCompleted: metadata => {
        state.metadata = metadata
        return this._onLoginCompleted(metadata)
      }
    })

    // passing notification filter on this protocol version throws an error
    assertNotificationFilterIsEmpty(notificationFilter, this._onProtocolError, observer)

    this.write(
      RequestMessage.hello5x1(userAgent, this._serversideRouting),
      observer,
      false
    )

    return this.logon({
      authToken,
      onComplete: metadata => onComplete({ ...metadata, ...state.metadata }),
      onError,
      flush: true
    })
  }

  /**
   * Performs login of the underlying connection
   *
   * @param {Object} args
   * @param {Object} args.authToken the authentication token.
   * @param {function(err: Error)} args.onError the callback to invoke on error.
   * @param {function()} args.onComplete the callback to invoke on completion.
   * @param {boolean} args.flush whether to flush the buffered messages.
   *
   * @returns {StreamObserver} the stream observer that monitors the corresponding server response.
   */
  logon ({ authToken, onComplete, onError, flush } = {}) {
    const observer = new LoginObserver({
      onCompleted: () => this._onLoginCompleted(null, authToken, onComplete),
      onError: (error) => this._onLoginError(error, onError)
    })

    this.write(
      RequestMessage.logon(authToken),
      observer,
      flush
    )

    return observer
  }

  /**
   * Performs logoff of the underlying connection
   *
   * @param {Object} param
   * @param {function(err: Error)} param.onError the callback to invoke on error.
   * @param {function()} param.onComplete the callback to invoke on completion.
   * @param {boolean} param.flush whether to flush the buffered messages.
   *
   * @returns {StreamObserver} the stream observer that monitors the corresponding server response.
  */
  logoff ({ onComplete, onError, flush } = {}) {
    const observer = new LogoffObserver({
      onCompleted: onComplete,
      onError: onError
    })

    this.write(
      RequestMessage.logoff(),
      observer,
      flush
    )

    return observer
  }
}

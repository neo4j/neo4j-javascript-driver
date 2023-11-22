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
import BoltProtocolV44 from './bolt-protocol-v4x4'

import { assertNotificationFilterIsEmpty } from './bolt-protocol-util'
import transformersFactories from './bolt-protocol-v5x0.transformer'
import Transformer from './transformer'
import RequestMessage from './request-message'
import { LoginObserver } from './stream-observers'

import { internal } from 'neo4j-driver-core'

const {
  constants: { BOLT_PROTOCOL_V5_0 }
} = internal

export default class BoltProtocol extends BoltProtocolV44 {
  get version () {
    return BOLT_PROTOCOL_V5_0
  }

  get transformer () {
    if (this._transformer === undefined) {
      this._transformer = new Transformer(Object.values(transformersFactories).map(create => create(this._config, this._log)))
    }
    return this._transformer
  }

  /**
   * Initialize a connection with the server
   *
   * @param {Object} args The params
   * @param {string} args.userAgent The user agent
   * @param {any} args.authToken The auth token
   * @param {NotificationFilter} args.notificationFilter The notification filter.
   * @param {function(error)} args.onError On error callback
   * @param {function(onComplte)} args.onComplete On complete callback
   * @returns {LoginObserver} The Login observer
   */
  initialize ({ userAgent, boltAgent, authToken, notificationFilter, onError, onComplete } = {}) {
    const observer = new LoginObserver({
      onError: error => this._onLoginError(error, onError),
      onCompleted: metadata => this._onLoginCompleted(metadata, authToken, onComplete)
    })

    // passing notification filter on this protocol version throws an error
    assertNotificationFilterIsEmpty(notificationFilter, this._onProtocolError, observer)

    this.write(
      RequestMessage.hello(userAgent, authToken, this._serversideRouting),
      observer,
      true
    )

    return observer
  }
}

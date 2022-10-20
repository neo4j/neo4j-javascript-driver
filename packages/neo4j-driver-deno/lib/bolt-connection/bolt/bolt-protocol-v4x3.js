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
import BoltProtocolV42 from './bolt-protocol-v4x2.js'
import RequestMessage from './request-message.js'
import { LoginObserver, RouteObserver } from './stream-observers.js'

import transformersFactories from './bolt-protocol-v4x3.transformer.js'
import utcTransformersFactories from './bolt-protocol-v5x0.utc.transformer.js'
import Transformer from './transformer.js'

import { internal } from '../../core/index.ts'
import { assertNotificationFiltersIsEmpty } from './bolt-protocol-util.js'

const {
  bookmarks: { Bookmarks },
  constants: { BOLT_PROTOCOL_V4_3 }
} = internal

export default class BoltProtocol extends BoltProtocolV42 {
  get version () {
    return BOLT_PROTOCOL_V4_3
  }

  get transformer () {
    if (this._transformer === undefined) {
      this._transformer = new Transformer(Object.values(transformersFactories).map(create => create(this._config, this._log)))
    }
    return this._transformer
  }

  /**
   * Request routing information
   *
   * @param {Object} param -
   * @param {object} param.routingContext The routing context used to define the routing table.
   *  Multi-datacenter deployments is one of its use cases
   * @param {string} param.databaseName The database name
   * @param {Bookmarks} params.sessionContext.bookmarks The bookmarks used for requesting the routing table
   * @param {function(err: Error)} param.onError
   * @param {function(RawRoutingTable)} param.onCompleted
   * @returns {RouteObserver} the route observer
   */
  requestRoutingInformation ({
    routingContext = {},
    databaseName = null,
    sessionContext = {},
    onError,
    onCompleted
  }) {
    const observer = new RouteObserver({
      onProtocolError: this._onProtocolError,
      onError,
      onCompleted
    })
    const bookmarks = sessionContext.bookmarks || Bookmarks.empty()
    this.write(
      RequestMessage.route(routingContext, bookmarks.values(), databaseName),
      observer,
      true
    )

    return observer
  }

  /**
   * Initialize a connection with the server
   *
   * @param {Object} param0 The params
   * @param {string} param0.userAgent The user agent
   * @param {any} param0.authToken The auth token
   * @param {function(error)} param0.onError On error callback
   * @param {function(onComplte)} param0.onComplete On complete callback
   * @param {?string[]} param0.notificationFilters the filtering for notifications.
   * @returns {LoginObserver} The Login observer
   */
  initialize ({ userAgent, authToken, onError, onComplete, notificationFilters } = {}) {
    const observer = new LoginObserver({
      onError: error => this._onLoginError(error, onError),
      onCompleted: metadata => {
        if (metadata.patch_bolt !== undefined) {
          this._applyPatches(metadata.patch_bolt)
        }
        return this._onLoginCompleted(metadata, onComplete)
      }
    })

    // passing notification filters user on this protocol version throws an error
    assertNotificationFiltersIsEmpty(notificationFilters, this._onProtocolError, observer)

    this.write(
      RequestMessage.hello(userAgent, authToken, this._serversideRouting, ['utc']),
      observer,
      true
    )

    return observer
  }

  /**
   *
   * @param {string[]} patches Patches to be applied to the protocol
   */
  _applyPatches (patches) {
    if (patches.includes('utc')) {
      this._applyUtcPatch()
    }
  }

  _applyUtcPatch () {
    this._transformer = new Transformer(Object.values({
      ...transformersFactories,
      ...utcTransformersFactories
    }).map(create => create(this._config, this._log)))
  }
}

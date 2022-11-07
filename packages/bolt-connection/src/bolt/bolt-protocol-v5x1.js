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

import transformersFactories from './bolt-protocol-v5x1.transformer'
import Transformer from './transformer'
import RequestMessage from './request-message'
import { LoginObserver, ResultStreamObserver } from './stream-observers'

import { internal } from 'neo4j-driver-core'

const {
  constants: { BOLT_PROTOCOL_V5_1, FETCH_ALL }
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

  /**
   * Initialize a connection with the server
   *
   * @param {Object} param0 The params
   * @param {string} param0.userAgent The user agent
   * @param {any} param0.authToken The auth token
   * @param {function(error)} param0.onError On error callback
   * @param {function(onComplete)} param0.onComplete On complete callback
   * @param {?string[]} param0.notificationFilters the filtering for notifications.
   * @returns {LoginObserver} The Login observer
   */
  initialize ({ userAgent, authToken, onError, onComplete, notificationFilters } = {}) {
    const observer = new LoginObserver({
      onError: error => this._onLoginError(error, onError),
      onCompleted: metadata => this._onLoginCompleted(metadata, onComplete)
    })

    this.write(
      RequestMessage.hello5x1(authToken, {
        userAgent,
        notificationFilters: sanitizeNotificationFilters(notificationFilters),
        routing: this._serversideRouting
      }),
      observer,
      true
    )

    return observer
  }

  run (
    query,
    parameters,
    {
      bookmarks,
      txConfig,
      database,
      mode,
      impersonatedUser,
      notificationFilters,
      beforeKeys,
      afterKeys,
      beforeError,
      afterError,
      beforeComplete,
      afterComplete,
      flush = true,
      reactive = false,
      fetchSize = FETCH_ALL,
      highRecordWatermark = Number.MAX_VALUE,
      lowRecordWatermark = Number.MAX_VALUE
    } = {}
  ) {
    const observer = new ResultStreamObserver({
      server: this._server,
      reactive: reactive,
      fetchSize: fetchSize,
      moreFunction: this._requestMore.bind(this),
      discardFunction: this._requestDiscard.bind(this),
      beforeKeys,
      afterKeys,
      beforeError,
      afterError,
      beforeComplete,
      afterComplete,
      highRecordWatermark,
      lowRecordWatermark
    })

    const flushRun = reactive
    this.write(
      RequestMessage.runWithMetadata(query, parameters, {
        bookmarks,
        txConfig,
        database,
        mode,
        impersonatedUser,
        notificationFilters: sanitizeNotificationFilters(notificationFilters)
      }),
      observer,
      flushRun && flush
    )

    if (!reactive) {
      this.write(RequestMessage.pull({ n: fetchSize }), observer, flush)
    }

    return observer
  }

  beginTransaction ({
    bookmarks,
    txConfig,
    database,
    mode,
    impersonatedUser,
    notificationFilters,
    beforeError,
    afterError,
    beforeComplete,
    afterComplete
  } = {}) {
    const observer = new ResultStreamObserver({
      server: this._server,
      beforeError,
      afterError,
      beforeComplete,
      afterComplete
    })
    observer.prepareToHandleSingleResponse()

    this.write(
      RequestMessage.begin({
        bookmarks,
        txConfig,
        database,
        mode,
        impersonatedUser,
        notificationFilters: sanitizeNotificationFilters(notificationFilters)
      }),
      observer,
      true
    )

    return observer
  }
}

function sanitizeNotificationFilters (filters) {
  if (filters == null || filters === []) {
    return filters
  }

  if (filters[0] === 'NONE') {
    return []
  }

  if (filters[0] === 'SERVER_DEFAULT') {
    return null
  }

  return filters.map(filter => filter.replace(/^ALL\./, '*.').replace(/\.ALL$/, '.*'))
}

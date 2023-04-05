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
import BoltProtocolV5x1 from './bolt-protocol-v5x1'

import transformersFactories from './bolt-protocol-v5x2.transformer'
import Transformer from './transformer'
import RequestMessage from './request-message'
import { LoginObserver, ResultStreamObserver } from './stream-observers'

import { internal } from 'neo4j-driver-core'

const {
  constants: { BOLT_PROTOCOL_V5_2, FETCH_ALL }
} = internal

export default class BoltProtocol extends BoltProtocolV5x1 {
  get version () {
    return BOLT_PROTOCOL_V5_2
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
   * @param {string} args.boltAgent The bolt agent
   * @param {any} args.authToken The auth token
   * @param {NotificationFilter} args.notificationFilter The notification filters.
   * @param {function(error)} args.onError On error callback
   * @param {function(onComplete)} args.onComplete On complete callback
   * @returns {LoginObserver} The Login observer
   */
  initialize ({ userAgent, boltAgent, authToken, notificationFilter, onError, onComplete } = {}) {
    const state = {}
    const observer = new LoginObserver({
      onError: error => this._onLoginError(error, onError),
      onCompleted: metadata => {
        state.metadata = metadata
        return this._onLoginCompleted(metadata)
      }
    })

    this.write(
      // if useragent is null then for all versions before 5.3 it should be bolt agent by default
      RequestMessage.hello5x2(userAgent === '' || userAgent == null ? boltAgent : userAgent, notificationFilter, this._serversideRouting),
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

  beginTransaction ({
    bookmarks,
    txConfig,
    database,
    mode,
    impersonatedUser,
    notificationFilter,
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
      RequestMessage.begin({ bookmarks, txConfig, database, mode, impersonatedUser, notificationFilter }),
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
      notificationFilter,
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
        notificationFilter
      }),
      observer,
      flushRun && flush
    )

    if (!reactive) {
      this.write(RequestMessage.pull({ n: fetchSize }), observer, flush)
    }

    return observer
  }
}

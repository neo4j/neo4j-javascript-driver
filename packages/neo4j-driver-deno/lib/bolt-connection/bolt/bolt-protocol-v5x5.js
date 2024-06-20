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
import BoltProtocolV5x4 from './bolt-protocol-v5x4.js'

import transformersFactories from './bolt-protocol-v5x5.transformer.js'
import Transformer from './transformer.js'
import RequestMessage from './request-message.js'
import { LoginObserver, ResultStreamObserver } from './stream-observers.js'

import { internal } from '../../core/index.ts'

const {
  constants: { BOLT_PROTOCOL_V5_5, FETCH_ALL }
} = internal

const DEFAULT_DIAGNOSTIC_RECORD = Object.freeze({
  OPERATION: '',
  OPERATION_CODE: '0',
  CURRENT_SCHEMA: '/'
})

export default class BoltProtocol extends BoltProtocolV5x4 {
  get version () {
    return BOLT_PROTOCOL_V5_5
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
      RequestMessage.hello5x5(userAgent, boltAgent, notificationFilter, this._serversideRouting),
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
      RequestMessage.begin5x5({ bookmarks, txConfig, database, mode, impersonatedUser, notificationFilter }),
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
      reactive,
      fetchSize,
      moreFunction: this._requestMore.bind(this),
      discardFunction: this._requestDiscard.bind(this),
      beforeKeys,
      afterKeys,
      beforeError,
      afterError,
      beforeComplete,
      afterComplete,
      highRecordWatermark,
      lowRecordWatermark,
      enrichMetadata: BoltProtocol._enrichMetadata
    })

    const flushRun = reactive
    this.write(
      RequestMessage.runWithMetadata5x5(query, parameters, {
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

  /**
   *
   * @param {object} metadata
   * @returns {object}
   */
  static _enrichMetadata (metadata) {
    if (Array.isArray(metadata.statuses)) {
      metadata.statuses = metadata.statuses.map(status => ({
        ...status,
        diagnostic_record: status.diagnostic_record !== null ? { ...DEFAULT_DIAGNOSTIC_RECORD, ...status.diagnostic_record } : null
      }))
    }

    return metadata
  }
}

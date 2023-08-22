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
import BoltProtocolV3 from './bolt-protocol-v3.js'
import RequestMessage from './request-message.js'
import { assertImpersonatedUserIsEmpty, assertNotificationFilterIsEmpty } from './bolt-protocol-util.js'
import {
  ResultStreamObserver,
  ProcedureRouteObserver
} from './stream-observers.js'
import transformersFactories from './bolt-protocol-v4x0.transformer.js'
import Transformer from './transformer.js'

import { internal } from '../../core/index.ts'

const {
  // eslint-disable-next-line no-unused-vars
  bookmarks: { Bookmarks },
  constants: { BOLT_PROTOCOL_V4_0, FETCH_ALL },
  txConfig: { TxConfig }
} = internal

const CONTEXT = 'context'
const DATABASE = 'database'
const CALL_GET_ROUTING_TABLE_MULTI_DB = `CALL dbms.routing.getRoutingTable($${CONTEXT}, $${DATABASE})`

export default class BoltProtocol extends BoltProtocolV3 {
  get version () {
    return BOLT_PROTOCOL_V4_0
  }

  get transformer () {
    if (this._transformer === undefined) {
      this._transformer = new Transformer(Object.values(transformersFactories).map(create => create(this._config, this._log)))
    }
    return this._transformer
  }

  beginTransaction ({
    bookmarks,
    txConfig,
    database,
    impersonatedUser,
    notificationFilter,
    mode,
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

    // passing impersonated user on this protocol version throws an error
    assertImpersonatedUserIsEmpty(impersonatedUser, this._onProtocolError, observer)
    // passing notification filter on this protocol version throws an error
    assertNotificationFilterIsEmpty(notificationFilter, this._onProtocolError, observer)

    this.write(
      RequestMessage.begin({ bookmarks, txConfig, database, mode }),
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
      impersonatedUser,
      notificationFilter,
      mode,
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
      lowRecordWatermark
    })

    // passing impersonated user on this protocol version throws an error
    assertImpersonatedUserIsEmpty(impersonatedUser, this._onProtocolError, observer)
    // passing notification filter on this protocol version throws an error
    assertNotificationFilterIsEmpty(notificationFilter, this._onProtocolError, observer)

    const flushRun = reactive
    this.write(
      RequestMessage.runWithMetadata(query, parameters, {
        bookmarks,
        txConfig,
        database,
        mode
      }),
      observer,
      flushRun && flush
    )

    if (!reactive) {
      this.write(RequestMessage.pull({ n: fetchSize }), observer, flush)
    }

    return observer
  }

  _requestMore (stmtId, n, observer) {
    this.write(RequestMessage.pull({ stmtId, n }), observer, true)
  }

  _requestDiscard (stmtId, observer) {
    this.write(RequestMessage.discard({ stmtId }), observer, true)
  }

  _noOp () {}

  /**
   * Request routing information
   *
   * @param {Object} param -
   * @param {object} param.routingContext The routing context used to define the routing table.
   *  Multi-datacenter deployments is one of its use cases
   * @param {string} param.databaseName The database name
   * @param {Bookmarks} params.sessionContext.bookmarks The bookmarks used for requesting the routing table
   * @param {string} params.sessionContext.mode The session mode
   * @param {string} params.sessionContext.database The database name used on the session
   * @param {function()} params.sessionContext.afterComplete The session param used after the session closed
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
    const resultObserver = this.run(
      CALL_GET_ROUTING_TABLE_MULTI_DB,
      {
        [CONTEXT]: routingContext,
        [DATABASE]: databaseName
      },
      { ...sessionContext, txConfig: TxConfig.empty() }
    )

    return new ProcedureRouteObserver({
      resultObserver,
      onProtocolError: this._onProtocolError,
      onError,
      onCompleted
    })
  }
}

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
import BoltProtocolV43 from './bolt-protocol-v4x3'

import { internal } from 'neo4j-driver-core'
import RequestMessage from './request-message'
import { RouteObserver, ResultStreamObserver } from './stream-observers'

const {
  constants: { BOLT_PROTOCOL_V4_4, FETCH_ALL },
  bookmark: { Bookmark },
} = internal

export default class BoltProtocol extends BoltProtocolV43 {
  get version() {
    return BOLT_PROTOCOL_V4_4
  }

  /**
  * Request routing information
  *
  * @param {Object} param -
  * @param {object} param.routingContext The routing context used to define the routing table.
  *  Multi-datacenter deployments is one of its use cases
  * @param {string} param.databaseName The database name
  * @param {Bookmark} params.sessionContext.bookmark The bookmark used for request the routing table
  * @param {function(err: Error)} param.onError
  * @param {function(RawRoutingTable)} param.onCompleted
  * @returns {RouteObserver} the route observer
  */
  requestRoutingInformation ({
    routingContext = {},
    databaseName = null,
    impersonatedUser = null,
    sessionContext = {},
    onError,
    onCompleted
  }) {
    const observer = new RouteObserver({
      onProtocolError: this._onProtocolError,
      onError,
      onCompleted
    })
    const bookmark = sessionContext.bookmark || Bookmark.empty()
    this.write(
      RequestMessage.routeV4x4(routingContext, bookmark.values(), { databaseName, impersonatedUser }),
      observer,
      true
    )

    return observer
  }

  run (
    query,
    parameters,
    {
      bookmark,
      txConfig,
      database,
      mode,
      impersonatedUser,
      beforeKeys,
      afterKeys,
      beforeError,
      afterError,
      beforeComplete,
      afterComplete,
      flush = true,
      reactive = false,
      fetchSize = FETCH_ALL
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
      afterComplete
    })

    const flushRun = reactive
    this.write(
      RequestMessage.runWithMetadata(query, parameters, {
        bookmark,
        txConfig,
        database,
        mode,
        impersonatedUser
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
    bookmark,
    txConfig,
    database,
    mode,
    impersonatedUser,
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
      RequestMessage.begin({ bookmark, txConfig, database, mode, impersonatedUser }),
      observer,
      true
    )

    return observer
  }

}

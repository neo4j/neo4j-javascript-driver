/**
 * Copyright (c) 2002-2020 "Neo4j,"
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
import BoltProtocolV3 from './bolt-protocol-v3'
import RequestMessage, { ALL } from './request-message'
import { ResultStreamObserver } from './stream-observers'
import { BOLT_PROTOCOL_V4_0 } from './constants'

export default class BoltProtocol extends BoltProtocolV3 {
  get version () {
    return BOLT_PROTOCOL_V4_0
  }

  beginTransaction ({
    bookmark,
    txConfig,
    database,
    mode,
    beforeError,
    afterError,
    beforeComplete,
    afterComplete
  } = {}) {
    const observer = new ResultStreamObserver({
      connection: this._connection,
      beforeError,
      afterError,
      beforeComplete,
      afterComplete
    })
    observer.prepareToHandleSingleResponse()

    this._connection.write(
      RequestMessage.begin({ bookmark, txConfig, database, mode }),
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
      beforeKeys,
      afterKeys,
      beforeError,
      afterError,
      beforeComplete,
      afterComplete,
      flush = true,
      reactive = false,
      fetchSize = ALL
    } = {}
  ) {
    const observer = new ResultStreamObserver({
      connection: this._connection,
      reactive: reactive,
      fetchSize: fetchSize,
      moreFunction: this._requestMore,
      discardFunction: this._requestDiscard,
      beforeKeys,
      afterKeys,
      beforeError,
      afterError,
      beforeComplete,
      afterComplete
    })

    const flushRun = reactive
    this._connection.write(
      RequestMessage.runWithMetadata(query, parameters, {
        bookmark,
        txConfig,
        database,
        mode
      }),
      observer,
      flushRun && flush
    )

    if (!reactive) {
      this._connection.write(
        RequestMessage.pull({ n: fetchSize }),
        observer,
        flush
      )
    }

    return observer
  }

  _requestMore (connection, stmtId, n, observer) {
    connection.write(RequestMessage.pull({ stmtId, n }), observer, true)
  }

  _requestDiscard (connection, stmtId, observer) {
    connection.write(RequestMessage.discard({ stmtId }), observer, true)
  }

  _noOp () {}
}

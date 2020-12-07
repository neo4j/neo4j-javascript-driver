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
import BoltProtocolV3, { RecordRawRoutingTable } from './bolt-protocol-v3'
import RequestMessage, { ALL } from './request-message'
import { ResultStreamObserver, RouteObserver } from './stream-observers'
import { BOLT_PROTOCOL_V4_0 } from './constants'
import Bookmark from './bookmark'
import TxConfig from './tx-config'
import Result from '../result'
import { newError, PROTOCOL_ERROR } from '../../lib/error'

const CONTEXT = 'context'
const DATABASE = 'database'
const CALL_GET_ROUTING_TABLE_MULTI_DB = `CALL dbms.routing.getRoutingTable($${CONTEXT}, $${DATABASE})`

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

  /**
   * Request routing information
   *
   * @param {Object} param -
   * @param {object} param.routingContext The routing context used to define the routing table.
   *  Multi-datacenter deployments is one of its use cases
   * @param {string} param.databaseName The database name
   * @param {Bookmark} params.sessionContext.bookmark The bookmark used for request the routing table
   * @param {string} params.sessionContext.mode The session mode
   * @param {string} params.sessionContext.database The database name used on the session
   * @param {function()} params.sessionContext.afterComplete The session param used after the session closed
   * @param {function(err: Error)} param.onError
   * @param {function(metadata)} param.onComplete
   * @returns {RouteObserver} the route observer
   */
  requestRoutingInformation ({
    routingContext = {},
    databaseName = null,
    sessionContext = {},
    initialAddress = null,
    onError,
    onComplete
  }) {
    const observer = new RouteObserver({
      connection: this._connection,
      onError,
      onComplete
    })

    const resultObserserver = this.run(
      CALL_GET_ROUTING_TABLE_MULTI_DB,
      {
        [CONTEXT]: { ...routingContext, address: initialAddress },
        [DATABASE]: databaseName
      },
      { ...sessionContext, txConfig: TxConfig.empty() }
    )

    new Result(Promise.resolve(resultObserserver))
      .then(result => {
        const records = result.records
        if (records !== null && records.length !== 1) {
          throw newError(
            'Illegal response from router "' +
              'routerAddress' +
              '". ' +
              'Received ' +
              records.length +
              ' records but expected only one.\n' +
              JSON.stringify(records),
            PROTOCOL_ERROR
          )
        }
        if (onComplete) {
          onComplete(
            new RecordRawRoutingTable(records !== null ? records[0] : null)
          )
        }
      })
      .catch(observer.onError.bind(observer))

    return observer
  }
}

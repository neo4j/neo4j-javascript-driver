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
import BoltProtocolV2 from './bolt-protocol-v2'
import RequestMessage from './request-message'
import { assertDatabaseIsEmpty } from './bolt-protocol-util'
import {
  StreamObserver,
  LoginObserver,
  ResultStreamObserver,
  RouteObserver
} from './stream-observers'
import { BOLT_PROTOCOL_V3 } from './constants'
import Bookmark from './bookmark'
import TxConfig from './tx-config'
import Result from '../result'
import { newError, PROTOCOL_ERROR } from '../../lib/error'
const CONTEXT = 'context'
const CALL_GET_ROUTING_TABLE = `CALL dbms.cluster.routing.getRoutingTable($${CONTEXT})`

const noOpObserver = new StreamObserver()

export default class BoltProtocol extends BoltProtocolV2 {
  get version () {
    return BOLT_PROTOCOL_V3
  }

  transformMetadata (metadata) {
    if ('t_first' in metadata) {
      // Bolt V3 uses shorter key 't_first' to represent 'result_available_after'
      // adjust the key to be the same as in Bolt V1 so that ResultSummary can retrieve the value
      metadata.result_available_after = metadata.t_first
      delete metadata.t_first
    }
    if ('t_last' in metadata) {
      // Bolt V3 uses shorter key 't_last' to represent 'result_consumed_after'
      // adjust the key to be the same as in Bolt V1 so that ResultSummary can retrieve the value
      metadata.result_consumed_after = metadata.t_last
      delete metadata.t_last
    }
    return metadata
  }

  initialize ({ userAgent, authToken, onError, onComplete } = {}) {
    const observer = new LoginObserver({
      connection: this._connection,
      afterError: onError,
      afterComplete: onComplete
    })

    this._connection.write(
      RequestMessage.hello(userAgent, authToken),
      observer,
      true
    )

    return observer
  }

  prepareToClose () {
    this._connection.write(RequestMessage.goodbye(), noOpObserver, true)
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

    // passing in a database name on this protocol version throws an error
    assertDatabaseIsEmpty(database, this._connection, observer)

    this._connection.write(
      RequestMessage.begin({ bookmark, txConfig, mode }),
      observer,
      true
    )

    return observer
  }

  commitTransaction ({
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

    this._connection.write(RequestMessage.commit(), observer, true)

    return observer
  }

  rollbackTransaction ({
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

    this._connection.write(RequestMessage.rollback(), observer, true)

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
      flush = true
    } = {}
  ) {
    const observer = new ResultStreamObserver({
      connection: this._connection,
      beforeKeys,
      afterKeys,
      beforeError,
      afterError,
      beforeComplete,
      afterComplete
    })

    // passing in a database name on this protocol version throws an error
    assertDatabaseIsEmpty(database, this._connection, observer)

    this._connection.write(
      RequestMessage.runWithMetadata(query, parameters, {
        bookmark,
        txConfig,
        mode
      }),
      observer,
      false
    )
    this._connection.write(RequestMessage.pullAll(), observer, flush)

    return observer
  }

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
    sessionContext = {},
    onError,
    onComplete
  }) {
    const observer = new RouteObserver({
      connection: this._connection,
      onError,
      onComplete
    })

    const resultObserserver = this.run(
      CALL_GET_ROUTING_TABLE,
      { [CONTEXT]: routingContext },
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

/**
 * Get the raw routing table information from the record
 */
export class RecordRawRoutingTable {
  constructor (record) {
    this._record = record
  }

  get ttl () {
    return this._record.get('ttl')
  }

  get servers () {
    return this._record.get('servers')
  }

  get isNull () {
    return this._record === null
  }
}

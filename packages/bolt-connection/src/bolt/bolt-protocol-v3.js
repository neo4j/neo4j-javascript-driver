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
import BoltProtocolV2 from './bolt-protocol-v2'
import RequestMessage from './request-message'
import { assertDatabaseIsEmpty, assertImpersonatedUserIsEmpty } from './bolt-protocol-util'
import {
  StreamObserver,
  LoginObserver,
  ResultStreamObserver,
  ProcedureRouteObserver
} from './stream-observers'
import { internal } from 'neo4j-driver-core'

const {
  bookmark: { Bookmark },
  constants: { BOLT_PROTOCOL_V3 },
  txConfig: { TxConfig }
} = internal

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
      onError: error => this._onLoginError(error, onError),
      onCompleted: metadata => this._onLoginCompleted(metadata, onComplete)
    })

    this.write(RequestMessage.hello(userAgent, authToken), observer, true)

    return observer
  }

  prepareToClose () {
    this.write(RequestMessage.goodbye(), noOpObserver, true)
  }

  beginTransaction ({
    bookmark,
    txConfig,
    database,
    impersonatedUser,
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

    // passing in a database name on this protocol version throws an error
    assertDatabaseIsEmpty(database, this._onProtocolError, observer)
    // passing impersonated user on this protocol version throws an error
    assertImpersonatedUserIsEmpty(impersonatedUser, this._onProtocolError, observer)

    this.write(
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
      server: this._server,
      beforeError,
      afterError,
      beforeComplete,
      afterComplete
    })
    observer.prepareToHandleSingleResponse()

    this.write(RequestMessage.commit(), observer, true)

    return observer
  }

  rollbackTransaction ({
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

    this.write(RequestMessage.rollback(), observer, true)

    return observer
  }

  run (
    query,
    parameters,
    {
      bookmark,
      txConfig,
      database,
      impersonatedUser,
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
      server: this._server,
      beforeKeys,
      afterKeys,
      beforeError,
      afterError,
      beforeComplete,
      afterComplete
    })

    // passing in a database name on this protocol version throws an error
    assertDatabaseIsEmpty(database, this._onProtocolError, observer)
    // passing impersonated user on this protocol version throws an error
    assertImpersonatedUserIsEmpty(impersonatedUser, this._onProtocolError, observer)

    this.write(
      RequestMessage.runWithMetadata(query, parameters, {
        bookmark,
        txConfig,
        mode
      }),
      observer,
      false
    )
    this.write(RequestMessage.pullAll(), observer, flush)

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
   * @param {function(RawRoutingTable)} param.onCompleted
   * @returns {RouteObserver} the route observer
   */
  requestRoutingInformation ({
    routingContext = {},
    sessionContext = {},
    onError,
    onCompleted
  }) {
    const resultObserver = this.run(
      CALL_GET_ROUTING_TABLE,
      { [CONTEXT]: routingContext },
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

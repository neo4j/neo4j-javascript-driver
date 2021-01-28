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
import BoltProtocolV42 from './bolt-protocol-v4x2'
import { BOLT_PROTOCOL_V4_3 } from '../constants'
import RequestMessage from './request-message'
import { RouteObserver } from './stream-observers'

export default class BoltProtocol extends BoltProtocolV42 {
  get version () {
    return BOLT_PROTOCOL_V4_3
  }

  /**
   * Request routing information
   *
   * @param {Object} param -
   * @param {object} param.routingContext The routing context used to define the routing table.
   *  Multi-datacenter deployments is one of its use cases
   * @param {string} param.databaseName The database name
   * @param {function(err: Error)} param.onError
   * @param {function(RawRoutingTable)} param.onCompleted
   * @returns {RouteObserver} the route observer
   */
  requestRoutingInformation ({
    routingContext = {},
    databaseName = null,
    initialAddress = null,
    onError,
    onCompleted
  }) {
    const observer = new RouteObserver({
      onProtocolError: this._onProtocolError,
      onError,
      onCompleted
    })

    this.write(
      RequestMessage.route(
        { ...routingContext, address: initialAddress },
        databaseName
      ),
      observer,
      true
    )

    return observer
  }
}

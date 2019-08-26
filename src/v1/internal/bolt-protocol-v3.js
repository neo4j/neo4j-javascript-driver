/**
 * Copyright (c) 2002-2019 "Neo4j,"
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

export default class BoltProtocol extends BoltProtocolV2 {
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

  initialize (userAgent, authToken, observer) {
    prepareToHandleSingleResponse(observer)
    const message = RequestMessage.hello(userAgent, authToken)
    this._connection.write(message, observer, true)
  }

  prepareToClose (observer) {
    const message = RequestMessage.goodbye()
    this._connection.write(message, observer, true)
  }

  beginTransaction (bookmark, txConfig, mode, observer) {
    prepareToHandleSingleResponse(observer)
    const message = RequestMessage.begin(bookmark, txConfig, mode)
    this._connection.write(message, observer, true)
  }

  commitTransaction (observer) {
    prepareToHandleSingleResponse(observer)
    const message = RequestMessage.commit()
    this._connection.write(message, observer, true)
  }

  rollbackTransaction (observer) {
    prepareToHandleSingleResponse(observer)
    const message = RequestMessage.rollback()
    this._connection.write(message, observer, true)
  }

  run (statement, parameters, bookmark, txConfig, mode, observer) {
    const runMessage = RequestMessage.runWithMetadata(
      statement,
      parameters,
      bookmark,
      txConfig,
      mode
    )
    const pullAllMessage = RequestMessage.pullAll()

    this._connection.write(runMessage, observer, false)
    this._connection.write(pullAllMessage, observer, true)
  }
}

function prepareToHandleSingleResponse (observer) {
  if (
    observer &&
    typeof observer.prepareToHandleSingleResponse === 'function'
  ) {
    observer.prepareToHandleSingleResponse()
  }
}

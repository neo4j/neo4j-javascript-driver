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
import { assertDatabaseIsEmpty } from './bolt-protocol-util'
import {
  StreamObserver,
  LoginObserver,
  ResultStreamObserver
} from './stream-observers'

const noOpObserver = new StreamObserver()

export default class BoltProtocol extends BoltProtocolV2 {
  transformMetadata (metadata) {
    if (metadata.t_first) {
      // Bolt V3 uses shorter key 't_first' to represent 'result_available_after'
      // adjust the key to be the same as in Bolt V1 so that ResultSummary can retrieve the value
      metadata.result_available_after = metadata.t_first
      delete metadata.t_first
    }
    if (metadata.t_last) {
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
    statement,
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
      RequestMessage.runWithMetadata(statement, parameters, {
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
}

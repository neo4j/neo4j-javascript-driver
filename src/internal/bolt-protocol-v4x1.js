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
import BoltProtocolV4 from './bolt-protocol-v4x0'
import RequestMessage, { ALL } from './request-message'
import { BOLT_PROTOCOL_V4_1 } from './constants'
import { LoginObserver } from './stream-observers'

export default class BoltProtocol extends BoltProtocolV4 {
  /**
   * @constructor
   * @param {Connection} connection the connection.
   * @param {Chunker} chunker the chunker.
   * @param {boolean} disableLosslessIntegers if this connection should convert all received integers to native JS numbers.
   * @param {Object} serversideRouting
   */
  constructor (connection, chunker, disableLosslessIntegers, serversideRouting) {
    super(connection, chunker, disableLosslessIntegers)
    this._serversideRouting = serversideRouting
  }

  get version () {
    return BOLT_PROTOCOL_V4_1
  }

  initialize ({ userAgent, authToken, onError, onComplete } = {}) {
    const observer = new LoginObserver({
      connection: this._connection,
      afterError: onError,
      afterComplete: onComplete
    })

    this._connection.write(
      RequestMessage.hello(userAgent, authToken, this._serversideRouting),
      observer,
      true
    )

    return observer
  }
}

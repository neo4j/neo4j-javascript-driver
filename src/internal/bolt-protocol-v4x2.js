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
import BoltProtocolV41 from './bolt-protocol-v4x1'
import { BOLT_PROTOCOL_V4_2 } from './constants'

export default class BoltProtocol extends BoltProtocolV41 {
  /**
   * @constructor
   * @param {Connection} connection the connection.
   * @param {Chunker} chunker the chunker.
   * @param {boolean} disableLosslessIntegers if this connection should convert all received integers to native JS numbers.
   * @param {Object} serversideRouting
   */
  constructor (connection, chunker, disableLosslessIntegers, serversideRouting) {
    super(connection, chunker, disableLosslessIntegers, serversideRouting)
  }

  get version () {
    return BOLT_PROTOCOL_V4_2
  }
}

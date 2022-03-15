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
import BoltProtocolV44 from './bolt-protocol-v4x4'
import { v5 } from '../packstream'

import { internal } from 'neo4j-driver-core'

const {
  constants: { BOLT_PROTOCOL_V5_0 },
} = internal

export default class BoltProtocol extends BoltProtocolV44 {
  get version() {
    return BOLT_PROTOCOL_V5_0
  }

  _createPacker (chunker) {
    return new v5.Packer(chunker)
  }

  _createUnpacker (disableLosslessIntegers, useBigInt) {
    return new v5.Unpacker(disableLosslessIntegers, useBigInt)
  }
}

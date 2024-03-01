/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [https://neo4j.com]
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
import BoltProtocolV1 from './bolt-protocol-v1'
import v2 from '../packstream'
import { internal } from 'neo4j-driver-core'
import transformersFactories from './bolt-protocol-v2.transformer'
import Transformer from './transformer'

const {
  constants: { BOLT_PROTOCOL_V2 }
} = internal

export default class BoltProtocol extends BoltProtocolV1 {
  _createPacker (chunker) {
    return new v2.Packer(chunker)
  }

  _createUnpacker (disableLosslessIntegers, useBigInt) {
    return new v2.Unpacker(disableLosslessIntegers, useBigInt)
  }

  get transformer () {
    if (this._transformer === undefined) {
      this._transformer = new Transformer(Object.values(transformersFactories).map(create => create(this._config, this._log)), this._hydrationHooks, this._dehydrationHooks)
    }
    return this._transformer
  }

  get version () {
    return BOLT_PROTOCOL_V2
  }
}

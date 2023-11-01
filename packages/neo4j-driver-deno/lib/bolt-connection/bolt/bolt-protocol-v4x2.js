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
import BoltProtocolV41 from './bolt-protocol-v4x1.js'

import { internal } from '../../core/index.ts'

import transformersFactories from './bolt-protocol-v4x2.transformer.js'
import Transformer from './transformer.js'

const {
  constants: { BOLT_PROTOCOL_V4_2 }
} = internal

export default class BoltProtocol extends BoltProtocolV41 {
  get version () {
    return BOLT_PROTOCOL_V4_2
  }

  get transformer () {
    if (this._transformer === undefined) {
      this._transformer = new Transformer(Object.values(transformersFactories).map(create => create(this._config, this._log)), this._hydrationHooks, this._dehydrationHooks)
    }
    return this._transformer
  }
}

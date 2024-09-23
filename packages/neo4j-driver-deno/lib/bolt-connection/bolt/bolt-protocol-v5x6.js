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
import BoltProtocolV5x5 from './bolt-protocol-v5x5.js'

import transformersFactories from './bolt-protocol-v5x5.transformer.js'
import Transformer from './transformer.js'

import { internal } from '../../core/index.ts'

const {
  constants: { BOLT_PROTOCOL_V5_6 }
} = internal

const DEFAULT_DIAGNOSTIC_RECORD = Object.freeze({
  OPERATION: '',
  OPERATION_CODE: '0',
  CURRENT_SCHEMA: '/'
})

export default class BoltProtocolV5x6 extends BoltProtocolV5x5 {
  get version () {
    return BOLT_PROTOCOL_V5_6
  }

  get transformer () {
    if (this._transformer === undefined) {
      this._transformer = new Transformer(Object.values(transformersFactories).map(create => create(this._config, this._log)))
    }
    return this._transformer
  }

  /**
   *
   * @param {object} metadata
   * @returns {object}
   */
  _enrichMetadata (metadata) {
    if (Array.isArray(metadata.statuses)) {
      metadata.statuses = metadata.statuses.map(status => ({
        ...status,
        diagnostic_record: status.diagnostic_record !== null ? { ...DEFAULT_DIAGNOSTIC_RECORD, ...status.diagnostic_record } : null
      }))
    }

    return metadata
  }
}

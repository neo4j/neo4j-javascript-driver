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
import BoltProtocolV5x6 from './bolt-protocol-v5x6'

import transformersFactories from './bolt-protocol-v5x5.transformer'
import Transformer from './transformer'

import { internal } from 'neo4j-driver-core'

const {
  constants: { BOLT_PROTOCOL_V5_7 }
} = internal

const DEFAULT_DIAGNOSTIC_RECORD = Object.freeze({
  OPERATION: '',
  OPERATION_CODE: '0',
  CURRENT_SCHEMA: '/'
})

export default class BoltProtocol extends BoltProtocolV5x6 {
  get version () {
    return BOLT_PROTOCOL_V5_7
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
  enrichErrorMetadata (metadata) {
    return {
      ...metadata,
      cause: (metadata.cause !== null && metadata.cause !== undefined) ? this.enrichErrorMetadata(metadata.cause) : null,
      code: metadata.neo4j_code,
      diagnostic_record: metadata.diagnostic_record !== null ? { ...DEFAULT_DIAGNOSTIC_RECORD, ...metadata.diagnostic_record } : null
    }
  }
}

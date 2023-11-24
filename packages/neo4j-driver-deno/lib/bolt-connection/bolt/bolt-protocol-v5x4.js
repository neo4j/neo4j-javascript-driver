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
import BoltProtocolV5x3 from './bolt-protocol-v5x3.js'

import transformersFactories from './bolt-protocol-v5x4.transformer.js'
import RequestMessage from './request-message.js'
import { TelemetryObserver } from './stream-observers.js'
import Transformer from './transformer.js'

import { internal } from '../../core/index.ts'

const {
  constants: { BOLT_PROTOCOL_V5_4 }
} = internal

export default class BoltProtocol extends BoltProtocolV5x3 {
  get version () {
    return BOLT_PROTOCOL_V5_4
  }

  get transformer () {
    if (this._transformer === undefined) {
      this._transformer = new Transformer(Object.values(transformersFactories).map(create => create(this._config, this._log)))
    }
    return this._transformer
  }

  /**
   * Send a TELEMETRY through the underlying connection.
   *
   * @param {object} param0 Message params
   * @param {number} param0.api The API called
   * @param {object} param1 Configuration and callbacks callbacks
   * @param {function()} param1.onCompleted Called when completed
   * @param {function()} param1.onError Called when error
   * @return {StreamObserver} the stream observer that monitors the corresponding server response.
   */
  telemetry ({ api }, { onError, onCompleted } = {}) {
    const observer = new TelemetryObserver({ onCompleted, onError })

    this.write(RequestMessage.telemetry({ api }), observer, false)

    return observer
  }
}

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
export default class LivenessCheckProvider {
  constructor ({ connectionLivenessCheckTimeout }) {
    this._connectionLivenessCheckTimeout = connectionLivenessCheckTimeout
  }

  /**
     * Checks connection liveness with configured params.
     *
     * @param {Connection} connection
     * @returns {Promise<true>} If liveness checks succeed, throws otherwise
     */
  async check (connection) {
    if (this._connectionLivenessCheckTimeout == null ||
            this._connectionLivenessCheckTimeout < 0 ||
            connection.authToken == null) {
      return true
    }

    if (this._connectionLivenessCheckTimeout === 0) {
      return await connection.resetAndFlush()
        .then(() => true)
    }
  }
}

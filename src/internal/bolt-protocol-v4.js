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
import BoltProtocolV3 from './bolt-protocol-v3'
import RequestMessage from './request-message'

export default class BoltProtocol extends BoltProtocolV3 {
  beginTransaction (observer, { bookmark, txConfig, database, mode }) {
    const message = RequestMessage.begin({ bookmark, txConfig, database, mode })
    this._connection.write(message, observer, true)
  }

  run (statement, parameters, observer, { bookmark, txConfig, database, mode }) {
    const runMessage = RequestMessage.runWithMetadata(statement, parameters, {
      bookmark,
      txConfig,
      database,
      mode
    })
    const pullMessage = RequestMessage.pull()

    this._connection.write(runMessage, observer, false)
    this._connection.write(pullMessage, observer, true)
  }
}

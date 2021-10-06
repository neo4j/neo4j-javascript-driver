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

import { ServerInfo } from '../src/result-summary'

describe('ServerInfo', () => {
  it.each([
    [
      { address: '192.168.0.1', version: 'neo4j' },
      4.3,
      {
        address: '192.168.0.1',
        version: 'neo4j',
        protocolVersion: 4.3,
        agent: 'neo4j'
      }
    ],
    [
      { address: '192.168.0.1', version: 'neo4j' },
      undefined,
      {
        address: '192.168.0.1',
        version: 'neo4j',
        protocolVersion: undefined,
        agent: 'neo4j'
      }
    ],
    [undefined, 4.3, { protocolVersion: 4.3 }],
    [undefined, undefined, {}]
  ])(
    'new ServerInfo(%o, %i) === %j',
    (meta, protocolVersion, expectedServerInfo) => {
      expect(new ServerInfo(meta, protocolVersion)).toEqual(expectedServerInfo)
    }
  )
})

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

import { ProtocolVersion } from '../protocol-version.ts'

const FETCH_ALL = -1
const DEFAULT_POOL_ACQUISITION_TIMEOUT = 60 * 1000 // 60 seconds
const DEFAULT_POOL_MAX_SIZE = 100
const DEFAULT_CONNECTION_TIMEOUT_MILLIS = 30000 // 30 seconds by default

const ACCESS_MODE_READ: 'READ' = 'READ'
const ACCESS_MODE_WRITE: 'WRITE' = 'WRITE'

const BOLT_PROTOCOL_V1: ProtocolVersion = new ProtocolVersion(1, 0)
const BOLT_PROTOCOL_V2: ProtocolVersion = new ProtocolVersion(2, 0)
const BOLT_PROTOCOL_V3: ProtocolVersion = new ProtocolVersion(3, 0)
const BOLT_PROTOCOL_V4_0: ProtocolVersion = new ProtocolVersion(4, 0)
const BOLT_PROTOCOL_V4_1: ProtocolVersion = new ProtocolVersion(4, 1)
const BOLT_PROTOCOL_V4_2: ProtocolVersion = new ProtocolVersion(4, 2)
const BOLT_PROTOCOL_V4_3: ProtocolVersion = new ProtocolVersion(4, 3)
const BOLT_PROTOCOL_V4_4: ProtocolVersion = new ProtocolVersion(4, 4)
const BOLT_PROTOCOL_V5_0: ProtocolVersion = new ProtocolVersion(5, 0)
const BOLT_PROTOCOL_V5_1: ProtocolVersion = new ProtocolVersion(5, 1)
const BOLT_PROTOCOL_V5_2: ProtocolVersion = new ProtocolVersion(5, 2)
const BOLT_PROTOCOL_V5_3: ProtocolVersion = new ProtocolVersion(5, 3)
const BOLT_PROTOCOL_V5_4: ProtocolVersion = new ProtocolVersion(5, 4)
const BOLT_PROTOCOL_V5_5: ProtocolVersion = new ProtocolVersion(5, 5)
const BOLT_PROTOCOL_V5_6: ProtocolVersion = new ProtocolVersion(5, 6)
const BOLT_PROTOCOL_V5_7: ProtocolVersion = new ProtocolVersion(5, 7)
const BOLT_PROTOCOL_V5_8: ProtocolVersion = new ProtocolVersion(5, 8)
const BOLT_PROTOCOL_V6_0: ProtocolVersion = new ProtocolVersion(6, 0)
const BOLT_PROTOCOL_V6_1: ProtocolVersion = new ProtocolVersion(6, 1)

const TELEMETRY_APIS = {
  MANAGED_TRANSACTION: 0,
  UNMANAGED_TRANSACTION: 1,
  AUTO_COMMIT_TRANSACTION: 2,
  EXECUTE_QUERY: 3
} as const

export type TelemetryApis = typeof TELEMETRY_APIS[keyof typeof TELEMETRY_APIS]

export type AccessMode = typeof ACCESS_MODE_READ | typeof ACCESS_MODE_WRITE

export {
  FETCH_ALL,
  ACCESS_MODE_READ,
  ACCESS_MODE_WRITE,
  DEFAULT_CONNECTION_TIMEOUT_MILLIS,
  DEFAULT_POOL_ACQUISITION_TIMEOUT,
  DEFAULT_POOL_MAX_SIZE,
  BOLT_PROTOCOL_V1,
  BOLT_PROTOCOL_V2,
  BOLT_PROTOCOL_V3,
  BOLT_PROTOCOL_V4_0,
  BOLT_PROTOCOL_V4_1,
  BOLT_PROTOCOL_V4_2,
  BOLT_PROTOCOL_V4_3,
  BOLT_PROTOCOL_V4_4,
  BOLT_PROTOCOL_V5_0,
  BOLT_PROTOCOL_V5_1,
  BOLT_PROTOCOL_V5_2,
  BOLT_PROTOCOL_V5_3,
  BOLT_PROTOCOL_V5_4,
  BOLT_PROTOCOL_V5_5,
  BOLT_PROTOCOL_V5_6,
  BOLT_PROTOCOL_V5_7,
  BOLT_PROTOCOL_V5_8,
  BOLT_PROTOCOL_V6_0,
  BOLT_PROTOCOL_V6_1,
  TELEMETRY_APIS
}

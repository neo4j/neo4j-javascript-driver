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

const FETCH_ALL = -1
const DEFAULT_POOL_ACQUISITION_TIMEOUT = 60 * 1000 // 60 seconds
const DEFAULT_POOL_MAX_SIZE = 100

const ACCESS_MODE_READ: 'READ' = 'READ'
const ACCESS_MODE_WRITE: 'WRITE' = 'WRITE'

const BOLT_PROTOCOL_V1: number = 1
const BOLT_PROTOCOL_V2: number = 2
const BOLT_PROTOCOL_V3: number = 3
const BOLT_PROTOCOL_V4_0: number = 4.0
const BOLT_PROTOCOL_V4_1: number = 4.1
const BOLT_PROTOCOL_V4_2: number = 4.2
const BOLT_PROTOCOL_V4_3: number = 4.3
const BOLT_PROTOCOL_V4_4: number = 4.4

export {
  FETCH_ALL,
  ACCESS_MODE_READ,
  ACCESS_MODE_WRITE,
  DEFAULT_POOL_ACQUISITION_TIMEOUT,
  DEFAULT_POOL_MAX_SIZE,
  BOLT_PROTOCOL_V1,
  BOLT_PROTOCOL_V2,
  BOLT_PROTOCOL_V3,
  BOLT_PROTOCOL_V4_0,
  BOLT_PROTOCOL_V4_1,
  BOLT_PROTOCOL_V4_2,
  BOLT_PROTOCOL_V4_3,
  BOLT_PROTOCOL_V4_4
}

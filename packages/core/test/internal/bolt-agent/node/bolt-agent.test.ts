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
import { boltAgent as BoltAgent } from '../../../../src/internal'
import os from 'os'

describe('#unit boltAgent', () => {
  // This test is very fragile but the exact look of this string should not change without PM approval
  it('should return the correct bolt agent for specified version', () => {
    const version = '5.3'
    const boltAgent = BoltAgent.fromVersion(version)

    const HOST_ARCH = process.config.variables.host_arch
    const NODE_VERSION = 'Node/' + process.versions.node
    const NODE_V8_VERSION = process.versions.v8

    const osName = BoltAgent.mapOs(os.platform())

    expect(boltAgent.length === 0).toBeFalsy()
    expect(boltAgent).toContain(`neo4j-javascript/${version}`)
    expect(boltAgent).toContain(`${HOST_ARCH}`)
    expect(boltAgent).toContain(`${NODE_VERSION}`)
    expect(boltAgent).toContain(`${NODE_V8_VERSION}`)
    expect(boltAgent).toContain(`${osName}`)

    expect(boltAgent).toEqual(`neo4j-javascript/${version} (${osName} ${os.release()}; ${HOST_ARCH}) ${NODE_VERSION} (v8 ${NODE_V8_VERSION})`)
  })
})

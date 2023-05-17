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
import { SystemInfo } from '../../../../src/internal/bolt-agent'
import { platform, release } from 'os'

describe('#unit boltAgent', () => {
  // This test is very fragile but the exact look of this struct should not change without PM approval
  it('should return the correct bolt agent for specified version', () => {
    const version = '5.3'
    const HOST_ARCH = process.config.variables.host_arch
    const NODE_VERSION = 'Node/' + process.versions.node
    const NODE_V8_VERSION = process.versions.v8

    const boltAgent = BoltAgent.fromVersion(version)

    expect(boltAgent).toEqual({
      product: `neo4j-javascript/${version}`,
      platform: `${platform()} ${release()}; ${HOST_ARCH}`,
      languageDetails: `${NODE_VERSION} (v8 ${NODE_V8_VERSION})`
    })
  })

  it('should return the correct bolt agent for mocked values', () => {
    const version = '5.6'
    const systemInfo: SystemInfo = {
      hostArch: 'Some arch',
      nodeVersion: '16.0.1',
      v8Version: '1.7.0',
      platform: 'netbsd',
      release: '1.1.1'
    }

    const boltAgent = BoltAgent.fromVersion(version, () => systemInfo)

    expect(boltAgent).toEqual({
      product: 'neo4j-javascript/5.6',
      platform: 'netbsd 1.1.1; Some arch',
      languageDetails: 'Node/16.0.1 (v8 1.7.0)'
    })
  })
})

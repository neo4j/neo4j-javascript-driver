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
import { platform, release } from 'os'
import { BoltAgent } from '../../../types'

interface SystemInfo {
  hostArch: string
  nodeVersion: string
  v8Version: string
  platform: string
  release: string
}

/**
 * Constructs a BoltAgent structure from a given product version.
 *
 * @param {string} version The product version
 * @param {function():SystemInfo} getSystemInfo Parameter used of inject system information and mock calls to the APIs.
 * @returns {BoltAgent} The bolt agent
 */
export function fromVersion (
  version: string,
  getSystemInfo: () => SystemInfo = () => ({
    hostArch: process.config.variables.host_arch,
    nodeVersion: process.versions.node,
    v8Version: process.versions.v8,
    get platform () {
      return platform()
    },
    get release () {
      return release()
    }
  })
): BoltAgent {
  const systemInfo = getSystemInfo()
  const HOST_ARCH = systemInfo.hostArch
  const NODE_VERSION = 'Node/' + systemInfo.nodeVersion
  const NODE_V8_VERSION = systemInfo.v8Version
  const OS_NAME_VERSION = `${systemInfo.platform} ${systemInfo.release}`

  return {
    product: `neo4j-javascript/${version}`,
    platform: `${OS_NAME_VERSION}; ${HOST_ARCH}`,
    languageDetails: `${NODE_VERSION} (v8 ${NODE_V8_VERSION})`
  }
}

export type { SystemInfo }

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

import { BoltAgent } from '../../../types.ts'

export interface SystemInfo {
  hostArch: string
  denoVersion: string
  v8Version: string
  osVersion: string
  osRelease: string
}

/**
 * Constructs a BoltAgent structure from a given product version.
 *
 * @param {string} version The product version
 * @param {function():SystemInfo} getSystemInfo Parameter used of inject system information and mock calls to the APIs.
 * @returns {BoltAgent} The bolt agent
 */
/* eslint-disable */
export function fromVersion (
  version: string, 
  getSystemInfo: () => SystemInfo = () => ({
    //@ts-ignore
    hostArch: Deno.build.arch,
    //@ts-ignore
    denoVersion: Deno.version.deno,
    //@ts-ignore:
    v8Version: Deno.version.v8,
    //@ts-ignore
    osVersion: Deno.build.os,
    get osRelease() {
      //@ts-ignore
      return Deno.osRelease ? Deno.osRelease() : ''
    }
  })
): BoltAgent {
  const systemInfo = getSystemInfo()
  const DENO_VERSION = `Deno/${systemInfo.denoVersion}`
  const OS_NAME_VERSION = `${systemInfo.osVersion} ${systemInfo.osRelease}`.trim()

  console.warn("WARNING! neo4j-driver-deno stills in preview.")

  return  {
    product: `neo4j-javascript/${version}`,
    platform: `${OS_NAME_VERSION}; ${systemInfo.hostArch}`,
    languageDetails: `${DENO_VERSION} (v8 ${systemInfo.v8Version})`
  }
}
/* eslint-enable */

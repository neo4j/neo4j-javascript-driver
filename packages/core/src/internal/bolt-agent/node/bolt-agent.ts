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
import * as os from 'os'

export function fromVersion (version: string): string {
  const HOST_ARCH = process.config.variables.host_arch
  const NODE_VERSION = 'Node/' + process.versions.node
  const NODE_V8_VERSION = process.versions.v8

  const osName = mapOs(os.platform())

  return `neo4j-javascript/${version} (${osName} ${os.release()}; ${HOST_ARCH}) ${NODE_VERSION} (v8 ${NODE_V8_VERSION})`
}

export function mapOs (osType: string): string {
  let osName
  if (osType === 'darwin') {
    osName = 'MacOS'
  } else if (osType === 'win32') {
    osName = 'Windows'
  } else if (osType === 'linux') {
    osName = 'Linux'
  } else {
    osName = osType
  }

  return osName
}

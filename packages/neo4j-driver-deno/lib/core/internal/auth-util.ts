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

import { AuthToken } from '../types.ts'

export function cacheKey (auth?: AuthToken, impersonatedUser?: string): string {
  if (impersonatedUser !== undefined && impersonatedUser !== '') {
    return 'basic:' + impersonatedUser
  }
  if (auth === undefined) {
    return 'DEFAULT'
  }
  if (auth.scheme === 'basic') {
    return 'basic:' + (auth.principal ?? '')
  } else if (auth.scheme === 'kerberos') {
    return 'kerberos:' + auth.credentials
  } else if (auth.scheme === 'bearer') {
    return 'bearer:' + auth.credentials
  } else if (auth.scheme === 'none') {
    return 'none'
  } else {
    let ordered = ''
    if (auth.parameters !== undefined) {
      Object.keys(auth.parameters).sort().forEach((key: string) => {
        if (auth.parameters !== undefined) {
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          ordered += `${key}:${auth.parameters[key]}`
        }
      })
    }
    const credentialString = (auth.credentials !== undefined && auth.credentials !== '') ? 'credentials:' + auth.credentials : ''
    const realmString = (auth.realm !== undefined && auth.realm !== '') ? 'realm:' + auth.realm : ''
    return 'scheme:' + auth.scheme + 'principal:' + (auth.principal ?? '') + credentialString + realmString + 'parameters:' + ordered
  }
}

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
  if (impersonatedUser != null) {
    return 'basic:' + impersonatedUser
  }
  if (auth === undefined) {
    return 'DEFAULT'
  }
  if (auth.scheme === 'basic') {
    return 'basic:' + (auth.principal ?? '')
  }
  if (auth.scheme === 'kerberos') {
    return 'kerberos:' + auth.credentials
  }
  if (auth.scheme === 'bearer') {
    return 'bearer:' + auth.credentials
  }
  if (auth.scheme === 'none') {
    return 'none'
  }
  return JSON.stringify(orderedObject(auth))
}

function orderedObject (obj: object): any[] {
  let ordered: any[] = []
  Object.keys(obj).sort().forEach((key: string) => {
    // @ts-expect-error: undefined check is already made
    let entry: any = obj[key]
    if (typeof entry === 'object' && !(entry instanceof Array)) {
      entry = orderedObject(entry)
    }
    ordered = ordered.concat([key, entry])
  })
  return ordered
}

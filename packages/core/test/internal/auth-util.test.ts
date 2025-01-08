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

import { auth } from 'neo4j-driver-core'
import { cacheKey } from '../../src/internal/auth-util'

describe('#unit cacheKey()', () => {
  it.each([
    ['basic', auth.basic('hello', 'basic'), 'basic:hello'],
    ['kerberos', auth.kerberos('kerberosString'), 'kerberos:kerberosString'],
    ['bearer', auth.bearer('bearerToken'), 'bearer:bearerToken'],
    ['custom without parameters', auth.custom('hello', 'custom', 'realm', 'scheme'), 'scheme:schemeprincipal:hellocredentials:customrealm:realmparameters:'],
    ['custom with parameters', auth.custom('hello', 'custom', 'realm', 'scheme', { array: [1, 2, 3] }), 'scheme:schemeprincipal:hellocredentials:customrealm:realmparameters:array:1,2,3']
  ])('should create correct cacheKey for % auth toke', (_, token, expectedKey) => {
    expect(cacheKey(token)).toEqual(expectedKey)
  })
})

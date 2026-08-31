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
import auth from '../src/auth'
import { cacheKey } from '../src/internal/auth-util'

describe('auth', () => {
  test('.custom() should crash with circular references in parameters', () => {
    const params = { a: '', b: {} }
    params.b = params
    expect(() => auth.custom('test', 'pass', 'realm', 'scheme', params)).toThrow('Circular references in custom auth token parameters')
  })

  test('.bearer()', () => {
    expect(auth.bearer('==Qyahiadakkda')).toEqual({ scheme: 'bearer', credentials: '==Qyahiadakkda' })
  })

  test.each([
    [
      ['user', 'pass', 'realm', 'scheme', { param: 'param' }],
      {
        scheme: 'scheme',
        principal: 'user',
        credentials: 'pass',
        realm: 'realm',
        parameters: { param: 'param' }
      }
    ],
    [
      ['user', '', '', 'scheme', {}],
      {
        scheme: 'scheme',
        principal: 'user'
      }
    ],
    [
      ['user', undefined, undefined, 'scheme', undefined],
      {
        scheme: 'scheme',
        principal: 'user'
      }
    ],
    [
      ['user', null, null, 'scheme', null],
      {
        scheme: 'scheme',
        principal: 'user'
      }
    ]
  ])('.custom()', (args, output) => {
    expect(auth.custom.apply(auth, args)).toEqual(output)
  })

  test.each([
    [
      ['user', 'pass', 'realm', 'scheme', { param: 'param' }],
      ['user', 'pass', 'realm', 'scheme', { param: 'param' }],
      true
    ],
    [
      ['user', 'pass', 'realm', 'scheme', { param2: 'param2', param: 'param' }],
      ['user', 'pass', 'realm', 'scheme', { param: 'param', param2: 'param2' }],
      true
    ],
    [
      ['user', 'pass', 'realm', 'scheme', { a: { param2: 'param2', param: 'param' } }],
      ['user', 'pass', 'realm', 'scheme', { a: { param: 'param', param2: 'param2' } }],
      true
    ],
    [
      ['user', 'pass', 'realm', 'scheme', { param: [1, 2, 3] }],
      ['user', 'pass', 'realm', 'scheme', { param: [1, 2, 3] }],
      true
    ],
    [
      ['user', 'pass', 'realm', 'scheme', { param: [1, 2, 3] }],
      ['user', 'pass', 'realm', 'scheme', { param: [1, 3, 2] }],
      false
    ]

  ])('custom token cacheKey', (args1, args2, shouldMatch) => {
    if (shouldMatch === true) {
      expect(cacheKey(auth.custom.apply(auth, args1))).toEqual(cacheKey(auth.custom.apply(auth, args2)))
    } else {
      expect(cacheKey(auth.custom.apply(auth, args1))).not.toEqual(cacheKey(auth.custom.apply(auth, args2)))
    }
  })

  test.each([
    [
      {
        scheme: 'basic',
        principal: 'user',
        credentials: 'password'
      },
      'basic:user'
    ],
    [
      {
        scheme: 'bearer',
        credentials: 'Base64EncodedString'
      },
      'bearer:Base64EncodedString'
    ],
    [
      {
        scheme: 'kerberos',
        credentials: 'Base64EncodedString'
      },
      'kerberos:Base64EncodedString'
    ],
    [
      {
        scheme: 'none',
        credentials: ''
      },
      'none'
    ]
  ])('token cacheKey', (token, expected) => {
    expect(cacheKey(token)).toEqual(expected)
  })
})

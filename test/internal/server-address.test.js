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

import { internal } from 'neo4j-driver-core'

const {
  serverAddress: { ServerAddress }
} = internal

describe('#unit ServerAddress', () => {
  it('should construct with correct values', () => {
    verifyAddress(ServerAddress.fromUrl('host.some.domain:8687'), {
      host: 'host.some.domain',
      port: 8687,
      hostAndPort: 'host.some.domain:8687',
      key: 'host.some.domain:8687',
      toString: 'host.some.domain:8687'
    })

    verifyAddress(ServerAddress.fromUrl('http://host.some.domain:8687'), {
      host: 'host.some.domain',
      port: 8687,
      hostAndPort: 'host.some.domain:8687',
      key: 'host.some.domain:8687',
      toString: 'host.some.domain:8687'
    })

    verifyAddress(ServerAddress.fromUrl('host2.some.domain'), {
      host: 'host2.some.domain',
      port: 7687,
      hostAndPort: 'host2.some.domain:7687',
      key: 'host2.some.domain:7687',
      toString: 'host2.some.domain:7687'
    })

    verifyAddress(ServerAddress.fromUrl('https://host2.some.domain'), {
      host: 'host2.some.domain',
      port: 7473,
      hostAndPort: 'host2.some.domain:7473',
      key: 'host2.some.domain:7473',
      toString: 'host2.some.domain:7473'
    })

    verifyAddress(ServerAddress.fromUrl('10.10.192.0'), {
      host: '10.10.192.0',
      port: 7687,
      hostAndPort: '10.10.192.0:7687',
      key: '10.10.192.0:7687',
      toString: '10.10.192.0:7687'
    })

    verifyAddress(ServerAddress.fromUrl('[1afc:0:a33:85a3::ff2f]:8889'), {
      host: '1afc:0:a33:85a3::ff2f',
      port: 8889,
      hostAndPort: '[1afc:0:a33:85a3::ff2f]:8889',
      key: '[1afc:0:a33:85a3::ff2f]:8889',
      toString: '[1afc:0:a33:85a3::ff2f]:8889'
    })
  })

  it('should return correct values when resolved', () => {
    const address = ServerAddress.fromUrl('host.some.domain:8787')
    const resolved1 = address.resolveWith('172.0.0.1')
    const resolved2 = address.resolveWith('172.0.1.1')

    verifyAddress(resolved1, {
      host: 'host.some.domain',
      port: 8787,
      hostAndPort: 'host.some.domain:8787',
      key: 'host.some.domain:8787',
      toString: 'host.some.domain:8787(172.0.0.1)',
      resolvedHost: '172.0.0.1'
    })

    verifyAddress(resolved2, {
      host: 'host.some.domain',
      port: 8787,
      hostAndPort: 'host.some.domain:8787',
      key: 'host.some.domain:8787',
      toString: 'host.some.domain:8787(172.0.1.1)',
      resolvedHost: '172.0.1.1'
    })
  })

  it('should not lose host info if resolved', () => {
    const address = ServerAddress.fromUrl('host.some.domain:8787')
    const resolved1 = address.resolveWith('192.168.0.1')
    const resolved2 = resolved1.resolveWith('192.168.100.1')

    verifyAddress(resolved2, {
      host: 'host.some.domain',
      port: 8787,
      hostAndPort: 'host.some.domain:8787',
      key: 'host.some.domain:8787',
      toString: 'host.some.domain:8787(192.168.100.1)',
      resolvedHost: '192.168.100.1'
    })
  })
})

function verifyAddress (
  address,
  { host, port, hostAndPort, key, toString, resolvedHost = null } = {}
) {
  expect(address.host()).toEqual(host)
  expect(address.port()).toEqual(port)
  expect(address.asHostPort()).toEqual(hostAndPort)
  expect(address.asKey()).toEqual(key)
  expect(address.toString()).toEqual(toString)
  expect(address.resolvedHost()).toEqual(resolvedHost || host)
}

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

import NodeHostNameResolver from '../../../src/channel/node/node-host-name-resolver'
import { internal } from 'neo4j-driver-core'

const {
  serverAddress: { ServerAddress }
} = internal

describe('#unit NodeHostNameResolver', () => {
  it('should resolve address', done => {
    const seedRouter = ServerAddress.fromUrl('neo4j.com')
    const resolver = new NodeHostNameResolver()

    resolver.resolve(seedRouter).then(addresses => {
      expect(addresses.length).toBeGreaterThan(0)

      addresses.forEach(address => {
        expectToBeDefined(address)
        expect(address.host()).toEqual('neo4j.com')
        expect(address.resolvedHost()).not.toEqual('neo4j.com')
        expect(address.port()).toEqual(7687) // default port should be appended
      })

      done()
    })
  }, 20000)

  it('should resolve address with port', done => {
    const seedRouter = ServerAddress.fromUrl('neo4j.com:7474')
    const resolver = new NodeHostNameResolver()

    resolver.resolve(seedRouter).then(addresses => {
      expect(addresses.length).toBeGreaterThan(0)

      addresses.forEach(address => {
        expectToBeDefined(address)
        expect(address.host()).toEqual('neo4j.com')
        expect(address.resolvedHost()).not.toEqual('neo4j.com')
        expect(address.port()).toEqual(7474) // default port should be appended
      })

      done()
    })
  }, 20000)

  it('should resolve IPv4 address to itself', done => {
    const addressToResolve = ServerAddress.fromUrl('127.0.0.1')
    const expectedResolvedAddress = '127.0.0.1:7687' // includes default port
    testIpAddressResolution(addressToResolve, expectedResolvedAddress, done)
  }, 20000)

  it('should resolve IPv4 address with port to itself', done => {
    const address = ServerAddress.fromUrl('127.0.0.1:7474')
    const expectedResolvedAddress = '127.0.0.1:7474' // includes default port
    testIpAddressResolution(address, expectedResolvedAddress, done)
  }, 20000)

  it('should resolve IPv6 address to itself', done => {
    const addressToResolve = ServerAddress.fromUrl('[2001:4860:4860::8888]')
    const expectedResolvedAddress = '[2001:4860:4860::8888]:7687' // includes default port
    testIpAddressResolution(addressToResolve, expectedResolvedAddress, done)
  }, 20000)

  it('should resolve IPv6 address with port to itself', done => {
    const address = ServerAddress.fromUrl('[2001:4860:4860::8888]:7474')
    const expectedResolvedAddress = '[2001:4860:4860::8888]:7474'
    testIpAddressResolution(address, expectedResolvedAddress, done)
  }, 20000)
})

function testIpAddressResolution (address, expectedResolvedAddress, done) {
  const resolver = new NodeHostNameResolver()

  resolver.resolve(address).then(addresses => {
    expect(addresses.length).toEqual(1)
    expect(addresses[0].asHostPort()).toEqual(expectedResolvedAddress)
    done()
  })
}

function expectToBeDefined (value) {
  expect(value).toBeDefined()
  expect(value).not.toBeNull()
}

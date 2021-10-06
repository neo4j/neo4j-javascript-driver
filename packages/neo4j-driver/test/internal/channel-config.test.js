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

import ChannelConfig from '../../../bolt-connection/lib/channel/channel-config'
import { error, internal } from 'neo4j-driver-core'

const {
  util: { ENCRYPTION_OFF, ENCRYPTION_ON },
  serverAddress: { ServerAddress }
} = internal

const { SERVICE_UNAVAILABLE } = error

describe('#unit ChannelConfig', () => {
  it('should respect given Url', () => {
    const address = ServerAddress.fromUrl('bolt://neo4j.com:4242')

    const config = new ChannelConfig(address, {}, '')

    expect(config.address.host()).toEqual('neo4j.com')
    expect(config.address.port()).toEqual(4242)
  })

  it('should respect given encrypted conf', () => {
    const encrypted = 'ENCRYPTION_ON'

    const config = new ChannelConfig(null, { encrypted: encrypted }, '')

    expect(config.encrypted).toEqual(encrypted)
  })

  it('should respect given trust conf', () => {
    const trust = 'TRUST_ALL_CERTIFICATES'

    const config = new ChannelConfig(null, { trust: trust }, '')

    expect(config.trust).toEqual(trust)
  })

  it('should respect given trusted certificates conf', () => {
    const trustedCertificates = ['./foo.pem', './bar.pem', './baz.pem']

    const config = new ChannelConfig(
      null,
      { trustedCertificates: trustedCertificates },
      ''
    )

    expect(config.trustedCertificates).toEqual(trustedCertificates)
  })

  it('should respect given known hosts', () => {
    const knownHostsPath = '~/.neo4j/known_hosts'

    const config = new ChannelConfig(null, { knownHosts: knownHostsPath }, '')

    expect(config.knownHostsPath).toEqual(knownHostsPath)
  })

  it('should respect given connection error code', () => {
    const connectionErrorCode = 'ConnectionFailed'

    const config = new ChannelConfig(null, {}, connectionErrorCode)

    expect(config.connectionErrorCode).toEqual(connectionErrorCode)
  })

  it('should expose encryption when nothing configured', () => {
    const config = new ChannelConfig(null, {}, '')

    expect(config.encrypted).toBeUndefined()
  })

  it('should expose trust when nothing configured', () => {
    const config = new ChannelConfig(null, {}, '')

    expect(config.trust).toBeUndefined()
  })

  it('should have no trusted certificates when not configured', () => {
    const config = new ChannelConfig(null, {}, '')

    expect(config.trustedCertificates).toEqual([])
  })

  it('should have null known hosts path when not configured', () => {
    const config = new ChannelConfig(null, {}, '')

    expect(config.knownHostsPath).toBeNull()
  })

  it('should have service unavailable as default error code', () => {
    const config = new ChannelConfig(null, {}, '')

    expect(config.connectionErrorCode).toEqual(SERVICE_UNAVAILABLE)
  })

  it('should have connection timeout by default', () => {
    const config = new ChannelConfig(null, {}, '')

    expect(config.connectionTimeout).toEqual(30000)
  })

  it('should respect configured connection timeout', () => {
    const config = new ChannelConfig(null, { connectionTimeout: 424242 }, '')

    expect(config.connectionTimeout).toEqual(424242)
  })

  it('should respect disabled connection timeout with value zero', () => {
    const config = new ChannelConfig(null, { connectionTimeout: 0 }, '')

    expect(config.connectionTimeout).toBeNull()
  })

  it('should respect disabled connection timeout with negative value', () => {
    const config = new ChannelConfig(null, { connectionTimeout: -42 }, '')

    expect(config.connectionTimeout).toBeNull()
  })

  it('should validate value of "encrypted" property', () => {
    expect(
      new ChannelConfig(null, { encrypted: null }, '').encrypted
    ).toBeNull()
    expect(
      new ChannelConfig(null, { encrypted: undefined }, '').encrypted
    ).toBeUndefined()
    expect(
      new ChannelConfig(null, { encrypted: true }, '').encrypted
    ).toBeTruthy()
    expect(
      new ChannelConfig(null, { encrypted: false }, '').encrypted
    ).toBeFalsy()
    expect(
      new ChannelConfig(null, { encrypted: ENCRYPTION_ON }, '').encrypted
    ).toEqual(ENCRYPTION_ON)
    expect(
      new ChannelConfig(null, { encrypted: ENCRYPTION_OFF }, '').encrypted
    ).toEqual(ENCRYPTION_OFF)

    expect(() => new ChannelConfig(null, { encrypted: [] }, '')).toThrow()
    expect(() => new ChannelConfig(null, { encrypted: {} }, '')).toThrow()
    expect(
      () => new ChannelConfig(null, { encrypted: () => 'Hello' }, '')
    ).toThrow()
    expect(() => new ChannelConfig(null, { encrypted: 42 }, '')).toThrow()
    expect(() => new ChannelConfig(null, { encrypted: 'Hello' }, '')).toThrow()
  })

  it('should validate value of "trust" property', () => {
    expect(new ChannelConfig(null, { trust: null }, '').trust).toBeNull()
    expect(
      new ChannelConfig(null, { trust: undefined }, '').trust
    ).toBeUndefined()
    expect(
      new ChannelConfig(null, { trust: 'TRUST_ALL_CERTIFICATES' }, '').trust
    ).toEqual('TRUST_ALL_CERTIFICATES')
    expect(
      new ChannelConfig(
        null,
        { trust: 'TRUST_CUSTOM_CA_SIGNED_CERTIFICATES' },
        ''
      ).trust
    ).toEqual('TRUST_CUSTOM_CA_SIGNED_CERTIFICATES')
    expect(
      new ChannelConfig(
        null,
        { trust: 'TRUST_SYSTEM_CA_SIGNED_CERTIFICATES' },
        ''
      ).trust
    ).toEqual('TRUST_SYSTEM_CA_SIGNED_CERTIFICATES')

    expect(() => new ChannelConfig(null, { trust: [] }, '')).toThrow()
    expect(() => new ChannelConfig(null, { trust: {} }, '')).toThrow()
    expect(
      () => new ChannelConfig(null, { trust: () => 'Trust' }, '')
    ).toThrow()
    expect(() => new ChannelConfig(null, { trust: 42 }, '')).toThrow()
    expect(
      () => new ChannelConfig(null, { trust: 'SOME_WRONG_TRUST_STRATEGY' }, '')
    ).toThrow()
  })
})

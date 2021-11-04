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

import WebSocketChannel from '../../../src/channel/browser/browser-channel'
import ChannelConfig from '../../../src/channel/channel-config'
import { error, internal } from 'neo4j-driver-core'
import { setTimeoutMock } from '../../timers-util'

const {
  serverAddress: { ServerAddress },
  util: { ENCRYPTION_ON, ENCRYPTION_OFF }
} = internal

const { SERVICE_UNAVAILABLE } = error

const WS_CONNECTING = 0
const WS_OPEN = 1
const WS_CLOSING = 2
const WS_CLOSED = 3

/* eslint-disable no-global-assign */
describe('WebSocketChannel', () => {
  let webSocketChannel

  afterEach(async () => {
    if (webSocketChannel) {
      await webSocketChannel.close()
    }
  })

  it('should fallback to literal IPv6 when SyntaxError is thrown', () => {
    testFallbackToLiteralIPv6(
      'bolt://[::1]:7687',
      'ws://--1.ipv6-literal.net:7687'
    )
  })

  it('should fallback to literal link-local IPv6 when SyntaxError is thrown', () => {
    testFallbackToLiteralIPv6(
      'bolt://[fe80::1%lo0]:8888',
      'ws://fe80--1slo0.ipv6-literal.net:8888'
    )
  })

  it('should clear connection timeout when closed', async () => {
    const fakeSetTimeout = setTimeoutMock.install()
    try {
      // do not execute setTimeout callbacks
      fakeSetTimeout.pause()

      const address = ServerAddress.fromUrl('bolt://localhost:8989')
      const driverConfig = { connectionTimeout: 4242 }
      const channelConfig = new ChannelConfig(
        address,
        driverConfig,
        SERVICE_UNAVAILABLE
      )

      webSocketChannel = new WebSocketChannel(
        channelConfig,
        undefined,
        createWebSocketFactory(WS_OPEN)
      )

      expect(webSocketChannel._ws.readyState).toBe(WS_OPEN)
      expect(fakeSetTimeout.invocationDelays).toEqual([])
      expect(fakeSetTimeout.clearedTimeouts).toEqual([])

      await webSocketChannel.close()

      expect(webSocketChannel._ws.readyState).toBe(WS_CLOSED)
      expect(fakeSetTimeout.invocationDelays).toEqual([])
      expect(fakeSetTimeout.clearedTimeouts).toEqual([0]) // cleared one timeout with id 0
    } finally {
      fakeSetTimeout.uninstall()
    }
  })

  it('should select wss when running on https page', () => {
    testWebSocketScheme('https:', {}, 'wss')
  })

  it('should select ws when running on http page', () => {
    testWebSocketScheme('http:', {}, 'ws')
  })

  it('should select ws when running on https page but encryption turned off with boolean', () => {
    testWebSocketScheme('https:', { encrypted: false }, 'ws')
  })

  it('should select ws when running on https page but encryption turned off with string', () => {
    testWebSocketScheme('https:', { encrypted: ENCRYPTION_OFF }, 'ws')
  })

  it('should select wss when running on http page but encryption configured with boolean', () => {
    testWebSocketScheme('http:', { encrypted: true }, 'wss')
  })

  it('should select wss when running on http page but encryption configured with string', () => {
    testWebSocketScheme('http:', { encrypted: ENCRYPTION_ON }, 'wss')
  })

  it('should fail when encryption configured with unsupported trust strategy', () => {
    const protocolSupplier = () => 'http:'
    const address = ServerAddress.fromUrl('bolt://localhost:8989')
    const driverConfig = { encrypted: true, trust: 'TRUST_ALL_CERTIFICATES' }
    const channelConfig = new ChannelConfig(
      address,
      driverConfig,
      SERVICE_UNAVAILABLE
    )

    const channel = new WebSocketChannel(
      channelConfig,
      protocolSupplier,
      createWebSocketFactory(WS_CONNECTING)
    )

    expect(channel._error).toBeDefined()
    expect(channel._error.name).toEqual('Neo4jError')
  })

  it('should generate a warning when encryption turned on for HTTP web page', () => {
    testWarningInMixedEnvironment(true, 'http')
    testWarningInMixedEnvironment(ENCRYPTION_ON, 'http')
  })

  it('should generate a warning when encryption turned off for HTTPS web page', () => {
    testWarningInMixedEnvironment(false, 'https')
    testWarningInMixedEnvironment(ENCRYPTION_OFF, 'https')
  })

  it('should generate not warning when encryption turned and the protocol could not be fetched', () => {
    testWarningInMixedEnvironment(true, null, warnMessages =>
      expect(warnMessages.length).toBe(0)
    )
    testWarningInMixedEnvironment(ENCRYPTION_ON, null, warnMessages =>
      expect(warnMessages.length).toBe(0)
    )
  })

  it('should generate a warning when encryption turned off and the protocol could not be fetched', () => {
    testWarningInMixedEnvironment(false, null, warnMessages =>
      expect(warnMessages.length).toBe(0)
    )
    testWarningInMixedEnvironment(ENCRYPTION_OFF, null, warnMessages =>
      expect(warnMessages.length).toBe(0)
    )
  })

  it('should resolve close if websocket is already closed', async () => {
    const address = ServerAddress.fromUrl('bolt://localhost:8989')
    const channelConfig = new ChannelConfig(address, {}, SERVICE_UNAVAILABLE)
    const channel = new WebSocketChannel(
      channelConfig,
      undefined,
      createWebSocketFactory(WS_CLOSED)
    )

    await expect(channel.close()).resolves.not.toThrow()
  })

  it('should resolve close when websocket is closed', async () => {
    const address = ServerAddress.fromUrl('bolt://localhost:8989')
    const channelConfig = new ChannelConfig(address, {}, SERVICE_UNAVAILABLE)

    const channel = new WebSocketChannel(
      channelConfig,
      undefined,
      createWebSocketFactory(WS_OPEN)
    )

    await expect(channel.close()).resolves.not.toThrow()
  })

  function testFallbackToLiteralIPv6 (boltAddress, expectedWsAddress) {
    // replace real WebSocket with a function that throws when IPv6 address is used
    const socketFactory = url => {
      if (url.indexOf('[') !== -1) {
        throw new SyntaxError()
      }
      const fakeFactory = createWebSocketFactory(WS_OPEN)
      return fakeFactory(url)
    }

    const address = ServerAddress.fromUrl(boltAddress)
    // disable connection timeout, so that WebSocketChannel does not set any timeouts
    const driverConfig = { connectionTimeout: 0 }
    const channelConfig = new ChannelConfig(
      address,
      driverConfig,
      SERVICE_UNAVAILABLE
    )

    webSocketChannel = new WebSocketChannel(
      channelConfig,
      undefined,
      socketFactory
    )

    expect(webSocketChannel._ws.url).toEqual(expectedWsAddress)
  }

  function testWebSocketScheme (
    windowLocationProtocol,
    driverConfig,
    expectedScheme
  ) {
    const protocolSupplier = () => windowLocationProtocol
    const address = ServerAddress.fromUrl('bolt://localhost:8989')
    const channelConfig = new ChannelConfig(
      address,
      driverConfig,
      SERVICE_UNAVAILABLE
    )
    const channel = new WebSocketChannel(
      channelConfig,
      protocolSupplier,
      createWebSocketFactory(WS_OPEN)
    )

    expect(channel._ws.url).toEqual(expectedScheme + '://localhost:8989')
  }

  function testWarningInMixedEnvironment (
    encrypted,
    scheme,
    assertWarnMessage = warnMessages => expect(warnMessages.length).toEqual(1)
  ) {
    const originalConsoleWarn = console.warn
    try {
      // replace console.warn with a function that memorizes the message
      const warnMessages = []
      console.warn = message => warnMessages.push(message)

      const address = ServerAddress.fromUrl('bolt://localhost:8989')
      const config = new ChannelConfig(
        address,
        { encrypted: encrypted },
        SERVICE_UNAVAILABLE
      )
      const protocolSupplier = () => (scheme != null ? scheme + ':' : scheme)

      const channel = new WebSocketChannel(
        config,
        protocolSupplier,
        createWebSocketFactory(WS_OPEN)
      )

      expect(channel).toBeDefined()
      assertWarnMessage(warnMessages)
    } finally {
      console.warn = originalConsoleWarn
    }
  }

  it('should set _open to false when connection closes', async () => {
    const fakeSetTimeout = setTimeoutMock.install()
    try {
      // do not execute setTimeout callbacks
      fakeSetTimeout.pause()
      const address = ServerAddress.fromUrl('bolt://localhost:8989')
      const driverConfig = { connectionTimeout: 4242 }
      const channelConfig = new ChannelConfig(
        address,
        driverConfig,
        SERVICE_UNAVAILABLE
      )
      webSocketChannel = new WebSocketChannel(
        channelConfig,
        undefined,
        createWebSocketFactory(WS_OPEN)
      )
      webSocketChannel._ws.close()
      expect(webSocketChannel._open).toBe(false)
    } finally {
      fakeSetTimeout.uninstall()
    }
  })

  describe('.close()', () => {
    it('should set _open to false before resolve the promise', async () => {
      const fakeSetTimeout = setTimeoutMock.install()
      try {
        // do not execute setTimeout callbacks
        fakeSetTimeout.pause()
        const address = ServerAddress.fromUrl('bolt://localhost:8989')
        const driverConfig = { connectionTimeout: 4242 }
        const channelConfig = new ChannelConfig(
          address,
          driverConfig,
          SERVICE_UNAVAILABLE
        )
        webSocketChannel = new WebSocketChannel(
          channelConfig,
          undefined,
          createWebSocketFactory(WS_OPEN)
        )

        expect(webSocketChannel._open).toBe(true)

        const promise = webSocketChannel.close()

        expect(webSocketChannel._open).toBe(false)

        await promise
      } finally {
        fakeSetTimeout.uninstall()
      }
    })
  })

  describe('.setupReceiveTimeout()', () => {
    beforeEach(() => {
      const address = ServerAddress.fromUrl('http://localhost:8989')
      const channelConfig = new ChannelConfig(
        address,
        { connectionTimeout: 0 },
        SERVICE_UNAVAILABLE
      )
      webSocketChannel = new WebSocketChannel(
        channelConfig,
        undefined,
        createWebSocketFactory(WS_OPEN)
      )
    })

    it('should exists', () => {
      expect(webSocketChannel).toHaveProperty('setupReceiveTimeout')
      expect(typeof webSocketChannel.setupReceiveTimeout).toBe('function')
    })

    it('should not setTimeout', () => {
      const fakeSetTimeout = setTimeoutMock.install()
      try {
        webSocketChannel.setupReceiveTimeout()

        expect(fakeSetTimeout._timeoutIdCounter).toEqual(0)
        expect(webSocketChannel._connectionTimeoutId).toBe(null)
      } finally {
        fakeSetTimeout.uninstall()
      }
    })
  })

  function createWebSocketFactory (readyState) {
    const ws = {}
    ws.readyState = readyState
    ws.close = () => {
      ws.readyState = WS_CLOSED
      if (ws.onclose && typeof ws.onclose === 'function') {
        ws.onclose({ wasClean: true })
      }
    }
    return url => {
      ws.url = url
      return ws
    }
  }
})

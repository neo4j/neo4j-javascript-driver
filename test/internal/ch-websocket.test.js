/**
 * Copyright (c) 2002-2018 "Neo4j,"
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

import wsChannel from '../../src/v1/internal/ch-websocket';
import ChannelConfig from '../../src/v1/internal/ch-config';
import urlUtil from '../../src/v1/internal/url-util';
import {Neo4jError, SERVICE_UNAVAILABLE} from '../../src/v1/error';
import {setTimeoutMock} from './timers-util';
import {ENCRYPTION_OFF, ENCRYPTION_ON} from '../../src/v1/internal/util';

describe('WebSocketChannel', () => {

  const WebSocketChannel = wsChannel.channel;
  const webSocketChannelAvailable = wsChannel.available;

  let OriginalWebSocket;
  let webSocketChannel;
  let originalConsoleWarn;

  beforeEach(() => {
    if (webSocketChannelAvailable) {
      OriginalWebSocket = WebSocket;
    }
    originalConsoleWarn = console.warn;
    console.warn = () => {
      // mute by default
    };
  });

  afterEach(() => {
    if (webSocketChannelAvailable) {
      WebSocket = OriginalWebSocket;
    }
    if (webSocketChannel) {
      webSocketChannel.close();
    }
    console.warn = originalConsoleWarn;
  });

  it('should fallback to literal IPv6 when SyntaxError is thrown', () => {
    testFallbackToLiteralIPv6('bolt://[::1]:7687', 'ws://--1.ipv6-literal.net:7687');
  });

  it('should fallback to literal link-local IPv6 when SyntaxError is thrown', () => {
    testFallbackToLiteralIPv6('bolt://[fe80::1%lo0]:8888', 'ws://fe80--1slo0.ipv6-literal.net:8888');
  });

  it('should clear connection timeout when closed', () => {
    if (!webSocketChannelAvailable) {
      return;
    }

    const fakeSetTimeout = setTimeoutMock.install();
    try {
      // do not execute setTimeout callbacks
      fakeSetTimeout.pause();

      let fakeWebSocketClosed = false;

      // replace real WebSocket with a function that does nothing
      WebSocket = () => {
        return {
          close: () => {
            fakeWebSocketClosed = true;
          }
        };
      };

      const url = urlUtil.parseDatabaseUrl('bolt://localhost:7687');
      const driverConfig = {connectionTimeout: 4242};
      const channelConfig = new ChannelConfig(url, driverConfig, SERVICE_UNAVAILABLE);

      webSocketChannel = new WebSocketChannel(channelConfig);

      expect(fakeWebSocketClosed).toBeFalsy();
      expect(fakeSetTimeout.invocationDelays).toEqual([]);
      expect(fakeSetTimeout.clearedTimeouts).toEqual([]);

      webSocketChannel.close();

      expect(fakeWebSocketClosed).toBeTruthy();
      expect(fakeSetTimeout.invocationDelays).toEqual([]);
      expect(fakeSetTimeout.clearedTimeouts).toEqual([0]); // cleared one timeout with id 0
    } finally {
      fakeSetTimeout.uninstall();
    }
  });

  it('should select wss when running on https page', () => {
    testWebSocketScheme('https:', {}, 'wss');
  });

  it('should select ws when running on http page', () => {
    testWebSocketScheme('http:', {}, 'ws');
  });

  it('should select ws when running on https page but encryption turned off with boolean', () => {
    testWebSocketScheme('https:', {encrypted: false}, 'ws');
  });

  it('should select ws when running on https page but encryption turned off with string', () => {
    testWebSocketScheme('https:', {encrypted: ENCRYPTION_OFF}, 'ws');
  });

  it('should select wss when running on http page but encryption configured with boolean', () => {
    testWebSocketScheme('http:', {encrypted: true}, 'wss');
  });

  it('should select wss when running on http page but encryption configured with string', () => {
    testWebSocketScheme('http:', {encrypted: ENCRYPTION_ON}, 'wss');
  });

  it('should fail when encryption configured with unsupported trust strategy', () => {
    if (!webSocketChannelAvailable) {
      return;
    }

    const protocolSupplier = () => 'http:';

    WebSocket = () => {
      return {
        close: () => {
        }
      };
    };

    const url = urlUtil.parseDatabaseUrl('bolt://localhost:8989');
    const driverConfig = {encrypted: true, trust: 'TRUST_ON_FIRST_USE'};
    const channelConfig = new ChannelConfig(url, driverConfig, SERVICE_UNAVAILABLE);

    const channel = new WebSocketChannel(channelConfig, protocolSupplier);

    expect(channel._error).toBeDefined();
    expect(channel._error.name).toEqual('Neo4jError');
  });

  it('should generate a warning when encryption turned on for HTTP web page', () => {
    testWarningInMixedEnvironment(true, 'http');
    testWarningInMixedEnvironment(ENCRYPTION_ON, 'http');
  });

  it('should generate a warning when encryption turned off for HTTPS web page', () => {
    testWarningInMixedEnvironment(false, 'https');
    testWarningInMixedEnvironment(ENCRYPTION_OFF, 'https');
  });

  function testFallbackToLiteralIPv6(boltAddress, expectedWsAddress) {
    if (!webSocketChannelAvailable) {
      return;
    }

    // replace real WebSocket with a function that throws when IPv6 address is used
    WebSocket = url => {
      if (url.indexOf('[') !== -1) {
        throw new SyntaxError();
      }
      return {
        url: url,
        close: () => {
        }
      };
    };

    const url = urlUtil.parseDatabaseUrl(boltAddress);
    // disable connection timeout, so that WebSocketChannel does not set any timeouts
    const driverConfig = {connectionTimeout: 0};
    const channelConfig = new ChannelConfig(url, driverConfig, SERVICE_UNAVAILABLE);

    webSocketChannel = new WebSocketChannel(channelConfig);

    expect(webSocketChannel._ws.url).toEqual(expectedWsAddress);
  }

  function testWebSocketScheme(windowLocationProtocol, driverConfig, expectedScheme) {
    if (!webSocketChannelAvailable) {
      return;
    }

    const protocolSupplier = () => windowLocationProtocol;

    // replace real WebSocket with a function that memorizes the url
    WebSocket = url => {
      return {
        url: url,
        close: () => {
        }
      };
    };

    const url = urlUtil.parseDatabaseUrl('bolt://localhost:8989');
    const channelConfig = new ChannelConfig(url, driverConfig, SERVICE_UNAVAILABLE);
    const channel = new WebSocketChannel(channelConfig, protocolSupplier);

    expect(channel._ws.url).toEqual(expectedScheme + '://localhost:8989');
  }

  function testWarningInMixedEnvironment(encrypted, scheme) {
    if (!webSocketChannelAvailable) {
      return;
    }

    // replace real WebSocket with a function that memorizes the url
    WebSocket = url => {
      return {
        url: url,
        close: () => {
        }
      };
    };

    // replace console.warn with a function that memorizes the message
    const warnMessages = [];
    console.warn = message => warnMessages.push(message);

    const url = urlUtil.parseDatabaseUrl('bolt://localhost:8989');
    const config = new ChannelConfig(url, {encrypted: encrypted}, SERVICE_UNAVAILABLE);
    const protocolSupplier = () => scheme + ':';

    const channel = new WebSocketChannel(config, protocolSupplier);

    expect(channel).toBeDefined();
    expect(warnMessages.length).toEqual(1);
  }

});

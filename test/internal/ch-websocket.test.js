/**
 * Copyright (c) 2002-2018 "Neo Technology,"
 * Network Engine for Objects in Lund AB [http://neotechnology.com]
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
import {SERVICE_UNAVAILABLE} from '../../src/v1/error';
import {setTimeoutMock} from './timers-util';

describe('WebSocketChannel', () => {

  const WebSocketChannel = wsChannel.channel;
  const webSocketChannelAvailable = wsChannel.available;

  let OriginalWebSocket;
  let webSocketChannel;

  beforeEach(() => {
    if (webSocketChannelAvailable) {
      OriginalWebSocket = WebSocket;
    }
  });

  afterEach(() => {
    if (webSocketChannelAvailable) {
      WebSocket = OriginalWebSocket;
    }
    if (webSocketChannel) {
      webSocketChannel.close();
    }
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

      const url = urlUtil.parseBoltUrl('bolt://localhost:7687');
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

    const url = urlUtil.parseBoltUrl(boltAddress);
    // disable connection timeout, so that WebSocketChannel does not set any timeouts
    const driverConfig = {connectionTimeout: 0};
    const channelConfig = new ChannelConfig(url, driverConfig, SERVICE_UNAVAILABLE);

    webSocketChannel = new WebSocketChannel(channelConfig);

    expect(webSocketChannel._ws.url).toEqual(expectedWsAddress);
  }

});

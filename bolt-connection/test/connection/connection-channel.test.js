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

import ChannelConnection from '../../src/connection/connection-channel'
import { int, internal } from 'neo4j-driver-core'
import { add } from 'lodash'

const {
  serverAddress: { ServerAddress },
  logger: { Logger }
} = internal

describe('ChannelConnection', () => {
  describe('.connect()', () => {
    it.each([
      [42000, 42n],
      [21000, 21],
      [12000, int(12)]
    ])(
      "should call this._ch.setupReceiveTimeout(%o) when onComplete metadata.hints['connection.recv_timeout_seconds'] is %o",
      async (expected, receiveTimeout) => {
        const channel = {
          setupReceiveTimeout: jest.fn().mockName('setupReceiveTimeout')
        }
        const protocol = {
          initialize: jest.fn(observer =>
            observer.onComplete({
              hints: { 'connection.recv_timeout_seconds': receiveTimeout }
            })
          )
        }
        const protocolSupplier = () => protocol
        const connection = spyOnConnectionChannel({ channel, protocolSupplier })

        await connection.connect('userAgent', {})

        expect(channel.setupReceiveTimeout).toHaveBeenCalledWith(expected)
      }
    )

    it.each([
      [undefined],
      [null],
      [{}],
      [{ hints: null }],
      [{ hints: {} }],
      [{ hints: { 'connection.recv_timeout_seconds': null } }],
      [{ hints: { 'connection.recv_timeout_seconds': -1 } }],
      [{ hints: { 'connection.recv_timeout_seconds': -1n } }],
      [{ hints: { 'connection.recv_timeout_seconds': int(-1) } }],
      [{ hints: { 'connection.recv_timeout_seconds': 0 } }],
      [{ hints: { 'connection.recv_timeout_seconds': 0n } }],
      [{ hints: { 'connection.recv_timeout_seconds': int(0) } }]
    ])(
      'should call not call this._ch.setupReceiveTimeout() when onComplete metadata is %o',
      async metadata => {
        const channel = {
          setupReceiveTimeout: jest.fn().mockName('setupReceiveTimeout')
        }
        const protocol = {
          initialize: jest.fn(observer => observer.onComplete(metadata))
        }
        const protocolSupplier = () => protocol
        const connection = spyOnConnectionChannel({ channel, protocolSupplier })

        await connection.connect('userAgent', {})

        expect(channel.setupReceiveTimeout).not.toHaveBeenCalled()
      }
    )

    it.each([
      [{ hints: { 'connection.recv_timeout_seconds': -1.5 } }],
      [{ hints: { 'connection.recv_timeout_seconds': -1 } }],
      [{ hints: { 'connection.recv_timeout_seconds': -1n } }],
      [{ hints: { 'connection.recv_timeout_seconds': int(-1) } }],
      [{ hints: { 'connection.recv_timeout_seconds': 0 } }],
      [{ hints: { 'connection.recv_timeout_seconds': 0n } }],
      [{ hints: { 'connection.recv_timeout_seconds': int(0) } }],
      [{ hints: { 'connection.recv_timeout_seconds': 12.1 } }]
    ])(
      'should call log an info when onComplete metadata is %o',
      async metadata => {
        const channel = {
          setupReceiveTimeout: jest.fn().mockName('setupReceiveTimeout')
        }
        const protocol = {
          initialize: jest.fn(observer => observer.onComplete(metadata))
        }
        const address = ServerAddress.fromUrl('bolt://localhost')
        const protocolSupplier = () => protocol
        const loggerFunction = jest.fn().mockName('logger')
        const logger = new Logger('info', loggerFunction)
        const connection = spyOnConnectionChannel({
          channel,
          protocolSupplier,
          logger,
          address
        })

        await connection.connect('userAgent', {})
        expect(loggerFunction).toHaveBeenCalledWith(
          'info',
          `Connection [${
            connection._id
          }][] Server located at ${address.asHostPort()} ` +
            `supplied an invalid connection receive timeout value (${metadata.hints['connection.recv_timeout_seconds']}). ` +
            'Please, verify the server configuration and status because this can be the symptom of a bigger issue.'
        )
      }
    )
  })

  function spyOnConnectionChannel ({
    channel,
    errorHandler,
    address,
    logger,
    disableLosslessIntegers,
    serversideRouting,
    chuncker,
    protocolSupplier
  }) {
    address = address || ServerAddress.fromUrl('bolt://localhost')
    logger = logger || new Logger('info', () => {})
    return new ChannelConnection(
      channel,
      errorHandler,
      address,
      logger,
      disableLosslessIntegers,
      serversideRouting,
      chuncker,
      protocolSupplier
    )
  }
})

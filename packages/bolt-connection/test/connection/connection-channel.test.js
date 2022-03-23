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
import { int, internal, newError } from 'neo4j-driver-core'

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
      'should not call this._ch.setupReceiveTimeout() when onComplete metadata is %o',
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

  describe('._handleFatalError()', () => {
    describe('when there is not current failure on going', () => {
      const thrownError = newError('some error', 'C')
      let loggerFunction;
      let notifyFatalError;
      let connection;

      beforeEach(() => {
        notifyFatalError = jest.fn()
        const protocol = {
          notifyFatalError,
          currentFailure: null
        }
        loggerFunction = jest.fn()
        const logger = new Logger('info', loggerFunction)
        const protocolSupplier = () => protocol
        connection = spyOnConnectionChannel({ protocolSupplier, logger })
      })

      it('should set connection state to broken', () => {
        connection._handleFatalError(thrownError)

        expect(connection._isBroken).toBe(true)
      })

      it('should set internal erro to the thrownError', () => {
        connection._handleFatalError(thrownError)

        expect(connection._error).toBe(thrownError)
      })

      it('should call notifyFatalError with the thrownError', () => {
        connection._handleFatalError(thrownError)

        expect(notifyFatalError).toHaveBeenCalledWith(thrownError)
      })

      it('should log the thrownError', () => {
        connection._handleFatalError(thrownError)

        expect(loggerFunction).toHaveBeenCalledWith(
          'error',
          `${connection} experienced a fatal error caused by Neo4jError: some error ` +
            '({"code":"C","name":"Neo4jError"})'
        )
      })
    })

    describe('when there is current failure on going', () => {
      const thrownError = newError('some error', 'C')
      const currentFailure = newError('current failure', 'ongoing')
      let loggerFunction;
      let notifyFatalError;
      let connection;

      beforeEach(() => {
        notifyFatalError = jest.fn()
        const protocol = {
          notifyFatalError,
          currentFailure
        }
        loggerFunction = jest.fn()
        const logger = new Logger('info', loggerFunction)
        const protocolSupplier = () => protocol
        connection = spyOnConnectionChannel({ protocolSupplier, logger })
      })

      it('should set connection state to broken', () => {
        connection._handleFatalError(thrownError)

        expect(connection._isBroken).toBe(true)
      })

      it('should set internal erro to the currentFailure', () => {
        connection._handleFatalError(thrownError)

        expect(connection._error).toBe(currentFailure)
      })

      it('should call notifyFatalError with the currentFailure', () => {
        connection._handleFatalError(thrownError)

        expect(notifyFatalError).toHaveBeenCalledWith(currentFailure)
      })

      it('should log the currentFailure', () => {
        connection._handleFatalError(thrownError)

        expect(loggerFunction).toHaveBeenCalledWith(
          'error',
          `${connection} experienced a fatal error caused by Neo4jError: current failure ` +
            '({"code":"ongoing","name":"Neo4jError"})'
        )
      })
    })
  })

  describe('._resetOnFailure()', () => {
    describe('when connection isOpen', () => {
      it('should call protocol.reset() and then protocol.resetFailure() onComplete', () => {
        const channel = {
          _open: true
        }

        const protocol = {
          reset: jest.fn(observer => observer.onComplete()),
          resetFailure: jest.fn()
        }
        const protocolSupplier = () => protocol
        const connection = spyOnConnectionChannel({ channel, protocolSupplier })

        connection._resetOnFailure()

        expect(protocol.reset).toHaveBeenCalled()
        expect(protocol.resetFailure).toHaveBeenCalled()
      })

      it('should call protocol.reset() and then protocol.resetFailure() onError', () => {
        const channel = {
          _open: true
        }

        const protocol = {
          reset: jest.fn(observer => observer.onError()),
          resetFailure: jest.fn()
        }
        const protocolSupplier = () => protocol
        const connection = spyOnConnectionChannel({ channel, protocolSupplier })

        connection._resetOnFailure()

        expect(protocol.reset).toHaveBeenCalled()
        expect(protocol.resetFailure).toHaveBeenCalled()
      })
    })

    describe('when connection is not open', () => {
      it('should not call protocol.reset() and protocol.resetFailure()', () => {
        const channel = {
          _open: false
        }

        const protocol = {
          reset: jest.fn(observer => {
            observer.onComplete()
            observer.onError()
          }),
          resetFailure: jest.fn()
        }
        const protocolSupplier = () => protocol
        const connection = spyOnConnectionChannel({ channel, protocolSupplier })

        connection._resetOnFailure()

        expect(protocol.reset).not.toHaveBeenCalled()
        expect(protocol.resetFailure).not.toHaveBeenCalled()
      })
    })
  })

  describe('.__handleOngoingRequestsNumberChange()', () => {
    it('should call channel.stopReceiveTimeout when requets number equals to 0', () => {
      const channel = {
        stopReceiveTimeout: jest.fn().mockName('stopReceiveTimeout'),
        startReceiveTimeout: jest.fn().mockName('startReceiveTimeout')
      }
      const connection = spyOnConnectionChannel({ channel, protocolSupplier: () => undefined })

      connection._handleOngoingRequestsNumberChange(0)

      expect(channel.stopReceiveTimeout).toHaveBeenCalledTimes(1)
    })

    it('should not call channel.startReceiveTimeout when requets number equals to 0', () => {
      const channel = {
        stopReceiveTimeout: jest.fn().mockName('stopReceiveTimeout'),
        startReceiveTimeout: jest.fn().mockName('startReceiveTimeout')
      }
      const connection = spyOnConnectionChannel({ channel, protocolSupplier: () => undefined })

      connection._handleOngoingRequestsNumberChange(0)

      expect(channel.startReceiveTimeout).toHaveBeenCalledTimes(0)
    })

    it.each([
      [1], [2], [3], [5], [8], [13], [3000]
    ])('should call channel.startReceiveTimeout when requets number equals to %d', (requests) => {
      const channel = {
        stopReceiveTimeout: jest.fn().mockName('stopReceiveTimeout'),
        startReceiveTimeout: jest.fn().mockName('startReceiveTimeout')
      }
      const connection = spyOnConnectionChannel({ channel, protocolSupplier: () => undefined })

      connection._handleOngoingRequestsNumberChange(requests)

      expect(channel.startReceiveTimeout).toHaveBeenCalledTimes(1)
    })

    it.each([
      [1], [2], [3], [5], [8], [13], [3000]
    ])('should not call channel.stopReceiveTimeout when requets number equals to %d', (requests) => {
      const channel = {
        stopReceiveTimeout: jest.fn().mockName('stopReceiveTimeout'),
        startReceiveTimeout: jest.fn().mockName('startReceiveTimeout')
      }
      const connection = spyOnConnectionChannel({ channel, protocolSupplier: () => undefined })

      connection._handleOngoingRequestsNumberChange(requests)

      expect(channel.stopReceiveTimeout).toHaveBeenCalledTimes(0)
    })
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

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
import { notificationFilterBehaviour } from '../bolt/behaviour'
import { ResultStreamObserver } from '../../src/bolt'

const {
  serverAddress: { ServerAddress },
  logger: { Logger },
  bookmarks: { Bookmarks },
  txConfig: { TxConfig }
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

        await connection.connect('userAgent', 'boltAgent', {})

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

        await connection.connect('userAgent', 'boltAgent', {})

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

        await connection.connect('userAgent', 'boltAgent', {})
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

    it.each(
      notificationFilterBehaviour.notificationFilterFixture()
    )(
      'should send notificationFilter=%o to initialize ',
      async (notificationFilter) => {
        const channel = {
          setupReceiveTimeout: jest.fn().mockName('setupReceiveTimeout')
        }
        const protocol = {
          initialize: jest.fn(observer =>
            observer.onComplete({})
          )
        }
        const protocolSupplier = () => protocol
        const connection = spyOnConnectionChannel({ channel, protocolSupplier, notificationFilter })

        await connection.connect('userAgent', 'boltAgent', {})

        const call = protocol.initialize.mock.calls[0][0]

        expect(call.notificationFilter).toBe(notificationFilter)
      }
    )
    it('should set the AuthToken in the context', async () => {
      const authToken = {
        scheme: 'none'
      }
      const protocol = {
        initialize: jest.fn(observer => observer.onComplete({}))
      }
      const protocolSupplier = () => protocol
      const connection = spyOnConnectionChannel({ protocolSupplier })

      await connection.connect('userAgent', 'boltAgent', authToken)

      expect(connection.authToken).toEqual(authToken)
    })

    describe('re-auth', () => {
      describe('when protocol support re-auth', () => {
        it('should call logoff and login', async () => {
          const authToken = {
            scheme: 'none'
          }
          const protocol = {
            initialize: jest.fn(observer => observer.onComplete({})),
            logoff: jest.fn(() => undefined),
            logon: jest.fn(() => undefined),
            initialized: true,
            supportsReAuth: true
          }

          const protocolSupplier = () => protocol
          const connection = spyOnConnectionChannel({ protocolSupplier })

          await connection.connect('userAgent', 'boltAgent', authToken)

          expect(protocol.initialize).not.toHaveBeenCalled()
          expect(protocol.logoff).toHaveBeenCalledWith()
          expect(protocol.logon).toHaveBeenCalledWith({ authToken, flush: true })
          expect(connection.authToken).toEqual(authToken)
        })

        describe('when waitReAuth=true', () => {
          it('should wait for login complete', async () => {
            const authToken = {
              scheme: 'none'
            }

            const onCompleteObservers = []
            const protocol = {
              initialize: jest.fn(observer => observer.onComplete({})),
              logoff: jest.fn(() => undefined),
              logon: jest.fn(({ onComplete }) => onCompleteObservers.push(onComplete)),
              initialized: true,
              supportsReAuth: true
            }

            const protocolSupplier = () => protocol
            const connection = spyOnConnectionChannel({ protocolSupplier })

            const connectionPromise = connection.connect('userAgent', 'boltAgent', authToken, true)

            const isPending = await Promise.race([connectionPromise, Promise.resolve(true)])
            expect(isPending).toEqual(true)
            expect(onCompleteObservers.length).toEqual(1)

            expect(protocol.initialize).not.toHaveBeenCalled()
            expect(protocol.logoff).toHaveBeenCalled()
            expect(protocol.logon).toHaveBeenCalledWith(expect.objectContaining({
              authToken,
              flush: true
            }))

            expect(connection.authToken).toEqual(authToken)

            onCompleteObservers.forEach(onComplete => onComplete({}))
            await expect(connectionPromise).resolves.toBe(connection)
          })

          it('should notify logoff errors', async () => {
            const authToken = {
              scheme: 'none'
            }

            const onLogoffErrors = []
            const protocol = {
              initialize: jest.fn(observer => observer.onComplete({})),
              logoff: jest.fn(({ onError }) => onLogoffErrors.push(onError)),
              logon: jest.fn(() => undefined),
              initialized: true,
              supportsReAuth: true
            }

            const protocolSupplier = () => protocol
            const connection = spyOnConnectionChannel({ protocolSupplier })

            const connectionPromise = connection.connect('userAgent', 'boltAgent', authToken, true)

            const isPending = await Promise.race([connectionPromise, Promise.resolve(true)])
            expect(isPending).toEqual(true)
            expect(onLogoffErrors.length).toEqual(1)

            expect(protocol.initialize).not.toHaveBeenCalled()
            expect(protocol.logoff).toHaveBeenCalled()
            expect(protocol.logon).toHaveBeenCalledWith(expect.objectContaining({
              authToken,
              flush: true
            }))

            const expectedError = newError('something wrong is not right.')
            onLogoffErrors.forEach(onError => onError(expectedError))
            await expect(connectionPromise).rejects.toBe(expectedError)
          })

          it('should notify logon errors', async () => {
            const authToken = {
              scheme: 'none'
            }

            const onLoginErrors = []
            const protocol = {
              initialize: jest.fn(observer => observer.onComplete({})),
              logoff: jest.fn(() => undefined),
              logon: jest.fn(({ onError }) => onLoginErrors.push(onError)),
              initialized: true,
              supportsReAuth: true
            }

            const protocolSupplier = () => protocol
            const connection = spyOnConnectionChannel({ protocolSupplier })

            const connectionPromise = connection.connect('userAgent', 'boltAgent', authToken, true)

            const isPending = await Promise.race([connectionPromise, Promise.resolve(true)])
            expect(isPending).toEqual(true)
            expect(onLoginErrors.length).toEqual(1)

            expect(protocol.initialize).not.toHaveBeenCalled()
            expect(protocol.logoff).toHaveBeenCalled()
            expect(protocol.logon).toHaveBeenCalledWith(expect.objectContaining({
              authToken,
              flush: true
            }))

            const expectedError = newError('something wrong is not right.')
            onLoginErrors.forEach(onError => onError(expectedError))
            await expect(connectionPromise).rejects.toBe(expectedError)
          })
        })
      })

      describe('when protocol does not support re-auth', () => {
        it('should throw connection does not support re-auth', async () => {
          const authToken = {
            scheme: 'none'
          }
          const protocol = {
            initialize: jest.fn(observer => observer.onComplete({})),
            logoff: jest.fn(() => undefined),
            logon: jest.fn(() => undefined),
            initialized: true,
            supportsReAuth: false
          }

          const protocolSupplier = () => protocol
          const connection = spyOnConnectionChannel({ protocolSupplier })

          await expect(connection.connect('userAgent', 'boltAgent', authToken)).rejects.toThrow(
            newError('Connection does not support re-auth')
          )

          expect(protocol.initialize).not.toHaveBeenCalled()
          expect(protocol.logoff).not.toHaveBeenCalled()
          expect(protocol.logon).not.toHaveBeenCalled()
          expect(connection.authToken).toEqual(null)
        })
      })
    })
  })

  describe('._handleFatalError()', () => {
    describe('when there is not current failure on going', () => {
      const thrownError = newError('some error', 'C')
      let loggerFunction
      let notifyFatalError
      let connection

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
            '({"code":"C","name":"Neo4jError","retriable":false})'
        )
      })
    })

    describe('when there is current failure on going', () => {
      const thrownError = newError('some error', 'C')
      const currentFailure = newError('current failure', 'ongoing')
      let loggerFunction
      let notifyFatalError
      let connection

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
            '({"code":"ongoing","name":"Neo4jError","retriable":false})'
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

      it('should not call protocol.reset() when there is an ongoing reset', () => {
        const channel = {
          _open: true
        }

        const protocol = {
          reset: jest.fn(),
          resetFailure: jest.fn(),
          isLastMessageReset: jest.fn(() => true)
        }
        const protocolSupplier = () => protocol
        const connection = spyOnConnectionChannel({ channel, protocolSupplier })

        connection._resetOnFailure()

        expect(protocol.reset).toHaveBeenCalledTimes(1)
        expect(protocol.resetFailure).not.toHaveBeenCalled()

        connection._resetOnFailure()

        expect(protocol.reset).toHaveBeenCalledTimes(1)
        expect(protocol.resetFailure).not.toHaveBeenCalled()
      })

      it('should call protocol.reset() when after a previous reset completed', () => {
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

        expect(protocol.reset).toHaveBeenCalledTimes(1)
        expect(protocol.resetFailure).toHaveBeenCalledTimes(1)

        connection._resetOnFailure()

        expect(protocol.reset).toHaveBeenCalledTimes(2)
        expect(protocol.resetFailure).toHaveBeenCalledTimes(2)
      })

      it('should call protocol.reset() when after a previous reset fail', () => {
        const channel = {
          _open: true
        }

        const protocol = {
          reset: jest.fn(observer => observer.onError(new Error('some error'))),
          resetFailure: jest.fn()
        }
        const protocolSupplier = () => protocol
        const connection = spyOnConnectionChannel({ channel, protocolSupplier })

        connection._resetOnFailure()

        expect(protocol.reset).toHaveBeenCalledTimes(1)
        expect(protocol.resetFailure).toHaveBeenCalledTimes(1)

        connection._resetOnFailure()

        expect(protocol.reset).toHaveBeenCalledTimes(2)
        expect(protocol.resetFailure).toHaveBeenCalledTimes(2)
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

  describe('.resetAndFlush()', () => {
    it('should call protocol.reset() onComplete', async () => {
      const channel = {
        _open: true
      }

      const protocol = {
        reset: jest.fn(observer => observer.onComplete()),
        resetFailure: jest.fn()
      }
      const protocolSupplier = () => protocol
      const connection = spyOnConnectionChannel({ channel, protocolSupplier })

      await connection.resetAndFlush().catch(() => {})

      expect(protocol.reset).toHaveBeenCalled()
    })

    it('should call protocol.reset() onError', async () => {
      const channel = {
        _open: true
      }

      const protocol = {
        reset: jest.fn(observer => observer.onError()),
        resetFailure: jest.fn()
      }
      const protocolSupplier = () => protocol
      const connection = spyOnConnectionChannel({ channel, protocolSupplier })

      await connection.resetAndFlush().catch(() => {})

      expect(protocol.reset).toHaveBeenCalled()
    })

    it('should not call protocol.reset() when there is an ongoing reset', async () => {
      const channel = {
        _open: true
      }

      const protocol = {
        reset: jest.fn(observer => {
          setTimeout(() => observer.onComplete(), 100)
        }),
        resetFailure: jest.fn(),
        isLastMessageReset: jest.fn(() => true)
      }
      const protocolSupplier = () => protocol
      const connection = spyOnConnectionChannel({ channel, protocolSupplier })

      const completeFirstResetAndFlush = connection.resetAndFlush()

      expect(protocol.reset).toHaveBeenCalledTimes(1)

      await connection.resetAndFlush()

      expect(protocol.reset).toHaveBeenCalledTimes(1)

      await completeFirstResetAndFlush
    })

    it('should call protocol.reset() when after a previous reset completed', async () => {
      const channel = {
        _open: true
      }

      const protocol = {
        reset: jest.fn(observer => observer.onComplete()),
        resetFailure: jest.fn()
      }
      const protocolSupplier = () => protocol
      const connection = spyOnConnectionChannel({ channel, protocolSupplier })

      await connection.resetAndFlush()

      expect(protocol.reset).toHaveBeenCalledTimes(1)

      await connection.resetAndFlush()

      expect(protocol.reset).toHaveBeenCalledTimes(2)
    })

    it('should call protocol.reset() when after a previous reset fail', async () => {
      const channel = {
        _open: true
      }

      const protocol = {
        reset: jest.fn(observer => observer.onError(new Error('some error'))),
        resetFailure: jest.fn()
      }
      const protocolSupplier = () => protocol
      const connection = spyOnConnectionChannel({ channel, protocolSupplier })

      await connection.resetAndFlush().catch(() => {})

      expect(protocol.reset).toHaveBeenCalledTimes(1)

      await connection.resetAndFlush().catch(() => {})

      expect(protocol.reset).toHaveBeenCalledTimes(2)
    })
  })

  describe('.beginTransaction()', () => {
    it('should call redirect the request to the protocol', () => {
      const observer = new ResultStreamObserver()
      const protocol = {
        beginTransaction: jest.fn(() => observer)
      }
      const connection = spyOnConnectionChannel({ protocolSupplier: () => protocol })

      const config = {
        bookmarks: Bookmarks.empty(),
        txConfig: TxConfig.empty(),
        database: 'neo4j',
        mode: 'READ',
        impersonatedUser: 'other cat',
        notificationFilter: {
          minimumSeverityLevel: 'WARNING'
        },
        beforeError: () => console.log('my error'),
        afterComplete: (metadata) => console.log('metadata', metadata)
      }

      const result = connection.beginTransaction(config)

      expect(result).toBe(observer)
      expect(protocol.beginTransaction).toBeCalledWith(config)
    })
  })

  describe('.run()', () => {
    it('should call redirect the request to the protocol', () => {
      const observer = new ResultStreamObserver()
      const protocol = {
        run: jest.fn(() => observer)
      }
      const connection = spyOnConnectionChannel({ protocolSupplier: () => protocol })

      const query = 'RETURN $x'
      const params = { x: 1 }
      const config = {
        bookmarks: Bookmarks.empty(),
        txConfig: TxConfig.empty(),
        database: 'neo4j',
        mode: 'READ',
        impersonatedUser: 'other cat',
        notificationFilter: {
          minimumSeverityLevel: 'WARNING'
        },
        fetchSize: 1000,
        highRecordWatermark: 1234,
        lowRecordWatermark: 12,
        reactive: false,
        beforeError: () => console.log('my error'),
        afterComplete: (metadata) => console.log('metadata', metadata)
      }

      const result = connection.run(query, params, config)

      expect(result).toBe(observer)
      expect(protocol.run).toBeCalledWith(query, params, config)
    })
  })

  describe('.commitTransaction()', () => {
    it('should call redirect the request to the protocol', () => {
      const observer = new ResultStreamObserver()
      const protocol = {
        commitTransaction: jest.fn(() => observer)
      }
      const connection = spyOnConnectionChannel({ protocolSupplier: () => protocol })

      const config = {
        beforeError: () => console.log('my error'),
        afterComplete: (metadata) => console.log('metadata', metadata)
      }

      const result = connection.commitTransaction(config)

      expect(result).toBe(observer)
      expect(protocol.commitTransaction).toBeCalledWith(config)
    })
  })

  describe('.rollbackTransaction()', () => {
    it('should call redirect the request to the protocol', () => {
      const observer = new ResultStreamObserver()
      const protocol = {
        rollbackTransaction: jest.fn(() => observer)
      }
      const connection = spyOnConnectionChannel({ protocolSupplier: () => protocol })

      const config = {
        beforeError: () => console.log('my error'),
        afterComplete: (metadata) => console.log('metadata', metadata)
      }

      const result = connection.rollbackTransaction(config)

      expect(result).toBe(observer)
      expect(protocol.rollbackTransaction).toBeCalledWith(config)
    })
  })

  describe('.isOpen()', () => {
    it('should return true when is not broken and channel is open', () => {
      const connection = spyOnConnectionChannel({ protocolSupplier: () => ({}), channel: { _open: true } })

      expect(connection.isOpen()).toBe(true)
    })

    it('should return true when is not broken and channel not is open', () => {
      const connection = spyOnConnectionChannel({ protocolSupplier: () => ({}), channel: { _open: false } })

      expect(connection.isOpen()).toBe(false)
    })

    it('should return true when is broken and channel not is open', () => {
      const connection = spyOnConnectionChannel({
        protocolSupplier: () => ({
          notifyFatalError: () => {}
        }),
        channel: { _open: false }
      })

      connection._handleFatalError(new Error('the error which makes the connection be broken.'))

      expect(connection.isOpen()).toBe(false)
    })

    it('should return true when is broken and channel is open', () => {
      const connection = spyOnConnectionChannel({
        protocolSupplier: () => ({
          notifyFatalError: () => {}
        }),
        channel: { _open: true }
      })

      connection._handleFatalError(new Error('the error which makes the connection be broken.'))

      expect(connection.isOpen()).toBe(false)
    })
  })

  describe('.getProtocolVersion()', () => {
    it('should call redirect request to the protocol', () => {
      const version = 5.3
      const getVersion = jest.fn(() => version)
      const protocol = {
        get version () {
          return getVersion()
        }
      }

      const connection = spyOnConnectionChannel({ protocolSupplier: () => protocol })

      const result = connection.getProtocolVersion()

      expect(result).toBe(version)
      expect(getVersion).toBeCalledWith()
    })
  })

  describe('.hasOngoingObservableRequests()', () => {
    it('should call redirect request to the protocol', () => {
      const protocol = {
        hasOngoingObservableRequests: jest.fn(() => true)
      }

      const connection = spyOnConnectionChannel({ protocolSupplier: () => protocol })

      const result = connection.hasOngoingObservableRequests()

      expect(result).toBe(true)
      expect(protocol.hasOngoingObservableRequests).toBeCalledWith()
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
    notificationFilter,
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
      notificationFilter,
      protocolSupplier
    )
  }
})

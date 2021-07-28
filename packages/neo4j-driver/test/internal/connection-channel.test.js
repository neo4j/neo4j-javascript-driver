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

import DummyChannel from './dummy-channel'
import ChannelConnection, {
  createChannelConnection
} from '../../../bolt-connection/lib/connection/connection-channel'
import { Packer } from '../../../bolt-connection/lib/packstream/packstream-v1'
import { Chunker } from '../../../bolt-connection/lib/channel/chunking'
import { alloc } from '../../../bolt-connection/lib/channel'
import { Neo4jError, newError, error, internal } from 'neo4j-driver-core'
import sharedNeo4j from '../internal/shared-neo4j'
import { ServerVersion } from '../../src/internal/server-version'
import lolex from 'lolex'
import ConnectionErrorHandler from '../../../bolt-connection/lib/connection/connection-error-handler'
import testUtils from '../internal/test-utils'
import { WRITE } from '../../src/driver'
import { ResultStreamObserver } from '../../../bolt-connection/lib/bolt'

const {
  logger: { Logger },
  bookmark: { Bookmark },
  txConfig: { TxConfig },
  serverAddress: { ServerAddress }
} = internal

const { SERVICE_UNAVAILABLE } = error

const ILLEGAL_MESSAGE = { signature: 42, fields: [] }
const SUCCESS_MESSAGE = { signature: 0x70, fields: [{}] }
const FAILURE_MESSAGE = { signature: 0x7f, fields: [newError('Hello')] }
const RECORD_MESSAGE = { signature: 0x71, fields: [{ value: 'Hello' }] }

describe('#integration ChannelConnection', () => {
  /** @type {Connection} */
  let connection

  afterEach(async () => {
    const usedConnection = connection
    connection = null
    if (usedConnection) {
      await usedConnection.close()
    }
  })

  it('should have correct creation timestamp', async () => {
    const clock = lolex.install()
    try {
      clock.setSystemTime(424242)

      connection = await createConnection(`bolt://${sharedNeo4j.hostname}`)

      expect(connection.creationTimestamp).toEqual(424242)
    } finally {
      clock.uninstall()
    }
  })

  it('should read/write basic messages', done => {
    createConnection(`bolt://${sharedNeo4j.hostname}`)
      .then(connection => {
        connection.protocol().initialize({
          userAgent: 'mydriver/0.0.0',
          authToken: basicAuthToken(),
          onComplete: metadata => {
            expect(metadata).not.toBeNull()
            done()
          },
          onError: done.fail.bind(done)
        })
      })
      .catch(done.fail.bind(done))
  })

  it('should retrieve stream', async done => {
    connection = await createConnection(`bolt://${sharedNeo4j.hostname}`)

    const records = []
    const pullAllObserver = {
      onNext: record => {
        records.push(record)
      },
      onCompleted: () => {
        expect(records[0].get(0)).toBe(1)
        done()
      },
      onError: done.fail.bind(done)
    }

    connection
      .connect('mydriver/0.0.0', basicAuthToken())
      .then(() => {
        connection
          .protocol()
          .run(
            'RETURN 1.0',
            {},
            {
              bookmark: Bookmark.empty(),
              txConfig: TxConfig.empty(),
              mode: WRITE
            }
          )
          .subscribe(pullAllObserver)
      })
      .catch(done.fail.bind(done))
  })

  it('should provide error message when connecting to http-port', async done => {
    await createConnection(`bolt://${sharedNeo4j.hostname}:7474`, {
      encrypted: false
    })
      .then(done.fail.bind(done))
      .catch(error => {
        expect(error).toBeDefined()
        expect(error).not.toBeNull()

        if (testUtils.isServer()) {
          // only node gets the pretty error message
          expect(error.message).toBe(
            'Server responded HTTP. Make sure you are not trying to connect to the http endpoint ' +
              '(HTTP defaults to port 7474 whereas BOLT defaults to port 7687)'
          )
        }
        done()
      })
  })

  it('should convert failure messages to errors', done => {
    const channel = new DummyChannel()
    const errorCode = 'Neo.ClientError.Schema.ConstraintValidationFailed'
    const errorMessage =
      'Node 0 already exists with label User and property "email"=[john@doe.com]'

    createChannelConnection(
      ServerAddress.fromUrl('localhost:7687'),
      {},
      new ConnectionErrorHandler(SERVICE_UNAVAILABLE),
      Logger.noOp(),
      null,
      () => channel
    )
      .then(c => {
        connection = c
        connection._queueObserver({
          onCompleted: done.fail.bind(done),
          onComplete: done.fail.bind(done),
          onError: error => {
            expectNeo4jError(error, errorCode, errorMessage)
            done()
          }
        })
        channel.onmessage(packedFailureMessage(errorCode, errorMessage))
      })
      .catch(done.fail.bind(done))

    channel.onmessage(packedHandshakeMessage())
  })

  it('should notify when connection initialization completes', async done => {
    connection = await createConnection(`bolt://${sharedNeo4j.hostname}`)

    connection
      .connect('mydriver/0.0.0', basicAuthToken())
      .then(initializedConnection => {
        expect(initializedConnection).toBe(connection)
        done()
      })
      .catch(done.fail.bind(done))
  })

  it('should notify when connection initialization fails', async done => {
    connection = await createConnection(`bolt://${sharedNeo4j.hostname}`) // wrong port

    connection
      .connect('mydriver/0.0.0', basicWrongAuthToken())
      .then(() => done.fail('Should not initialize'))
      .catch(error => {
        expect(error).toBeDefined()
        done()
      })
  })

  it('should have server version after connection initialization completed', async done => {
    connection = await createConnection(`bolt://${sharedNeo4j.hostname}`)
    connection
      .connect('mydriver/0.0.0', basicAuthToken())
      .then(initializedConnection => {
        expect(initializedConnection).toBe(connection)
        const serverVersion = ServerVersion.fromString(connection.version)
        expect(serverVersion).toBeDefined()
        done()
      })
      .catch(done.fail.bind(done))
  })

  it('should fail all new observers after failure to connect', async done => {
    connection = await createConnection(`bolt://${sharedNeo4j.hostname}`)

    connection
      .connect('mydriver/0.0.0', basicWrongAuthToken())
      .then(() => done.fail('Should not connect'))
      .catch(initialError => {
        expect(initialError).toBeDefined()
        expect(initialError).not.toBeNull()

        expect(connection.isOpen()).toBeFalsy()

        const streamObserver = new ResultStreamObserver()
        streamObserver.subscribe({
          onError: error => {
            expect(error).toEqual(initialError)
            done()
          }
        })
        connection._queueObserver(streamObserver)
      })
  })

  it('should respect connection timeout', async () => {
    await testConnectionTimeout(false)
  })

  it('should respect encrypted connection timeout', async () => {
    await testConnectionTimeout(true)
  })

  it('should not queue INIT observer when broken', done => {
    testQueueingOfObserversWithBrokenConnection(
      connection =>
        connection.protocol().initialize({ userAgent: 'Hello', authToken: {} }),
      done
    )
  })

  it('should not queue RUN observer when broken', done => {
    testQueueingOfObserversWithBrokenConnection(
      connection =>
        connection
          .protocol()
          .run(
            'RETURN 1',
            {},
            { bookmark: Bookmark.empty(), txConfig: TxConfig.empty() }
          ),
      done
    )
  })

  it('should not queue RESET observer when broken', done => {
    const resetAction = connection =>
      connection.resetAndFlush().catch(ignore => {})

    testQueueingOfObserversWithBrokenConnection(resetAction, done)
  })

  it('should reset and flush when SUCCESS received', async done => {
    connection = await createConnection(`bolt://${sharedNeo4j.hostname}`)

    connection
      .connect('my-driver/1.2.3', basicAuthToken())
      .then(() => {
        connection
          .resetAndFlush()
          .then(() => {
            expect(connection.isOpen()).toBeTruthy()
            done()
          })
          .catch(error => done.fail(error))

        // write a SUCCESS message for RESET before the actual response is received
        connection.protocol()._responseHandler.handleResponse(SUCCESS_MESSAGE)
        // enqueue a dummy observer to handle the real SUCCESS message
        connection.protocol()._responseHandler._queueObserver({
          onCompleted: () => {}
        })
      })
      .catch(done.fail.bind(done))
  })

  it('should fail to reset and flush when FAILURE received', async done => {
    createConnection(`bolt://${sharedNeo4j.hostname}`)
      .then(connection => {
        connection.connect('my-driver/1.2.3', basicAuthToken()).then(() => {
          connection
            .resetAndFlush()
            .then(() => done.fail('Should fail'))
            .catch(error => {
              expect(error.message).toEqual(
                'Received FAILURE as a response for RESET: Neo4jError: Hello'
              )
              expect(connection._isBroken).toBeTruthy()
              expect(connection.isOpen()).toBeFalsy()
              done()
            })

          // write a FAILURE message for RESET before the actual response is received / white box test
          connection.protocol()._responseHandler.handleResponse(FAILURE_MESSAGE)
          // enqueue a dummy observer to handle the real SUCCESS message
          connection.protocol()._responseHandler._queueObserver({
            onCompleted: () => {}
          })
        })
      })
      .catch(done.fail.bind(done))
  })

  it('should fail to reset and flush when RECORD received', async done => {
    connection = await createConnection(`bolt://${sharedNeo4j.hostname}`)

    connection
      .connect('my-driver/1.2.3', basicAuthToken())
      .then(() => {
        connection
          .resetAndFlush()
          .then(() => done.fail('Should fail'))
          .catch(error => {
            expect(error.message).toEqual(
              'Received RECORD when resetting: received record is: {"value":"Hello"}'
            )
            expect(connection._isBroken).toBeTruthy()
            expect(connection.isOpen()).toBeFalsy()
            done()
          })

        // write a RECORD message for RESET before the actual response is received
        connection.protocol()._responseHandler.handleResponse(RECORD_MESSAGE)
        // enqueue a dummy observer to handle the real SUCCESS message
        connection.protocol()._responseHandler._queueObserver({
          onCompleted: () => {}
        })
      })
      .catch(done.fail.bind(done))
  })

  it('should acknowledge failure with RESET when SUCCESS received', async done => {
    createConnection(`bolt://${sharedNeo4j.hostname}`)
      .then(connection => {
        connection
          .connect('my-driver/1.2.3', basicAuthToken())
          .then(() => {
            connection.protocol()._responseHandler._currentFailure = newError(
              'Hello'
            ) // white box test, not ideal
            connection._resetOnFailure()

            // write a SUCCESS message for RESET before the actual response is received
            connection
              .protocol()
              ._responseHandler.handleResponse(SUCCESS_MESSAGE)
            // enqueue a dummy observer to handle the real SUCCESS message
            connection.protocol()._responseHandler._queueObserver({
              onCompleted: () => {}
            })

            expect(
              connection.protocol()._responseHandler._currentFailure
            ).toBeNull()
            done()
          })
          .catch(done.fail.bind(done))
      })
      .catch(done.fail.bind(done))
  })

  it('should handle and transform fatal errors', done => {
    const errors = []
    const addresses = []
    const transformedError = newError('Message', 'Code')
    const errorHandler = new ConnectionErrorHandler(
      SERVICE_UNAVAILABLE,
      (error, address) => {
        errors.push(error)
        addresses.push(address)
        return transformedError
      }
    )

    createChannelConnection(
      ServerAddress.fromUrl(`bolt://${sharedNeo4j.hostname}`),
      {},
      errorHandler,
      Logger.noOp()
    )
      .then(c => {
        connection = c
        connection._queueObserver({
          onError: error => {
            expect(error).toEqual(transformedError)
            expect(errors.length).toEqual(1)
            expect(errors[0].code).toEqual(SERVICE_UNAVAILABLE)
            expect(addresses).toEqual([connection.address])
            done()
          }
        })
        connection._handleFatalError(newError('Hello', SERVICE_UNAVAILABLE))
      })
      .catch(done.fail.bind(done))
  })

  it('should send INIT/HELLO and GOODBYE messages', async () => {
    const messages = []
    connection = await createConnection(`bolt://${sharedNeo4j.hostname}`)
    recordWrittenMessages(connection._protocol, messages)

    await connection.connect('mydriver/0.0.0', basicAuthToken())

    expect(connection.isOpen()).toBeTruthy()
    await connection.close()

    expect(messages.length).toBeGreaterThan(0)
    expect(messages[0].signature).toEqual(0x01) // first message is either INIT or HELLO

    const protocolVersion = connection.protocol().version
    if (protocolVersion >= 3) {
      expect(messages[messages.length - 1].signature).toEqual(0x02) // last message is GOODBYE in V3
    }
  })

  it('should not prepare broken connection to close', async () => {
    connection = await createConnection(`bolt://${sharedNeo4j.hostname}`)

    await connection.connect('my-connection/9.9.9', basicAuthToken())
    expect(connection._protocol).toBeDefined()
    expect(connection._protocol).not.toBeNull()

    // make connection seem broken
    connection._isBroken = true
    expect(connection.isOpen()).toBeFalsy()

    connection._protocol.prepareToClose = () => {
      throw new Error('Not supposed to be called')
    }

    await connection.close()
  })

  function packedHandshakeMessage () {
    const result = alloc(4)
    result.putInt32(0, 1)
    result.reset()
    return result
  }

  function packedFailureMessage (code, message) {
    const channel = new DummyChannel()
    const chunker = new Chunker(channel)
    const packer = new Packer(chunker)
    packer.packStruct(0x7f, [packer.packable({ code: code, message: message })])
    chunker.messageBoundary()
    chunker.flush()
    const data = channel.toBuffer()
    const result = alloc(data.length)
    result.putBytes(0, data)
    return result
  }

  function expectNeo4jError (error, expectedCode, expectedMessage) {
    expect(() => {
      throw error
    }).toThrow(new Neo4jError(expectedMessage, expectedCode))
    expect(error.name).toBe('Neo4jError')
  }

  function basicAuthToken () {
    return {
      scheme: 'basic',
      principal: sharedNeo4j.username,
      credentials: sharedNeo4j.password
    }
  }

  function basicWrongAuthToken () {
    return {
      scheme: 'basic',
      principal: sharedNeo4j.username + 'a',
      credentials: sharedNeo4j.password + 'b'
    }
  }

  async function testConnectionTimeout (encrypted) {
    const clock = jasmine.clock()
    clock.install()

    try {
      const boltUri = 'bolt://10.0.0.0' // use non-routable IP address which never responds
      setImmediate(() => clock.tick(1001))
      connection = await createConnection(
        boltUri,
        { encrypted: encrypted, connectionTimeout: 1000 },
        'TestErrorCode'
      )
    } catch (error) {
      expect(error.code).toEqual('TestErrorCode')

      // in some environments non-routable address results in immediate 'connection refused' error and connect
      // timeout is not fired; skip message assertion for such cases, it is important for connect attempt to not hang
      if (error.message.indexOf('Failed to establish connection') === 0) {
        expect(error.message).toEqual(
          'Failed to establish connection in 1000ms'
        )
      }

      return
    } finally {
      clock.uninstall()
    }

    expect(false).toBeTruthy('exception expected')
  }

  function testQueueingOfObserversWithBrokenConnection (connectionAction, done) {
    createConnection(`bolt://${sharedNeo4j.hostname}`)
      .then(connection => {
        connection._handleProtocolError(ILLEGAL_MESSAGE)
        expect(connection.isOpen()).toBeFalsy()

        expect(connection.hasOngoingObservableRequests()).toBeFalsy()
        connectionAction(connection)
        expect(connection.hasOngoingObservableRequests()).toBeFalsy()

        done()
      })
      .catch(done.fail.bind(done))
  }

  /**
   * @return {Promise<Connection>}
   */
  function createConnection (
    url,
    config,
    errorCode = null,
    logger = createVerifyConnectionIdLogger()
  ) {
    const _config = config || {}
    connection = undefined
    return createChannelConnection(
      ServerAddress.fromUrl(url),
      _config,
      new ConnectionErrorHandler(errorCode || SERVICE_UNAVAILABLE),
      logger
    ).then(c => {
      connection = c
      return connection
    })
  }

  function recordWrittenMessages (connection, messages) {
    const originalWrite = connection.write.bind(connection)
    connection.write = (message, observer, flush) => {
      messages.push(message)
      originalWrite(message, observer, flush)
    }
  }

  function createVerifyConnectionIdLogger () {
    return new Logger('debug', (_, message) => {
      if (!connection) {
        // the connection is not the context, so we could
        // only assert if it starts with Connection [
        expect(
          message.startsWith('Connection ['),
          `Log message "${message}" should starts with "Connection ["`
        ).toBe(true)
        return
      }
      expect(
        message.startsWith(`${connection}`),
        `Log message "${message}" should starts with "${connection}"`
      ).toBe(true)
    })
  }
})

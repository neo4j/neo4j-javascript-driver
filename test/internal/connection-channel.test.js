/**
 * Copyright (c) 2002-2020 "Neo4j,"
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
import ChannelConnection from '../../src/internal/connection-channel'
import { Packer } from '../../src/internal/packstream-v1'
import { Chunker } from '../../src/internal/chunking'
import { alloc } from '../../src/internal/node'
import { Neo4jError, newError, SERVICE_UNAVAILABLE } from '../../src/error'
import sharedNeo4j from '../internal/shared-neo4j'
import { ServerVersion } from '../../src/internal/server-version'
import lolex from 'lolex'
import Logger from '../../src/internal/logger'
import ConnectionErrorHandler from '../../src/internal/connection-error-handler'
import testUtils from '../internal/test-utils'
import Bookmark from '../../src/internal/bookmark'
import TxConfig from '../../src/internal/tx-config'
import { WRITE } from '../../src/driver'
import ServerAddress from '../../src/internal/server-address'
import { ResultStreamObserver } from '../../src/internal/stream-observers'

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

  it('should have correct creation timestamp', () => {
    const clock = lolex.install()
    try {
      clock.setSystemTime(424242)

      connection = createConnection('bolt://localhost')

      expect(connection.creationTimestamp).toEqual(424242)
    } finally {
      clock.uninstall()
    }
  })

  it('should read/write basic messages', done => {
    connection = createConnection('bolt://localhost')

    connection._negotiateProtocol().then(() => {
      connection.protocol().initialize({
        userAgent: 'mydriver/0.0.0',
        authToken: basicAuthToken(),
        onComplete: metadata => {
          expect(metadata).not.toBeNull()
          done()
        },
        onError: console.log
      })
    })
  })

  it('should retrieve stream', done => {
    connection = createConnection('bolt://localhost')

    const records = []
    const pullAllObserver = {
      onNext: record => {
        records.push(record)
      },
      onCompleted: () => {
        expect(records[0].get(0)).toBe(1)
        done()
      }
    }

    connection.connect('mydriver/0.0.0', basicAuthToken()).then(() => {
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
  })

  it('should write protocol handshake', () => {
    const channel = new DummyChannel()
    connection = new ChannelConnection(
      channel,
      new ConnectionErrorHandler(SERVICE_UNAVAILABLE),
      ServerAddress.fromUrl('localhost:7687'),
      Logger.noOp()
    )

    connection._negotiateProtocol()

    const boltMagicPreamble = '60 60 b0 17'
    const protocolVersion4 = '00 00 00 04'
    const protocolVersion3 = '00 00 00 03'
    const protocolVersion2 = '00 00 00 02'
    const protocolVersion1 = '00 00 00 01'
    expect(channel.toHex()).toBe(
      `${boltMagicPreamble} ${protocolVersion4} ${protocolVersion3} ${protocolVersion2} ${protocolVersion1}`
    )
  })

  it('should provide error message when connecting to http-port', done => {
    connection = createConnection('bolt://localhost:7474', { encrypted: false })

    connection.connect('mydriver/0.0.0', basicAuthToken()).catch(error => {
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
    connection = new ChannelConnection(
      channel,
      new ConnectionErrorHandler(SERVICE_UNAVAILABLE),
      ServerAddress.fromUrl('localhost:7687'),
      Logger.noOp()
    )

    connection._negotiateProtocol()

    const errorCode = 'Neo.ClientError.Schema.ConstraintValidationFailed'
    const errorMessage =
      'Node 0 already exists with label User and property "email"=[john@doe.com]'

    connection._queueObserver({
      onError: error => {
        expectNeo4jError(error, errorCode, errorMessage)
        done()
      }
    })

    channel.onmessage(packedHandshakeMessage())
    channel.onmessage(packedFailureMessage(errorCode, errorMessage))
  })

  it('should notify when connection initialization completes', done => {
    connection = createConnection('bolt://localhost')

    connection
      .connect('mydriver/0.0.0', basicAuthToken())
      .then(initializedConnection => {
        expect(initializedConnection).toBe(connection)
        done()
      })
  })

  it('should notify when connection initialization fails', done => {
    connection = createConnection('bolt://localhost:7474') // wrong port

    connection
      .connect('mydriver/0.0.0', basicAuthToken())
      .then(() => done.fail('Should not initialize'))
      .catch(error => {
        expect(error).toBeDefined()
        done()
      })
  })

  it('should have server version after connection initialization completed', done => {
    connection = createConnection('bolt://localhost')

    connection
      .connect('mydriver/0.0.0', basicAuthToken())
      .then(initializedConnection => {
        expect(initializedConnection).toBe(connection)
        const serverVersion = ServerVersion.fromString(connection.version)
        expect(serverVersion).toBeDefined()
        done()
      })
  })

  it('should fail all new observers after failure to connect', done => {
    connection = createConnection('bolt://localhost:7474') // wrong port

    connection
      .connect('mydriver/0.0.0', basicAuthToken())
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

  it('should reset and flush when SUCCESS received', done => {
    connection = createConnection('bolt://localhost')

    connection.connect('my-driver/1.2.3', basicAuthToken()).then(() => {
      connection
        .resetAndFlush()
        .then(() => {
          expect(connection.isOpen()).toBeTruthy()
          done()
        })
        .catch(error => done.fail(error))

      // write a SUCCESS message for RESET before the actual response is received
      connection._handleMessage(SUCCESS_MESSAGE)
      // enqueue a dummy observer to handle the real SUCCESS message
      connection._queueObserver({
        onCompleted: () => {}
      })
    })
  })

  it('should fail to reset and flush when FAILURE received', done => {
    connection = createConnection('bolt://localhost')

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

      // write a FAILURE message for RESET before the actual response is received
      connection._handleMessage(FAILURE_MESSAGE)
      // enqueue a dummy observer to handle the real SUCCESS message
      connection._queueObserver({
        onCompleted: () => {}
      })
    })
  })

  it('should fail to reset and flush when RECORD received', done => {
    connection = createConnection('bolt://localhost')

    connection.connect('my-driver/1.2.3', basicAuthToken()).then(() => {
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
      connection._handleMessage(RECORD_MESSAGE)
      // enqueue a dummy observer to handle the real SUCCESS message
      connection._queueObserver({
        onCompleted: () => {}
      })
    })
  })

  it('should acknowledge failure with RESET when SUCCESS received', done => {
    connection = createConnection('bolt://localhost')

    connection.connect('my-driver/1.2.3', basicAuthToken()).then(() => {
      connection._currentFailure = newError('Hello')
      connection._resetOnFailure()

      // write a SUCCESS message for RESET before the actual response is received
      connection._handleMessage(SUCCESS_MESSAGE)
      // enqueue a dummy observer to handle the real SUCCESS message
      connection._queueObserver({
        onCompleted: () => {}
      })

      expect(connection._currentFailure).toBeNull()
      done()
    })
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

    connection = ChannelConnection.create(
      ServerAddress.fromUrl('bolt://localhost'),
      {},
      errorHandler,
      Logger.noOp()
    )

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

  it('should send INIT/HELLO and GOODBYE messages', async () => {
    const messages = []
    connection = createConnection('bolt://localhost')
    recordWrittenMessages(connection, messages)

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
    connection = createConnection('bolt://localhost')

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

  async function testConnectionTimeout (encrypted) {
    const clock = jasmine.clock()
    clock.install()

    try {
      const boltUri = 'bolt://10.0.0.0' // use non-routable IP address which never responds
      connection = createConnection(
        boltUri,
        { encrypted: encrypted, connectionTimeout: 1000 },
        'TestErrorCode'
      )

      clock.tick(1001)

      await connection.connect('mydriver/0.0.0', basicAuthToken())
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
    connection = createConnection('bolt://localhost')

    connection._negotiateProtocol().then(() => {
      connection._handleMessage(ILLEGAL_MESSAGE)
      expect(connection.isOpen()).toBeFalsy()

      expect(connection._pendingObservers.length).toEqual(0)
      connectionAction(connection)
      expect(connection._pendingObservers.length).toEqual(0)

      done()
    })
  }

  /**
   * @return {Connection}
   */
  function createConnection (url, config, errorCode = null) {
    return ChannelConnection.create(
      ServerAddress.fromUrl(url),
      config || {},
      new ConnectionErrorHandler(errorCode || SERVICE_UNAVAILABLE),
      Logger.noOp()
    )
  }

  function recordWrittenMessages (connection, messages) {
    const originalWrite = connection.write.bind(connection)
    connection.write = (message, observer, flush) => {
      messages.push(message)
      originalWrite(message, observer, flush)
    }
  }
})

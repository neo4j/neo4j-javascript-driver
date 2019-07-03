/**
 * Copyright (c) 2002-2019 "Neo4j,"
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

import ConnectionHolder, {
  EMPTY_CONNECTION_HOLDER
} from '../../src/internal/connection-holder'
import { SingleConnectionProvider } from '../../src/internal/connection-providers'
import { READ, WRITE } from '../../src/driver'
import FakeConnection from './fake-connection'
import StreamObserver from '../../src/internal/stream-observer'

describe('EmptyConnectionHolder', () => {
  it('should return rejected promise instead of connection', done => {
    EMPTY_CONNECTION_HOLDER.getConnection(new StreamObserver()).catch(() => {
      done()
    })
  })

  it('should return resolved promise on release', done => {
    EMPTY_CONNECTION_HOLDER.releaseConnection().then(() => {
      done()
    })
  })

  it('should return resolved promise on close', done => {
    EMPTY_CONNECTION_HOLDER.close().then(() => {
      done()
    })
  })
})

describe('ConnectionHolder', () => {
  it('should acquire new connection during initialization', () => {
    const connectionProvider = new RecordingConnectionProvider([
      new FakeConnection()
    ])
    const connectionHolder = new ConnectionHolder({
      mode: READ,
      connectionProvider
    })

    connectionHolder.initializeConnection()

    expect(connectionProvider.acquireConnectionInvoked).toBe(1)
  })

  it('should return acquired during initialization connection', done => {
    const connection = new FakeConnection()
    const connectionProvider = newSingleConnectionProvider(connection)
    const connectionHolder = new ConnectionHolder({
      mode: READ,
      connectionProvider
    })

    connectionHolder.initializeConnection()

    connectionHolder.getConnection(new StreamObserver()).then(conn => {
      expect(conn).toBe(connection)
      done()
    })
  })

  it('should make stream observer aware about connection when initialization successful', done => {
    const connection = new FakeConnection().withServerVersion('Neo4j/9.9.9')
    const connectionProvider = newSingleConnectionProvider(connection)
    const connectionHolder = new ConnectionHolder({
      mode: READ,
      connectionProvider
    })
    const streamObserver = new StreamObserver()

    connectionHolder.initializeConnection()

    connectionHolder.getConnection(streamObserver).then(conn => {
      verifyConnection(streamObserver, 'Neo4j/9.9.9')
      done()
    })
  })

  it('should propagate connection acquisition failure', done => {
    const errorMessage = 'Failed to acquire or initialize the connection'
    const connectionPromise = Promise.reject(new Error(errorMessage))
    const connectionProvider = newSingleConnectionProvider(connectionPromise)
    const connectionHolder = new ConnectionHolder({
      mode: READ,
      connectionProvider
    })
    const streamObserver = new StreamObserver()

    connectionHolder.initializeConnection()

    connectionHolder.getConnection(streamObserver).catch(error => {
      expect(error.message).toEqual(errorMessage)
      done()
    })
  })

  it('should release connection with single user', done => {
    const connection = new FakeConnection()
    const connectionProvider = newSingleConnectionProvider(connection)
    const connectionHolder = new ConnectionHolder({
      mode: READ,
      connectionProvider
    })

    connectionHolder.initializeConnection()

    connectionHolder.releaseConnection().then(() => {
      expect(connection.isReleasedOnce()).toBeTruthy()
      done()
    })
  })

  it('should not release connection with multiple users', done => {
    const connection = new FakeConnection()
    const connectionProvider = newSingleConnectionProvider(connection)
    const connectionHolder = new ConnectionHolder({
      mode: READ,
      connectionProvider
    })

    connectionHolder.initializeConnection()
    connectionHolder.initializeConnection()
    connectionHolder.initializeConnection()

    connectionHolder.releaseConnection().then(() => {
      expect(connection.isNeverReleased()).toBeTruthy()
      done()
    })
  })

  it('should release connection with multiple users when all users release', done => {
    const connection = new FakeConnection()
    const connectionProvider = newSingleConnectionProvider(connection)
    const connectionHolder = new ConnectionHolder({
      mode: READ,
      connectionProvider
    })

    connectionHolder.initializeConnection()
    connectionHolder.initializeConnection()
    connectionHolder.initializeConnection()

    connectionHolder.releaseConnection().then(() => {
      connectionHolder.releaseConnection().then(() => {
        connectionHolder.releaseConnection().then(() => {
          expect(connection.isReleasedOnce()).toBeTruthy()
          done()
        })
      })
    })
  })

  it('should do nothing when closed and not initialized', done => {
    const connection = new FakeConnection()
    const connectionProvider = newSingleConnectionProvider(connection)
    const connectionHolder = new ConnectionHolder({
      mode: READ,
      connectionProvider
    })

    connectionHolder.close().then(() => {
      expect(connection.isNeverReleased()).toBeTruthy()
      done()
    })
  })

  it('should close even when users exist', done => {
    const connection = new FakeConnection()
    const connectionProvider = newSingleConnectionProvider(connection)
    const connectionHolder = new ConnectionHolder({
      mode: READ,
      connectionProvider
    })

    connectionHolder.initializeConnection()
    connectionHolder.initializeConnection()

    connectionHolder.close().then(() => {
      expect(connection.isReleasedOnce()).toBeTruthy()
      done()
    })
  })

  it('should initialize new connection after releasing current one', done => {
    const connection1 = new FakeConnection()
    const connection2 = new FakeConnection()
    const connectionProvider = new RecordingConnectionProvider([
      connection1,
      connection2
    ])
    const connectionHolder = new ConnectionHolder({
      mode: READ,
      connectionProvider
    })

    connectionHolder.initializeConnection()

    connectionHolder.releaseConnection().then(() => {
      expect(connection1.isReleasedOnce()).toBeTruthy()

      connectionHolder.initializeConnection()
      connectionHolder.releaseConnection().then(() => {
        expect(connection2.isReleasedOnce()).toBeTruthy()
        done()
      })
    })
  })

  it('should initialize new connection after being closed', done => {
    const connection1 = new FakeConnection()
    const connection2 = new FakeConnection()
    const connectionProvider = new RecordingConnectionProvider([
      connection1,
      connection2
    ])
    const connectionHolder = new ConnectionHolder({
      mode: READ,
      connectionProvider
    })

    connectionHolder.initializeConnection()

    connectionHolder.close().then(() => {
      expect(connection1.isReleasedOnce()).toBeTruthy()

      connectionHolder.initializeConnection()
      connectionHolder.close().then(() => {
        expect(connection2.isReleasedOnce()).toBeTruthy()
        done()
      })
    })
  })

  it('should return passed mode', () => {
    function verifyMode (connectionProvider, mode) {
      expect(connectionProvider.mode()).toBe(mode)
    }

    verifyMode(new ConnectionHolder(), WRITE)
    verifyMode(new ConnectionHolder({ mode: WRITE }), WRITE)
    verifyMode(new ConnectionHolder({ mode: READ }), READ)
  })

  it('should default to empty database', () => {
    function verifyDefault (connectionProvider) {
      expect(connectionProvider.database()).toBe('')
    }

    const connectionProvider = newSingleConnectionProvider(new FakeConnection())

    verifyDefault(new ConnectionHolder())
    verifyDefault(new ConnectionHolder({ mode: READ, connectionProvider }))
    verifyDefault(new ConnectionHolder({ mode: WRITE, connectionProvider }))
    verifyDefault(
      new ConnectionHolder({ mode: WRITE, database: '', connectionProvider })
    )
    verifyDefault(
      new ConnectionHolder({ mode: WRITE, database: null, connectionProvider })
    )
    verifyDefault(
      new ConnectionHolder({
        mode: WRITE,
        database: undefined,
        connectionProvider
      })
    )
  })

  it('should return passed database', () => {
    const connectionProvider = newSingleConnectionProvider(new FakeConnection())
    const connectionHolder = new ConnectionHolder({
      database: 'testdb',
      connectionProvider
    })

    expect(connectionHolder.database()).toBe('testdb')
  })
})

class RecordingConnectionProvider extends SingleConnectionProvider {
  constructor (connections) {
    super(Promise.resolve())
    this.connectionPromises = connections.map(conn => Promise.resolve(conn))
    this.acquireConnectionInvoked = 0
  }

  acquireConnection (mode, database) {
    return this.connectionPromises[this.acquireConnectionInvoked++]
  }
}

function newSingleConnectionProvider (connection) {
  return new SingleConnectionProvider(Promise.resolve(connection))
}

function verifyConnection (streamObserver, expectedServerVersion) {
  expect(streamObserver._conn).toBeDefined()
  expect(streamObserver._conn).not.toBeNull()

  // server version is taken from connection, verify it as well
  const metadata = streamObserver.serverMetadata()
  expect(metadata.server.version).toEqual(expectedServerVersion)
}

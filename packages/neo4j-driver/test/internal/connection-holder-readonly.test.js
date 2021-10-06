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

import SingleConnectionProvider from '../../../bolt-connection/lib/connection-provider/connection-provider-single'
import { READ, WRITE } from '../../src/driver'
import FakeConnection from './fake-connection'
import Connection from '../../../bolt-connection/lib/connection/connection'
import { internal } from 'neo4j-driver-core'

const {
  connectionHolder: {
    EMPTY_CONNECTION_HOLDER,
    ReadOnlyConnectionHolder,
    ConnectionHolder
  }
} = internal

describe('#unit ReadOnlyConnectionHolder wrapping EmptyConnectionHolder', () => {
  it('should return rejected promise instead of connection', done => {
    EMPTY_CONNECTION_HOLDER.getConnection().catch(() => {
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

describe('#unit ReadOnlyConnectionHolder wrapping ConnectionHolder', () => {
  it('should return connection promise', done => {
    const connection = new FakeConnection()
    const connectionProvider = newSingleConnectionProvider(connection)
    const connectionHolder = newConnectionHolder(
      {
        mode: READ,
        connectionProvider
      },
      connectionHolder => connectionHolder.initializeConnection()
    )

    connectionHolder.getConnection().then(conn => {
      expect(conn).toBe(connection)
      done()
    })
  })

  it('should return connection promise with version', done => {
    const connection = new FakeConnection().withServerVersion('Neo4j/9.9.9')
    const connectionProvider = newSingleConnectionProvider(connection)
    const connectionHolder = newConnectionHolder(
      {
        mode: READ,
        connectionProvider
      },
      connectionHolder => connectionHolder.initializeConnection()
    )

    connectionHolder.getConnection().then(conn => {
      verifyConnection(conn, 'Neo4j/9.9.9')
      done()
    })
  })

  it('should propagate connection acquisition failure', done => {
    const errorMessage = 'Failed to acquire or initialize the connection'
    const connectionPromise = Promise.reject(new Error(errorMessage))
    const connectionProvider = newSingleConnectionProvider(connectionPromise)
    const connectionHolder = newConnectionHolder(
      {
        mode: READ,
        connectionProvider
      },
      connectionHolder => connectionHolder.initializeConnection()
    )

    connectionHolder.getConnection().catch(error => {
      expect(error.message).toEqual(errorMessage)
      done()
    })
  })

  it('should release not connection with single user', done => {
    const connection = new FakeConnection()
    const connectionProvider = newSingleConnectionProvider(connection)
    const connectionHolder = newConnectionHolder(
      {
        mode: READ,
        connectionProvider
      },
      connectionHolder => connectionHolder.initializeConnection()
    )

    connectionHolder.releaseConnection().then(() => {
      expect(connection.isNeverReleased()).toBeTruthy()
      done()
    })
  })

  it('should not release connection with multiple users', done => {
    const connection = new FakeConnection()
    const connectionProvider = newSingleConnectionProvider(connection)
    const connectionHolder = newConnectionHolder(
      {
        mode: READ,
        connectionProvider
      },
      connectionHolder => {
        connectionHolder.initializeConnection()
        connectionHolder.initializeConnection()
        connectionHolder.initializeConnection()
      }
    )

    connectionHolder.releaseConnection().then(() => {
      expect(connection.isNeverReleased()).toBeTruthy()
      done()
    })
  })

  it('should not release connection with multiple users when all users release', done => {
    const connection = new FakeConnection()
    const connectionProvider = newSingleConnectionProvider(connection)
    const connectionHolder = newConnectionHolder(
      {
        mode: READ,
        connectionProvider
      },
      connectionHolder => {
        connectionHolder.initializeConnection()
        connectionHolder.initializeConnection()
        connectionHolder.initializeConnection()
      }
    )

    connectionHolder.releaseConnection().then(() => {
      connectionHolder.releaseConnection().then(() => {
        connectionHolder.releaseConnection().then(() => {
          expect(connection.isNeverReleased()).toBeTruthy()
          done()
        })
      })
    })
  })

  it('should do nothing when closed and not initialized', done => {
    const connection = new FakeConnection()
    const connectionProvider = newSingleConnectionProvider(connection)
    const connectionHolder = newConnectionHolder({
      mode: READ,
      connectionProvider
    })

    connectionHolder.close().then(() => {
      expect(connection.isNeverReleased()).toBeTruthy()
      done()
    })
  })

  it('should not close even when users exist', done => {
    const connection = new FakeConnection()
    const connectionProvider = newSingleConnectionProvider(connection)
    const connectionHolder = newConnectionHolder(
      {
        mode: READ,
        connectionProvider
      },
      connectionHolder => {
        connectionHolder.initializeConnection()
        connectionHolder.initializeConnection()
      }
    )

    connectionHolder.close().then(() => {
      expect(connection.isNeverReleased()).toBeTruthy()
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
    const connectionHolder = newConnectionHolder(
      {
        mode: READ,
        connectionProvider
      },
      connectionHolder => connectionHolder.initializeConnection()
    )

    connectionHolder.releaseConnection().then(() => {
      expect(connection1.isReleasedOnce()).toBeFalsy()

      connectionHolder.initializeConnection()
      connectionHolder.releaseConnection().then(() => {
        expect(connection2.isReleasedOnce()).toBeFalsy()
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
    const connectionHolder = newConnectionHolder(
      {
        mode: READ,
        connectionProvider
      },
      connectionHolder => connectionHolder.initializeConnection()
    )

    connectionHolder.close().then(() => {
      expect(connection1.isNeverReleased()).toBeTruthy()

      connectionHolder.initializeConnection()
      connectionHolder.close().then(() => {
        expect(connection2.isNeverReleased()).toBeTruthy()
        done()
      })
    })
  })

  it('should return passed mode', () => {
    function verifyMode (connectionProvider, mode) {
      expect(connectionProvider.mode()).toBe(mode)
    }

    verifyMode(newConnectionHolder(), WRITE)
    verifyMode(newConnectionHolder({ mode: WRITE }), WRITE)
    verifyMode(newConnectionHolder({ mode: READ }), READ)
  })

  it('should default to empty database', () => {
    function verifyDefault (connectionProvider) {
      expect(connectionProvider.database()).toBe('')
    }

    const connectionProvider = newSingleConnectionProvider(new FakeConnection())

    verifyDefault(newConnectionHolder())
    verifyDefault(newConnectionHolder({ mode: READ, connectionProvider }))
    verifyDefault(newConnectionHolder({ mode: WRITE, connectionProvider }))
    verifyDefault(
      newConnectionHolder({ mode: WRITE, database: '', connectionProvider })
    )
    verifyDefault(
      newConnectionHolder({ mode: WRITE, database: null, connectionProvider })
    )
    verifyDefault(
      newConnectionHolder({
        mode: WRITE,
        database: undefined,
        connectionProvider
      })
    )
  })

  it('should return passed database', () => {
    const connectionProvider = newSingleConnectionProvider(new FakeConnection())
    const connectionHolder = newConnectionHolder({
      database: 'testdb',
      connectionProvider
    })

    expect(connectionHolder.database()).toBe('testdb')
  })
})

function newConnectionHolder (params, connectionHolderInit = () => {}) {
  const connectionHolder = new ConnectionHolder(params)
  connectionHolderInit(connectionHolder)
  return new ReadOnlyConnectionHolder(connectionHolder)
}

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

/**
 * @param {Connection} connection
 * @param {*} expectedServerVersion
 */
function verifyConnection (connection, expectedServerVersion) {
  expect(connection).toBeDefined()
  expect(connection.server).toBeDefined()
  expect(connection.server.version).toEqual(expectedServerVersion)
}

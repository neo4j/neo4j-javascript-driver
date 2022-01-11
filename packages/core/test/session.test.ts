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
import { ConnectionProvider, Session, Connection } from '../src'
import { ACCESS_MODE_READ } from '../src/internal/constants'
import FakeConnection from './utils/connection.fake'

describe('session', () => {
  it('close should return promise', done => {
    const connection = newFakeConnection()
    const session = newSessionWithConnection(connection)
    
    session.close().then(() => done())
  }, 70000)

  it('close should return promise even when already closed ', done => {
    const connection = newFakeConnection()
    const session = newSessionWithConnection(connection)

    session.close().then(() => {
      session.close().then(() => {
        session.close().then(() => {
          done()
        })
      })
    })
  }, 70000)

  it('close should be idempotent ', done => {
    const connection = newFakeConnection()
    const session = newSessionWithConnection(connection)

    session.close().then(() => {
      expect(connection.isReleasedOnce()).toBeTruthy()

      session.close().then(() => {
        expect(connection.isReleasedOnce()).toBeTruthy()

        session.close().then(() => {
          expect(connection.isReleasedOnce()).toBeTruthy()
          done()
        })
      })
    })
  }, 70000)

  it('should close transaction executor', done => {
    const session = newSessionWithConnection(newFakeConnection())

    let closeCalledTimes = 0
    // @ts-ignore
    const transactionExecutor = session._transactionExecutor
    const originalClose = transactionExecutor.close
    transactionExecutor.close = () => {
      closeCalledTimes++
      originalClose.call(transactionExecutor)
    }

    session.close().then(() => {
      expect(closeCalledTimes).toEqual(1)
      done()
    })
  }, 70000)
})

function newSessionWithConnection(connection: Connection, fetchSize: number = 1000): Session {
  const connectionProvider = new ConnectionProvider()
  connectionProvider.acquireConnection = () => Promise.resolve(connection)
  connectionProvider.close = () => Promise.resolve()

  const session = new Session({
    mode: ACCESS_MODE_READ,
    connectionProvider,
    database: "",
    fetchSize,
    config: {},
    reactive: false
  })
  session.beginTransaction() // force session to acquire new connection
  return session
}

function newFakeConnection(): FakeConnection {
  return new FakeConnection()
}

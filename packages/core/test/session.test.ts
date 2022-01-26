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
import { ACCESS_MODE_READ, FETCH_ALL } from '../src/internal/constants'
import FakeConnection from './utils/connection.fake'

describe('session', () => {

  describe('.close()', () => {
    it('should return promise', done => {
      const connection = newFakeConnection()
      const session = newSessionWithConnection(connection)
  
      session.close().then(() => done())
    }, 70000)
  
    it('should return promise even when already closed ', done => {
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
    
    it('should close the results and clear the pending results', async () => {
      const connection = newFakeConnection()
      const session = newSessionWithConnection(connection, false, 1000)

      const result = session.run('RETURN 1')
      jest.spyOn(result, 'close')

      await result  
      await session.close()

      expect(result.close).toHaveBeenCalled()
      // @ts-ignore
      expect(session._results).toEqual([])
    })

    it('should close the transaction and clear the pending transactions', async () => {
      const connection = newFakeConnection()
      const session = newSessionWithConnection(connection, false, 1000)

      const tx = session.beginTransaction()
      jest.spyOn(tx, 'close').mockImplementation(() => Promise.resolve())
      
      // @ts-ignore
      expect(session._tx).toEqual(tx)

      await session.close()

      // @ts-ignore
      expect(session._tx).toEqual(null)
      // @ts-ignore
      expect(session._hasTx).toEqual(false)
      expect(tx.close).toHaveBeenCalled()
      
    })
  })
  
  it('run should send watermarks to Result when fetchsize if defined', async () => {
    const connection = newFakeConnection()
    const session = newSessionWithConnection(connection, false, 1000)

    const result = session.run('RETURN 1')
    await result;

    expect(connection.seenProtocolOptions[0]).toMatchObject({
      fetchSize: 1000,
      lowRecordWatermark: 300,
      highRecordWatermark: 700
    })
    // @ts-ignore
    expect(result._watermarks).toEqual({ high: 700, low: 300 })
  })

  it('run should send watermarks to Result when fetchsize is fetch all', async () => {
    const connection = newFakeConnection()
    const session = newSessionWithConnection(connection, false, FETCH_ALL)

    const result = session.run('RETURN 1')
    await result;

    expect(connection.seenProtocolOptions[0]).toMatchObject({
      fetchSize: FETCH_ALL,
      lowRecordWatermark: Number.MAX_VALUE,
      highRecordWatermark: Number.MAX_VALUE
    })

    // @ts-ignore
    expect(result._watermarks).toEqual({ high: Number.MAX_VALUE, low: Number.MAX_VALUE })
  })

  it('run should send watermarks to Transaction when fetchsize if defined (begin)', async () => {
    const connection = newFakeConnection()
    const session = newSessionWithConnection(connection, false, 1000)

    const tx = session.beginTransaction()
    jest.spyOn(tx, 'rollback').mockImplementation(() => Promise.resolve())

    // @ts-ignore
    expect(tx._lowRecordWatermak).toEqual(300)
    // @ts-ignore
    expect(tx._highRecordWatermark).toEqual(700)

    await session.close()
  })

  it('run should send watermarks to Transaction when fetchsize is fetch all (begin)', async () => {
    const connection = newFakeConnection()
    const session = newSessionWithConnection(connection, false, FETCH_ALL)


    const tx = session.beginTransaction()
    
    jest.spyOn(tx, 'rollback').mockImplementation(() => Promise.resolve())

    // @ts-ignore
    expect(tx._lowRecordWatermak).toEqual(Number.MAX_VALUE)
    // @ts-ignore
    expect(tx._highRecordWatermark).toEqual(Number.MAX_VALUE)

    await session.close()
  })

  it('run should send watermarks to Transaction when fetchsize if defined (writeTransaction)', async () => {
    const connection = newFakeConnection()
    const session = newSessionWithConnection(connection, false, 1000)
    const status = { functionCalled: false }

    await session.writeTransaction(tx => {
      // @ts-ignore
      expect(tx._lowRecordWatermak).toEqual(300)
      // @ts-ignore
      expect(tx._highRecordWatermark).toEqual(700)

      status.functionCalled = true
    })

    expect(status.functionCalled).toEqual(true)
  })

  it('run should send watermarks to Transaction when fetchsize is fetch all (writeTransaction)', async () => {
    const connection = newFakeConnection()
    const session = newSessionWithConnection(connection, false, FETCH_ALL)
    const status = { functionCalled: false }

    await session.writeTransaction(tx => {
      // @ts-ignore
      expect(tx._lowRecordWatermak).toEqual(Number.MAX_VALUE)
      // @ts-ignore
      expect(tx._highRecordWatermark).toEqual(Number.MAX_VALUE)

      status.functionCalled = true
    })

    expect(status.functionCalled).toEqual(true)
  })

  it('run should send watermarks to Transaction when fetchsize if defined (readTransaction)', async () => {
    const connection = newFakeConnection()
    const session = newSessionWithConnection(connection, false, 1000)
    const status = { functionCalled: false }

    await session.readTransaction(tx => {
      // @ts-ignore
      expect(tx._lowRecordWatermak).toEqual(300)
      // @ts-ignore
      expect(tx._highRecordWatermark).toEqual(700)

      status.functionCalled = true
    })

    expect(status.functionCalled).toEqual(true)
  })

  it('run should send watermarks to Transaction when fetchsize is fetch all (readTransaction)', async () => {
    const connection = newFakeConnection()
    const session = newSessionWithConnection(connection, false, FETCH_ALL)
    const status = { functionCalled: false }

    await session.readTransaction(tx => {
      // @ts-ignore
      expect(tx._lowRecordWatermak).toEqual(Number.MAX_VALUE)
      // @ts-ignore
      expect(tx._highRecordWatermark).toEqual(Number.MAX_VALUE)

      status.functionCalled = true
    })

    expect(status.functionCalled).toEqual(true)
  })

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

function newSessionWithConnection(connection: Connection, beginTx: boolean = true, fetchSize: number = 1000): Session {
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

  if (beginTx) {
    const tx = session.beginTransaction() // force session to acquire new connection
    jest.spyOn(tx, 'rollback').mockImplementation(() => Promise.resolve())
  }
  return session
}

function newFakeConnection(): FakeConnection {
  return new FakeConnection()
}

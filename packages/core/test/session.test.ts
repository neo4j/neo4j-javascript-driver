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
import { ConnectionProvider, Session, Connection, TransactionPromise, Transaction, BookmarkManager, bookmarkManager, NotificationFilter } from '../src'
import { bookmarks } from '../src/internal'
import { ACCESS_MODE_READ, FETCH_ALL } from '../src/internal/constants'
import ManagedTransaction from '../src/transaction-managed'
import { AuthToken } from '../src/types'
import FakeConnection from './utils/connection.fake'
import { validNotificationFilters } from './utils/notification-filters.fixtures'

describe('session', () => {
  const systemBookmarks = ['sys:bm01', 'sys:bm02']
  const neo4jBookmarks = ['neo4j:bm01', 'neo4j:bm03']
  const customBookmarks = ['neo4j:bm02']

  it('close should return promise', done => {
    const connection = newFakeConnection()
    const session = newSessionWithConnection(connection)

    session.close().then(() => done()).catch(done)
  }, 70000)

  it('close should return promise even when already closed ', done => {
    const connection = newFakeConnection()
    const session = newSessionWithConnection(connection)

    session.close().then(() => {
      session.close().then(() => {
        session.close().then(() => {
          done()
        }).catch(done)
      }).catch(done)
    }).catch(done)
  }, 70000)

  it('run should send watermarks to Result when fetchsize if defined', async () => {
    const connection = newFakeConnection()
    const session = newSessionWithConnection(connection, false, 1000)

    const result = session.run('RETURN 1')
    await result

    expect(connection.seenProtocolOptions[0]).toMatchObject({
      fetchSize: 1000,
      lowRecordWatermark: 300,
      highRecordWatermark: 700
    })
    // @ts-expect-error
    expect(result._watermarks).toEqual({ high: 700, low: 300 })
  })

  it('run should send watermarks to Result when fetchsize is fetch all', async () => {
    const connection = newFakeConnection()
    const session = newSessionWithConnection(connection, false, FETCH_ALL)

    const result = session.run('RETURN 1')
    await result

    expect(connection.seenProtocolOptions[0]).toMatchObject({
      fetchSize: FETCH_ALL,
      lowRecordWatermark: Number.MAX_VALUE,
      highRecordWatermark: Number.MAX_VALUE
    })

    // @ts-expect-error
    expect(result._watermarks).toEqual({ high: Number.MAX_VALUE, low: Number.MAX_VALUE })
  })

  it('run should send watermarks to Transaction when fetchsize if defined (begin)', async () => {
    const connection = newFakeConnection()
    const session = newSessionWithConnection(connection, false, 1000)

    const tx = session.beginTransaction()

    // @ts-expect-error
    expect(tx._lowRecordWatermak).toEqual(300)
    // @ts-expect-error
    expect(tx._highRecordWatermark).toEqual(700)
  })

  it('run should send watermarks to Transaction when fetchsize is fetch all (begin)', async () => {
    const connection = newFakeConnection()
    const session = newSessionWithConnection(connection, false, FETCH_ALL)

    const tx = session.beginTransaction()

    // @ts-expect-error
    expect(tx._lowRecordWatermak).toEqual(Number.MAX_VALUE)
    // @ts-expect-error
    expect(tx._highRecordWatermark).toEqual(Number.MAX_VALUE)
  })

  it('run should send watermarks to Transaction when fetchsize if defined (writeTransaction)', async () => {
    const connection = mockBeginWithSuccess(newFakeConnection())
    const session = newSessionWithConnection(connection, false, 1000)
    const status = { functionCalled: false }

    await session.writeTransaction(tx => {
      // @ts-expect-error
      expect(tx._lowRecordWatermak).toEqual(300)
      // @ts-expect-error
      expect(tx._highRecordWatermark).toEqual(700)

      status.functionCalled = true
    })

    expect(status.functionCalled).toEqual(true)
  })

  it('run should send watermarks to Transaction when fetchsize is fetch all (writeTransaction)', async () => {
    const connection = mockBeginWithSuccess(newFakeConnection())
    const session = newSessionWithConnection(connection, false, FETCH_ALL)
    const status = { functionCalled: false }

    await session.writeTransaction(tx => {
      // @ts-expect-error
      expect(tx._lowRecordWatermak).toEqual(Number.MAX_VALUE)
      // @ts-expect-error
      expect(tx._highRecordWatermark).toEqual(Number.MAX_VALUE)

      status.functionCalled = true
    })

    expect(status.functionCalled).toEqual(true)
  })

  it('run should send watermarks to Transaction when fetchsize if defined (readTransaction)', async () => {
    const connection = mockBeginWithSuccess(newFakeConnection())
    const session = newSessionWithConnection(connection, false, 1000)
    const status = { functionCalled: false }

    await session.readTransaction(tx => {
      // @ts-expect-error
      expect(tx._lowRecordWatermak).toEqual(300)
      // @ts-expect-error
      expect(tx._highRecordWatermark).toEqual(700)

      status.functionCalled = true
    })

    expect(status.functionCalled).toEqual(true)
  })

  it('run should send watermarks to Transaction when fetchsize is fetch all (readTransaction)', async () => {
    const connection = mockBeginWithSuccess(newFakeConnection())
    const session = newSessionWithConnection(connection, false, FETCH_ALL)
    const status = { functionCalled: false }

    await session.readTransaction(tx => {
      // @ts-expect-error
      expect(tx._lowRecordWatermak).toEqual(Number.MAX_VALUE)
      // @ts-expect-error
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
        }).catch(done)
      }).catch(done)
    }).catch(done)
  }, 70000)

  it('close should reset connection if there is an ongoing request ', async () => {
    const connection = newFakeConnection()
    const resetAndFlushSpy = jest.spyOn(connection, 'resetAndFlush')
    const session = newSessionWithConnection(connection)

    await session.close()

    expect(resetAndFlushSpy).toHaveBeenCalledTimes(1)
  }, 70000)

  it('close should not reset connection if there is not an ongoing request', async () => {
    const connection = newFakeConnection()
    connection.hasOngoingObservableRequests = () => false
    const resetAndFlushSpy = jest.spyOn(connection, 'resetAndFlush')
    const session = newSessionWithConnection(connection, false)

    await session.close()

    expect(resetAndFlushSpy).not.toHaveBeenCalled()
  }, 70000)

  it('close should reset connection if there is not an ongoing request but it has tx running', async () => {
    const connection = newFakeConnection()
    connection.hasOngoingObservableRequests = () => false
    const resetAndFlushSpy = jest.spyOn(connection, 'resetAndFlush')
    const session = newSessionWithConnection(connection)

    await session.close()

    expect(resetAndFlushSpy).toHaveBeenCalled()
  }, 70000)

  it('should close transaction executor', done => {
    const session = newSessionWithConnection(newFakeConnection())

    let closeCalledTimes = 0
    // @ts-expect-error
    const transactionExecutor = session._transactionExecutor
    const originalClose = transactionExecutor.close
    transactionExecutor.close = () => {
      closeCalledTimes++
      originalClose.call(transactionExecutor)
    }

    session.close().then(() => {
      expect(closeCalledTimes).toEqual(1)
      done()
    }).catch(done)
  }, 70000)

  it('should call cancel current result', done => {
    const session = newSessionWithConnection(newFakeConnection())

    const result = session.run('RETURN 1')
    const spiedCancel = jest.spyOn(result, '_cancel')

    session.close()
      .finally(() => {
        expect(spiedCancel).toHaveBeenCalled()
        done()
      })
  })

  it('should call cancel current results', done => {
    const session = newSessionWithConnection(newFakeConnection())

    const spiedCancels: any[] = []

    for (let i = 0; i < 10; i++) {
      const result = session.run('RETURN 1')
      spiedCancels.push(jest.spyOn(result, '_cancel'))
    }

    session.close()
      .finally(() => {
        spiedCancels.forEach(spy => {
          expect(spy).toHaveBeenCalled()
        })
        done()
      })
  })

  describe('.lastBookmark()', () => {
    it.each([
      [bookmarks.Bookmarks.empty()],
      [new bookmarks.Bookmarks('bookmark1')],
      [new bookmarks.Bookmarks(['bookmark1', 'bookmark2'])]
    ])('should return the bookmark informed in the object creation', (bookmarks) => {
      const session = newSessionWithConnection(newFakeConnection(), false, 1000, bookmarks)

      expect(session.lastBookmark()).toEqual(bookmarks.values())
    })
  })

  describe('.lastBookmark()', () => {
    it.each([
      [bookmarks.Bookmarks.empty()],
      [new bookmarks.Bookmarks('bookmark1')],
      [new bookmarks.Bookmarks(['bookmark1', 'bookmark2'])]
    ])('should return the bookmark informed in the object creation', (bookmarks) => {
      const session = newSessionWithConnection(newFakeConnection(), false, 1000, bookmarks)

      expect(session.lastBookmarks()).toEqual(bookmarks.values())
    })
  })

  describe('.beginTransaction()', () => {
    it('should return a TransactionPromise', () => {
      const session = newSessionWithConnection(newFakeConnection(), false, 1000)

      const tx: Transaction = session.beginTransaction()

      expect(tx).toBeInstanceOf(TransactionPromise)
    })

    it('should resolves a Transaction', async () => {
      const connection = mockBeginWithSuccess(newFakeConnection())

      const session = newSessionWithConnection(connection, false, 1000)

      const tx: Transaction = await session.beginTransaction()

      expect(tx).toBeDefined()
    })

    it('should acquire connection with bookmarks from the bookmark manager', async () => {
      const manager = bookmarkManager({
        initialBookmarks: [...neo4jBookmarks, ...systemBookmarks]
      })
      const connection = mockBeginWithSuccess(newFakeConnection())

      const { session, connectionProvider } = setupSession({
        connection,
        bookmarkManager: manager,
        beginTx: false,
        database: 'neo4j'
      })

      await session.beginTransaction()

      expect(connectionProvider.acquireConnection).toBeCalledWith(
        expect.objectContaining({ bookmarks: new bookmarks.Bookmarks([...neo4jBookmarks, ...systemBookmarks]) })
      )
    })

    it('should acquire connection with bookmarks from the bookmark manager + lastBookmarks', async () => {
      const manager = bookmarkManager({
        initialBookmarks: [...neo4jBookmarks, ...systemBookmarks]
      })
      const connection = mockBeginWithSuccess(newFakeConnection())

      const { session, connectionProvider } = setupSession({
        connection,
        bookmarkManager: manager,
        beginTx: false,
        lastBookmarks: new bookmarks.Bookmarks(customBookmarks),
        database: 'neo4j'
      })

      await session.beginTransaction()

      expect(connectionProvider.acquireConnection).toBeCalledWith(
        expect.objectContaining({ bookmarks: new bookmarks.Bookmarks([...customBookmarks, ...neo4jBookmarks, ...systemBookmarks]) })
      )
    })

    it.each([
      [[]],
      [customBookmarks]
    ])('should call getAllBookmarks for the relevant database', async (lastBookmarks) => {
      const manager = bookmarkManager({
        initialBookmarks: [...neo4jBookmarks, ...systemBookmarks]
      })
      const getAllBookmarksSpy = jest.spyOn(manager, 'getBookmarks')

      const connection = mockBeginWithSuccess(newFakeConnection())

      const { session } = setupSession({
        connection,
        bookmarkManager: manager,
        beginTx: false,
        database: 'neo4j',
        lastBookmarks: new bookmarks.Bookmarks(lastBookmarks)
      })

      await session.beginTransaction()

      expect(getAllBookmarksSpy).toBeCalledWith()
    })

    it.each([
      [[]],
      [customBookmarks]
    ])('should call begin query with getAllBookmarks + lastBookmarks', async (lastBookmarks) => {
      const manager = bookmarkManager({
        initialBookmarks: [...neo4jBookmarks, ...systemBookmarks]
      })

      const connection = mockBeginWithSuccess(newFakeConnection())

      const { session } = setupSession({
        connection,
        bookmarkManager: manager,
        beginTx: false,
        database: 'neo4j',
        lastBookmarks: new bookmarks.Bookmarks(lastBookmarks)
      })

      await session.beginTransaction()

      expect(connection.seenBeginTransaction[0]).toEqual([
        expect.objectContaining({
          bookmarks: new bookmarks.Bookmarks([...neo4jBookmarks, ...systemBookmarks, ...lastBookmarks])
        })
      ])
    })

    it.each([
      [undefined],
      ['neo4j'],
      ['adb']
    ])('should not call updateBookmarks when server returns no bookmarks', async (metaDb) => {
      const manager = bookmarkManager({
        initialBookmarks: [...neo4jBookmarks, ...systemBookmarks]
      })

      const updateBookmarksSpy = jest.spyOn(manager, 'updateBookmarks')

      const connection = mockBeginWithSuccess(newFakeConnection())

      const { session } = setupSession({
        connection,
        bookmarkManager: manager,
        beginTx: false,
        database: 'neo4j'
      })

      await session.beginTransaction()

      expect(updateBookmarksSpy).not.toBeCalled()
    })

    it('should acquire connection with auth', async () => {
      const auth = {
        scheme: 'bearer',
        credentials: 'bearer some-nice-token'
      }
      const connection = mockBeginWithSuccess(newFakeConnection())

      const { session, connectionProvider } = setupSession({
        connection,
        auth,
        beginTx: false,
        database: 'neo4j'
      })

      await session.beginTransaction()

      expect(connectionProvider.acquireConnection).toBeCalledWith(
        expect.objectContaining({ auth })
      )
    })

    it('should acquire connection without auth', async () => {
      const auth = {
        scheme: 'bearer',
        credentials: 'bearer some-nice-token'
      }
      const connection = mockBeginWithSuccess(newFakeConnection())

      const { session, connectionProvider } = setupSession({
        connection,
        beginTx: false,
        database: 'neo4j'
      })

      await session.beginTransaction()

      expect(connectionProvider.acquireConnection).not.toBeCalledWith(
        expect.objectContaining({ auth })
      )
    })
  })

  describe('.commit()', () => {
    it.each([
      [undefined, 'neo4j'],
      ['neo4j', 'neo4j'],
      ['adb', 'adb']
    ])('should call updateBookmarks when server returns non-empty bookmarks', async (metaDb, updateDb) => {
      const manager = bookmarkManager({
        initialBookmarks: [...neo4jBookmarks, ...systemBookmarks]
      })

      const updateBookmarksSpy = jest.spyOn(manager, 'updateBookmarks')

      const connection = mockCommitWithSuccess(mockBeginWithSuccess(newFakeConnection()), { db: metaDb, bookmark: customBookmarks })

      const { session } = setupSession({
        connection,
        bookmarkManager: manager,
        beginTx: false,
        database: 'neo4j'
      })

      const tx = await session.beginTransaction()
      await tx.commit()

      expect(updateBookmarksSpy).toBeCalledTimes(1)
      expect(updateBookmarksSpy).toBeCalledWith([...neo4jBookmarks, ...systemBookmarks], customBookmarks)
    })

    it.each([
      [undefined],
      ['neo4j'],
      ['adb']
    ])('should not call updateBookmarks when server returns no bookmarks', async (metaDb) => {
      const manager = bookmarkManager({
        initialBookmarks: [...neo4jBookmarks, ...systemBookmarks]
      })

      const updateBookmarksSpy = jest.spyOn(manager, 'updateBookmarks')

      const connection = mockCommitWithSuccess(mockBeginWithSuccess(newFakeConnection()), { db: metaDb })

      const { session } = setupSession({
        connection,
        bookmarkManager: manager,
        beginTx: false,
        database: 'neo4j'
      })

      const tx = await session.beginTransaction()
      await tx.commit()

      expect(updateBookmarksSpy).not.toBeCalled()
    })

    it.each(
      validNotificationFilters()
    )('should call run query with notificationFilter', async (notificationFilter?: NotificationFilter) => {
      const connection = mockBeginWithSuccess(newFakeConnection())

      const { session } = setupSession({
        connection,
        beginTx: false,
        database: 'neo4j',
        notificationFilter
      })

      await session.beginTransaction()

      expect(connection.seenBeginTransaction[0][0]).toEqual(
        expect.objectContaining({
          notificationFilter
        })
      )
    })
  })

  describe.each([
    ['.executeWrite()', (session: Session) => session.executeWrite.bind(session)],
    ['.executeRead()', (session: Session) => session.executeRead.bind(session)]
  ])('%s', (_, execute) => {
    it('should call executor with ManagedTransaction', async () => {
      const connection = mockBeginWithSuccess(newFakeConnection())
      const session = newSessionWithConnection(connection, false, 1000)
      const status = { functionCalled: false }

      await execute(session)(async (tx: ManagedTransaction) => {
        expect(typeof tx).toEqual('object')
        expect(tx).toBeInstanceOf(ManagedTransaction)

        status.functionCalled = true
      })

      expect(status.functionCalled).toEqual(true)
    })

    it('should proxy run to the begun transaction', async () => {
      const connection = mockBeginWithSuccess(newFakeConnection())
      const session = newSessionWithConnection(connection, false, FETCH_ALL)
      // @ts-expect-error
      const run = jest.spyOn(Transaction.prototype, 'run').mockImplementation(async () => await Promise.resolve())
      const status = { functionCalled: false }
      const query = 'RETURN $a'
      const params = { a: 1 }

      await execute(session)(async (tx: ManagedTransaction) => {
        status.functionCalled = true
        await tx.run(query, params)
      })

      expect(status.functionCalled).toEqual(true)
      expect(run).toHaveBeenCalledWith(query, params)
    })
  })

  describe('.run()', () => {
    it('should acquire connection with bookmarks from the bookmark manager', async () => {
      const manager = bookmarkManager({
        initialBookmarks: [...neo4jBookmarks, ...systemBookmarks]
      })
      const connection = newFakeConnection()

      const { session, connectionProvider } = setupSession({
        connection,
        bookmarkManager: manager,
        beginTx: false,
        database: 'neo4j'
      })

      await session.run('query')

      expect(connectionProvider.acquireConnection).toBeCalledWith(
        expect.objectContaining({ bookmarks: new bookmarks.Bookmarks([...neo4jBookmarks, ...systemBookmarks]) })
      )
    })

    it('should acquire connection with bookmarks from the bookmark manager + lastBookmarks', async () => {
      const manager = bookmarkManager({
        initialBookmarks: [...neo4jBookmarks, ...systemBookmarks]
      })
      const connection = newFakeConnection()

      const { session, connectionProvider } = setupSession({
        connection,
        bookmarkManager: manager,
        beginTx: false,
        lastBookmarks: new bookmarks.Bookmarks(customBookmarks),
        database: 'neo4j'
      })

      await session.run('query')

      expect(connectionProvider.acquireConnection).toBeCalledWith(
        expect.objectContaining({ bookmarks: new bookmarks.Bookmarks([...customBookmarks, ...neo4jBookmarks, ...systemBookmarks]) })
      )
    })

    it('should acquire connection with bookmarks from the bookmark manager when bookmarks already updated', async () => {
      const manager = bookmarkManager({
        initialBookmarks: [...neo4jBookmarks, ...systemBookmarks]
      })
      const connection = newFakeConnection()

      const { session, connectionProvider } = setupSession({
        connection,
        bookmarkManager: manager,
        beginTx: false,
        lastBookmarks: new bookmarks.Bookmarks(customBookmarks),
        database: 'neo4j'
      })

      await session.run('query')
      const { afterComplete } = connection.seenProtocolOptions[0]
      afterComplete({ db: 'neo4j', bookmark: ['other-bookmark'] })

      await session.run('query')

      expect(connectionProvider.acquireConnection).toHaveBeenCalledTimes(2)
      expect(connectionProvider.acquireConnection).toHaveBeenNthCalledWith(1,
        expect.objectContaining({ bookmarks: new bookmarks.Bookmarks([...customBookmarks, ...neo4jBookmarks, ...systemBookmarks]) }))

      expect(connectionProvider.acquireConnection).toHaveBeenLastCalledWith(
        expect.objectContaining({ bookmarks: new bookmarks.Bookmarks(['other-bookmark']) }))
    })

    it('should acquire connection with bookmarks from the bookmark manager + lastBookmarks when bookmarks not updated', async () => {
      const manager = bookmarkManager({
        initialBookmarks: [...neo4jBookmarks, ...systemBookmarks]
      })
      const connection = newFakeConnection()

      const { session, connectionProvider } = setupSession({
        connection,
        bookmarkManager: manager,
        beginTx: false,
        lastBookmarks: new bookmarks.Bookmarks(customBookmarks),
        database: 'neo4j'
      })

      await session.run('query')
      const { afterComplete } = connection.seenProtocolOptions[0]
      afterComplete({ db: 'neo4j', bookmark: [] })

      await session.run('query')

      expect(connectionProvider.acquireConnection).toHaveBeenNthCalledWith(2,
        expect.objectContaining({ bookmarks: new bookmarks.Bookmarks([...customBookmarks, ...neo4jBookmarks, ...systemBookmarks]) })
      )
    })

    it.each([
      [[]],
      [customBookmarks]
    ])('should call getBookmarks', async (lastBookmarks) => {
      const manager = bookmarkManager({
        initialBookmarks: [...neo4jBookmarks, ...systemBookmarks]
      })
      const getAllBookmarksSpy = jest.spyOn(manager, 'getBookmarks')

      const connection = newFakeConnection()

      const { session } = setupSession({
        connection,
        bookmarkManager: manager,
        beginTx: false,
        database: 'neo4j',
        lastBookmarks: new bookmarks.Bookmarks(lastBookmarks)
      })

      await session.run('query')

      expect(getAllBookmarksSpy).toBeCalledWith()
    })

    it.each([
      [[]],
      [customBookmarks]
    ])('should call run query with getBookmarks + lastBookmarks', async (lastBookmarks) => {
      const manager = bookmarkManager({
        initialBookmarks: [...neo4jBookmarks, ...systemBookmarks]
      })

      const connection = newFakeConnection()

      const { session } = setupSession({
        connection,
        bookmarkManager: manager,
        beginTx: false,
        database: 'neo4j',
        lastBookmarks: new bookmarks.Bookmarks(lastBookmarks)
      })

      await session.run('query')

      expect(connection.seenProtocolOptions[0]).toEqual(
        expect.objectContaining({
          bookmarks: new bookmarks.Bookmarks([...neo4jBookmarks, ...systemBookmarks, ...lastBookmarks])
        })
      )
    })

    it.each([
      [[]],
      [customBookmarks]
    ])('should call run query with getBookmarks + lastBookmarks when bookmarks not updated', async (lastBookmarks) => {
      const manager = bookmarkManager({
        initialBookmarks: [...neo4jBookmarks, ...systemBookmarks]
      })

      const connection = newFakeConnection()

      const { session } = setupSession({
        connection,
        bookmarkManager: manager,
        beginTx: false,
        database: 'neo4j',
        lastBookmarks: new bookmarks.Bookmarks(lastBookmarks)
      })

      await session.run('query')
      const { afterComplete } = connection.seenProtocolOptions[0]
      afterComplete({ db: 'neo4j', bookmark: [] })

      await session.run('query')

      expect(connection.seenProtocolOptions[1]).toEqual(
        expect.objectContaining({
          bookmarks: new bookmarks.Bookmarks([...neo4jBookmarks, ...systemBookmarks, ...lastBookmarks])
        })
      )
    })

    it.each([
      [[]],
      [customBookmarks]
    ])('should call run query with getBookmarks when bookmarks updated', async (lastBookmarks) => {
      const manager = bookmarkManager({
        initialBookmarks: [...neo4jBookmarks, ...systemBookmarks]
      })

      const connection = newFakeConnection()

      const { session } = setupSession({
        connection,
        bookmarkManager: manager,
        beginTx: false,
        database: 'neo4j',
        lastBookmarks: new bookmarks.Bookmarks(lastBookmarks)
      })

      await session.run('query')
      const { afterComplete } = connection.seenProtocolOptions[0]
      afterComplete({ db: 'neo4j', bookmark: 'abc' })
      await manager.updateBookmarks(['abc'], neo4jBookmarks)

      await session.run('query')

      expect(connection.seenProtocolOptions[1]).toEqual(
        expect.objectContaining({
          bookmarks: new bookmarks.Bookmarks([...neo4jBookmarks])
        })
      )
    })

    it.each([
      [undefined, 'neo4j'],
      ['neo4j', 'neo4j'],
      ['adb', 'adb']
    ])('should call updateBookmarks when server returns non-empty bookmarks', async (metaDb, updateDb) => {
      const manager = bookmarkManager({
        initialBookmarks: [...neo4jBookmarks, ...systemBookmarks]
      })

      const updateBookmarksSpy = jest.spyOn(manager, 'updateBookmarks')

      const connection = newFakeConnection()

      const { session } = setupSession({
        connection,
        bookmarkManager: manager,
        beginTx: false,
        database: 'neo4j'
      })

      await session.run('query')

      const { afterComplete } = connection.seenProtocolOptions[0]

      afterComplete({ db: metaDb, bookmark: customBookmarks })

      expect(updateBookmarksSpy).toBeCalledWith([...neo4jBookmarks, ...systemBookmarks], customBookmarks)
    })

    it.each([
      [undefined],
      ['neo4j'],
      ['adb']
    ])('should not call updateBookmarks when server returns no bookmarks', async (metaDb) => {
      const manager = bookmarkManager({
        initialBookmarks: [...neo4jBookmarks, ...systemBookmarks]
      })

      const updateBookmarksSpy = jest.spyOn(manager, 'updateBookmarks')

      const connection = newFakeConnection()

      const { session } = setupSession({
        connection,
        bookmarkManager: manager,
        beginTx: false,
        database: 'neo4j'
      })

      await session.run('query')

      const { afterComplete } = connection.seenProtocolOptions[0]

      afterComplete({ db: metaDb })

      expect(updateBookmarksSpy).not.toBeCalled()
    })

    it.each(
      validNotificationFilters()
    )('should call run query with notificationFilter', async (notificationFilter?: NotificationFilter) => {
      const connection = newFakeConnection()

      const { session } = setupSession({
        connection,
        beginTx: false,
        database: 'neo4j',
        notificationFilter
      })

      await session.run('query')

      expect(connection.seenProtocolOptions[0]).toEqual(
        expect.objectContaining({
          notificationFilter
        })
      )
    })

    it('should acquire with auth', async () => {
      const auth = {
        scheme: 'bearer',
        credentials: 'bearer some-nice-token'
      }
      const connection = newFakeConnection()

      const { session, connectionProvider } = setupSession({
        connection,
        auth,
        beginTx: false,
        database: 'neo4j'
      })

      await session.run('query')
      
      expect(connectionProvider.acquireConnection).toBeCalledWith(
        expect.objectContaining({ auth })
      )
    })

    it('should acquire without auth', async () => {
      const auth = {
        scheme: 'bearer',
        credentials: 'bearer some-nice-token'
      }
      const connection = newFakeConnection()

      const { session, connectionProvider } = setupSession({
        connection,
        beginTx: false,
        database: 'neo4j'
      })

      await session.run('query')

      expect(connectionProvider.acquireConnection).not.toBeCalledWith(
        expect.objectContaining({ auth })
      )
    })
  })
})

function mockBeginWithSuccess (connection: FakeConnection): FakeConnection {
  const protocol = connection.protocol()
  connection.protocol = () => {
    return {
      ...protocol,
      beginTransaction: (params: { afterComplete: () => {} }, ...args: any[]) => {
        protocol.beginTransaction([params, ...args])
        params.afterComplete()
      }
    }
  }
  return connection
}

function mockCommitWithSuccess (connection: FakeConnection, metadata: any): FakeConnection {
  const protocol = connection.protocol()
  connection.protocol = () => {
    return {
      ...protocol,
      commitTransaction: (params: { afterComplete: (metadata: any) => {} }, ...args: any[]) => {
        const observer = protocol.commitTransaction(...[params, ...args])
        params.afterComplete(metadata)
        return observer
      }
    }
  }
  return connection
}

function newSessionWithConnection (
  connection: Connection,
  beginTx: boolean = true,
  fetchSize: number = 1000,
  lastBookmarks: bookmarks.Bookmarks = bookmarks.Bookmarks.empty(),
  bookmarkManager?: BookmarkManager
): Session {
  const { session } = setupSession({
    connection, beginTx, fetchSize, lastBookmarks, bookmarkManager
  })
  return session
}

function setupSession ({
  connection,
  beginTx = true,
  fetchSize = 1000,
  database = '',
  lastBookmarks = bookmarks.Bookmarks.empty(),
  bookmarkManager,
  notificationFilter,
  auth
}: {
  connection: Connection
  beginTx?: boolean
  fetchSize?: number
  lastBookmarks?: bookmarks.Bookmarks
  database?: string
  bookmarkManager?: BookmarkManager
  notificationFilter?: NotificationFilter
  auth?: AuthToken
}): { session: Session, connectionProvider: ConnectionProvider } {
  const connectionProvider = new ConnectionProvider()
  connectionProvider.acquireConnection = jest.fn(async () => await Promise.resolve(connection))
  connectionProvider.close = async () => await Promise.resolve()

  const session = new Session({
    mode: ACCESS_MODE_READ,
    connectionProvider,
    database,
    fetchSize,
    config: {},
    reactive: false,
    bookmarks: lastBookmarks,
    bookmarkManager,
    notificationFilter,
    auth
  })

  if (beginTx) {
    session.beginTransaction().catch(e => { }) // force session to acquire new connection
  }
  return { session, connectionProvider }
}

function newFakeConnection (): FakeConnection {
  return new FakeConnection()
}

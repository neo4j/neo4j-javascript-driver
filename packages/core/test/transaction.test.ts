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

import { ConnectionProvider, newError, Transaction, TransactionPromise } from '../src'
import { Bookmarks } from '../src/internal/bookmarks'
import { ConnectionHolder } from '../src/internal/connection-holder'
import { TxConfig } from '../src/internal/tx-config'
import FakeConnection from './utils/connection.fake'

testTx('Transaction', newRegularTransaction)

testTx('TransactionPromise', newTransactionPromise, () => {
  describe('Promise', () => {
    const syncContext = (fn: () => void): void => fn()
    const asyncContext = (fn: () => void): NodeJS.Immediate => setImmediate(fn)

    whenBeginSucceed('async', asyncContext)
    whenBeginSucceed('sync', syncContext)

    function whenBeginSucceed (ctxName: string, ctx: (_: () => void) => void): void {
      describe(`when begin processed with success [${ctxName}]`, () => {
        it('should result resolve with Transaction', async () => {
          const [tx] = setupTx()

          const resolveTx: Transaction = await tx

          // @ts-expect-error
          expect(resolveTx.then).toBeUndefined()
          // @ts-expect-error
          expect(resolveTx.catch).toBeUndefined()
          // @ts-expect-error
          expect(resolveTx.finally).toBeUndefined()

          expect(resolveTx.commit).toBeDefined()
          expect(resolveTx.rollback).toBeDefined()
          expect(resolveTx.close).toBeDefined()
          expect(resolveTx.run).toBeDefined()
          expect(resolveTx.isOpen).toBeDefined()
        })

        it('should resolve an open Transaction', async () => {
          const [tx] = setupTx()

          const resolved = await tx

          expect(resolved.isOpen()).toBe(true)
        })

        it('should be able to run queries in the resolved transaction', async () => {
          const [tx] = setupTx()

          const resolvedTx = await tx

          await resolvedTx.run('RETURN 1')
        })

        it('should be able to commit the resolved transaction', async () => {
          const [tx] = setupTx()

          const resolvedTx = await tx

          await resolvedTx.commit()
        })

        it('should be able to rollback the resolved transaction', async () => {
          const [tx] = setupTx()

          const resolvedTx = await tx

          await resolvedTx.rollback()
        })

        it('should be able to close the resolved transaction', async () => {
          const [tx] = setupTx()

          const resolvedTx = await tx

          await resolvedTx.close()
        })

        it('should the original tx be open', async () => {
          const [tx] = setupTx()

          await tx

          expect(tx.isOpen()).toBe(true)
        })

        it('should be able to run queries in the original transaction', async () => {
          const [tx] = setupTx()

          await tx

          await tx.run('RETURN 1')
        })

        it('should be able to commit the original transaction', async () => {
          const [tx] = setupTx()

          await tx

          await tx.commit()
        })

        it('should be able to rollback the original transaction', async () => {
          const [tx] = setupTx()

          await tx

          await tx.rollback()
        })

        it('should be able to close the original transaction', async () => {
          const [tx] = setupTx()

          await tx

          await tx.close()
        })

        function setupTx (): [TransactionPromise] {
          const connection = newFakeConnection()
          const protocol = connection.protocol()

          connection.protocol = () => {
            return {
              ...protocol,
              beginTransaction: (params: { afterComplete: (meta: any) => void }) => {
                ctx(() => params.afterComplete({}))
              }
            }
          }

          const tx = newTransactionPromise({
            connection
          })

          tx._begin(async () => Bookmarks.empty(), TxConfig.empty())

          return [tx]
        }
      })
    }

    whenBeginFails('async', asyncContext)
    whenBeginFails('sync', syncContext)

    function whenBeginFails (ctxName: string, ctx: (fn: () => void) => void): void {
      describe(`when begin fails [${ctxName}]`, () => {
        it('should fails to resolve the transaction', async () => {
          const [tx, expectedError] = setupTx()

          try {
            await tx
            fail('should have thrown')
          } catch (e) {
            expect(e).toEqual(expectedError)
          }
        })

        it('should be closed', async () => {
          const [tx] = setupTx()

          try {
            await tx
          } catch (e) {
            // thats fine
          }

          expect(tx.isOpen()).toBe(false)
        })

        it('should not be able to run queries in the original transaction', async () => {
          const [tx] = setupTx()

          try {
            await tx
          } catch (e) {
            // thats fine
          }

          try {
            await tx.run('RETURN 1')
            fail('shoud not succeed')
          } catch (e) {
            expect(e).toEqual(newError(
              'Cannot run query in this transaction, because it has been rolled back either because of an error or explicit termination.'
            ))
          }
        })

        it('should not be able to commit the original transaction', async () => {
          const [tx] = setupTx()

          try {
            await tx
          } catch (e) {
            // thats fine
          }

          try {
            await tx.commit()
            fail('shoud not succeed')
          } catch (e) {
            expect(e).toEqual(newError(
              'Cannot commit this transaction, because it has been rolled back either because of an error or explicit termination.'
            ))
          }
        })

        it('should be able to rollback the original transaction', async () => {
          const [tx] = setupTx()

          try {
            await tx
          } catch (e) {
            // thats fine
          }

          await tx.rollback()
        })

        it('should be able to close the original transaction', async () => {
          const [tx] = setupTx()

          try {
            await tx
          } catch (e) {
            // thats fine
          }

          await tx.close()
        })

        function setupTx (): [TransactionPromise, Error] {
          const connection = newFakeConnection()
          const protocol = connection.protocol()
          const expectedError = newError('begin error')

          connection.protocol = () => {
            return {
              ...protocol,
              beginTransaction: (params: { beforeError: (error: Error) => void }) => {
                ctx(() => params.beforeError(expectedError))
              }
            }
          }

          const tx = newTransactionPromise({
            connection
          })

          tx._begin(async () => Bookmarks.empty(), TxConfig.empty())
          return [tx, expectedError]
        }
      })
    }

    describe('when connection holder return a void connection', () => {
      it('should fails to resolve the transaction', async () => {
        const expectedError = newError('No connection available')

        const tx = newTransactionPromise({
          connection: undefined
        })

        tx._begin(async () => Bookmarks.empty(), TxConfig.empty())

        try {
          await tx
          fail('should have thrown')
        } catch (e) {
          expect(e).toEqual(expectedError)
        }
      })
    })

    describe('when connection holder fails returning a connection', () => {
      it('should fails to resolve the transaction', async () => {
        const expectedError = newError('Something wrong')

        const tx = newTransactionPromise({
          connection: undefined,
          errorResolvingConnection: expectedError
        })

        tx._begin(async () => Bookmarks.empty(), TxConfig.empty())

        try {
          await tx
          fail('should have thrown')
        } catch (e) {
          expect(e).toEqual(expectedError)
        }
      })
    })
  })
})

function testTx<T extends Transaction> (transactionName: string, newTransaction: TransactionFactory<T>, fn: jest.EmptyFunction = () => { }): void {
  describe(transactionName, () => {
    describe('.run()', () => {
      it('should call run with watermarks', async () => {
        const connection = newFakeConnection()
        const tx = newTransaction({
          connection,
          fetchSize: 1000,
          highRecordWatermark: 700,
          lowRecordWatermark: 300
        })

        tx._begin(async () => Bookmarks.empty(), TxConfig.empty())

        await tx.run('RETURN 1')

        expect(connection.seenProtocolOptions[0]).toMatchObject({
          fetchSize: 1000,
          lowRecordWatermark: 300,
          highRecordWatermark: 700
        })
      })

      it('should configure result with watermarks', async () => {
        const connection = newFakeConnection()
        const tx = newTransaction({
          connection,
          fetchSize: 1000,
          highRecordWatermark: 700,
          lowRecordWatermark: 300
        })

        tx._begin(async () => Bookmarks.empty(), TxConfig.empty())

        const result = tx.run('RETURN 1')

        // @ts-expect-error
        expect(result._watermarks).toEqual({ high: 700, low: 300 })
      })

      it('should wait until begin message be sent', async () => {
        const connection = newFakeConnection()
        const tx = newTransaction({
          connection
        })

        const bookmarksPromise: Promise<Bookmarks> = new Promise((resolve) => {
          setTimeout(() => resolve(Bookmarks.empty()), 1000)
        })

        tx._begin(async () => await bookmarksPromise, TxConfig.empty())

        const result = tx.run('RETURN 1')

        expect(connection.seenBeginTransaction.length).toEqual(0)
        expect(connection.seenQueries.length).toEqual(0)

        await result

        expect(connection.seenBeginTransaction.length).toEqual(1)
        expect(connection.seenQueries.length).toEqual(1)
      })
    })

    describe('.close()', () => {
      describe('when transaction is open', () => {
        it('should roll back the transaction', async () => {
          const connection = newFakeConnection()
          const tx = newTransaction({ connection })

          tx._begin(async () => Bookmarks.empty(), TxConfig.empty())
          await tx.run('RETURN 1')
          await tx.close()

          expect(connection.rollbackInvoked).toEqual(1)
        })

        it('should surface errors during the rollback', async () => {
          const expectedError = new Error('rollback error')
          const connection = newFakeConnection().withRollbackError(expectedError)
          const tx = newTransaction({ connection })

          tx._begin(async () => Bookmarks.empty(), TxConfig.empty())
          await tx.run('RETURN 1')

          try {
            await tx.close()
            fail('should have thrown')
          } catch (error) {
            expect(error).toEqual(expectedError)
          }
        })

        it('should wait until begin message be sent', async () => {
          const connection = newFakeConnection()
          const tx = newTransaction({
            connection
          })

          const bookmarksPromise: Promise<Bookmarks> = new Promise((resolve) => {
            setTimeout(() => resolve(Bookmarks.empty()), 1000)
          })

          tx._begin(async () => await bookmarksPromise, TxConfig.empty())

          const result = tx.close()

          expect(connection.seenBeginTransaction.length).toEqual(0)
          expect(connection.rollbackInvoked).toEqual(0)

          await result

          expect(connection.seenBeginTransaction.length).toEqual(1)
          expect(connection.rollbackInvoked).toEqual(1)
        })
      })

      describe('when transaction is closed', () => {
        const commit = async (tx: Transaction): Promise<void> => await tx.commit()
        const rollback = async (tx: Transaction): Promise<void> => await tx.rollback()
        const error = async (tx: Transaction, conn: FakeConnection): Promise<void> => {
          conn.withRollbackError(new Error('rollback error'))
          return await tx.rollback().catch(() => { })
        }

        it.each([
          ['commmited', commit],
          ['rolled back', rollback],
          ['with error', error]
        ])('should not roll back the connection', async (_, operation) => {
          const connection = newFakeConnection()
          const tx = newTransaction({ connection })

          tx._begin(async () => Bookmarks.empty(), TxConfig.empty())

          await operation(tx, connection)
          const rollbackInvokedAfterOperation = connection.rollbackInvoked

          await tx.close()

          expect(connection.rollbackInvoked).toEqual(rollbackInvokedAfterOperation)
        })
      })
    })

    fn()
  })
}

type TransactionFactory<T extends Transaction> = (_: {
  connection: FakeConnection
  fetchSize?: number
  highRecordWatermark?: number
  lowRecordWatermark?: number
}) => T

function newTransactionPromise ({
  connection,
  fetchSize = 1000,
  highRecordWatermark = 700,
  lowRecordWatermark = 300,
  errorResolvingConnection = undefined
}: {
  connection?: FakeConnection
  fetchSize?: number
  highRecordWatermark?: number
  lowRecordWatermark?: number
  errorResolvingConnection?: Error
}): TransactionPromise {
  const connectionProvider = new ConnectionProvider()
  // @ts-expect-error
  connectionProvider.acquireConnection = async () => {
    if (errorResolvingConnection != null) {
      return await Promise.reject(errorResolvingConnection)
    }
    return await Promise.resolve(connection)
  }
  connectionProvider.close = async () => await Promise.resolve()

  const connectionHolder = new ConnectionHolder({ connectionProvider })
  connectionHolder.initializeConnection()

  const transaction = new TransactionPromise({
    connectionHolder,
    onClose: () => { },
    onBookmarks: (_: Bookmarks) => { },
    onConnection: () => { },
    reactive: false,
    fetchSize,
    impersonatedUser: '',
    highRecordWatermark,
    lowRecordWatermark
  })

  return transaction
}

function newRegularTransaction ({
  connection,
  fetchSize = 1000,
  highRecordWatermark = 700,
  lowRecordWatermark = 300
}: {
  connection: FakeConnection
  fetchSize?: number
  highRecordWatermark?: number
  lowRecordWatermark?: number
}): Transaction {
  const connectionProvider = new ConnectionProvider()
  connectionProvider.acquireConnection = async () => await Promise.resolve(connection)
  connectionProvider.close = async () => await Promise.resolve()

  const connectionHolder = new ConnectionHolder({ connectionProvider })
  connectionHolder.initializeConnection()

  const transaction = new Transaction({
    connectionHolder,
    onClose: () => { },
    onBookmarks: (_: Bookmarks) => { },
    onConnection: () => { },
    reactive: false,
    fetchSize,
    impersonatedUser: '',
    highRecordWatermark,
    lowRecordWatermark
  })

  return transaction
}

function newFakeConnection (): FakeConnection {
  return new FakeConnection()
}

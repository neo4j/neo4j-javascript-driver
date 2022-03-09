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

import { ConnectionProvider, newError, Transaction, TransactionPromise } from "../src";
import { Bookmarks } from "../src/internal/bookmarks";
import { ConnectionHolder } from "../src/internal/connection-holder";
import { TxConfig } from "../src/internal/tx-config";
import ManagedTransaction from "../src/transaction-managed";
import FakeConnection from "./utils/connection.fake";


testTx('Transaction', newRegularTransaction)
testTx('ManagedTransaction', newManagedTransaction)

testTx('TransactionPromise', newTransactionPromise, () => {
  describe('Promise', () => {
    const syncContext = (fn: () => void) => fn()
    const asyncContext = (fn: () => void) => setImmediate(fn)

    whenBeginSucceed('async', asyncContext)
    whenBeginSucceed('sync', syncContext)

    function whenBeginSucceed(ctxName: string, ctx: (_: () => void) => void) {
      describe(`when begin processed with success [${ctxName}]`, () => {
        it('should result resolve with Transaction', async () => {
          const [tx] = setupTx()

          const resolveTx: Transaction = await tx;

          // @ts-ignore
          expect(resolveTx.then).toBeUndefined()
          // @ts-ignore
          expect(resolveTx.catch).toBeUndefined()
          // @ts-ignore
          expect(resolveTx.finally).toBeUndefined()

          expect(resolveTx.commit).toBeDefined()
          expect(resolveTx.rollback).toBeDefined()
          expect(resolveTx.close).toBeDefined()
          expect(resolveTx.run).toBeDefined()
          expect(resolveTx.isOpen).toBeDefined()
        })

        it('should resolve an open Transaction', async () => {
          const [tx] = setupTx()

          const resolved = await tx;

          expect(resolved.isOpen()).toBe(true)
        })

        it('should be able to run queries in the resolved transaction', async () => {
          const [tx] = setupTx()

          const resolvedTx = await tx

          await resolvedTx.run('RETURN 1');
        })

        it('should be able to commit the resolved transaction', async () => {
          const [tx] = setupTx()

          const resolvedTx = await tx

          await resolvedTx.commit();
        })

        it('should be able to rollback the resolved transaction', async () => {
          const [tx] = setupTx()

          const resolvedTx = await tx

          await resolvedTx.rollback();
        })

        it('should be able to close the resolved transaction', async () => {
          const [tx] = setupTx()

          const resolvedTx = await tx

          await resolvedTx.close();
        })

        it('should the original tx be open', async () => {
          const [tx] = setupTx()

          await tx;

          expect(tx.isOpen()).toBe(true)
        })

        it('should be able to run queries in the original transaction', async () => {
          const [tx] = setupTx()

          await tx

          await tx.run('RETURN 1');
        })

        it('should be able to commit the original transaction', async () => {
          const [tx] = setupTx()

          await tx

          await tx.commit();
        })

        it('should be able to rollback the original transaction', async () => {
          const [tx] = setupTx()

          await tx

          await tx.rollback();
        })

        it('should be able to close the original transaction', async () => {
          const [tx] = setupTx()

          await tx

          await tx.close();
        })

        function setupTx(): [TransactionPromise] {
          const connection = newFakeConnection()
          const protocol = connection.protocol()

          // @ts-ignore
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

          tx._begin(Bookmarks.empty(), TxConfig.empty())

          return [tx]
        }

      })
    }


    whenBeginFails('async', asyncContext)
    whenBeginFails('sync', syncContext)

    function whenBeginFails(ctxName: string, ctx: (fn: () => void) => void) {
      describe(`when begin fails [${ctxName}]`, () => {
        it('should fails to resolve the transaction', async () => {
          const [tx, expectedError] = setupTx()

          try {
            await tx;
            fail('should have thrown')
          } catch (e) {
            expect(e).toEqual(expectedError)
          }
        })

        it('should be closed', async () => {
          const [tx] = setupTx()

          try {
            await tx;
          } catch (e) {
            // thats fine
          }

          expect(tx.isOpen()).toBe(false)
        })

        it('should not be able to run queries in the original transaction', async () => {
          const [tx] = setupTx()

          try {
            await tx;
          } catch (e) {
            // thats fine
          }

          try {
            await tx.run('RETURN 1');
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
            await tx;
          } catch (e) {
            // thats fine
          }

          try {
            await tx.commit();
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
            await tx;
          } catch (e) {
            // thats fine
          }

          await tx.rollback();
        })

        it('should be able to close the original transaction', async () => {
          const [tx] = setupTx()

          try {
            await tx;
          } catch (e) {
            // thats fine
          }

          await tx.close();
        })

        function setupTx(): [TransactionPromise, Error] {
          const connection = newFakeConnection()
          const protocol = connection.protocol()
          const expectedError = newError('begin error')

          // @ts-ignore
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

          tx._begin(Bookmarks.empty(), TxConfig.empty())
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

        tx._begin(Bookmarks.empty(), TxConfig.empty())

        try {
          await tx;
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

        tx._begin(Bookmarks.empty(), TxConfig.empty())

        try {
          await tx;
          fail('should have thrown')
        } catch (e) {
          expect(e).toEqual(expectedError)
        }
      })
    })
  })
})

function testTx<T extends Transaction>(transactionName: string, newTransaction: TransactionFactory<T>, fn: jest.EmptyFunction = () => { }) {
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

        var result = tx.run('RETURN 1')

        // @ts-ignore
        expect(result._watermarks).toEqual({ high: 700, low: 300 })
      })

    })

    describe('.close()', () => {
      describe('when transaction is open', () => {
        it('should roll back the transaction', async () => {
          const connection = newFakeConnection()
          const tx = newTransaction({ connection })

          await tx.run('RETURN 1')
          await tx.close()

          expect(connection.rollbackInvoked).toEqual(1)
        })

        it('should surface errors during the rollback', async () => {
          const expectedError = new Error('rollback error')
          const connection = newFakeConnection().withRollbackError(expectedError)
          const tx = newTransaction({ connection })

          await tx.run('RETURN 1')

          try {
            await tx.close()
            fail('should have thrown')
          } catch (error) {
            expect(error).toEqual(expectedError)
          }
        })
      })

      describe('when transaction is closed', () => {
        const commit = async (tx: Transaction) => tx.commit()
        const rollback = async (tx: Transaction) => tx.rollback()
        const error = async (tx: Transaction, conn: FakeConnection) => {
          conn.withRollbackError(new Error('rollback error'))
          return tx.rollback().catch(() => { })
        }

        it.each([
          ['commmited', commit],
          ['rolled back', rollback],
          ['with error', error]
        ])('should not roll back the connection', async (_, operation) => {
          const connection = newFakeConnection()
          const tx = newTransaction({ connection })

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

interface TransactionFactory<T extends Transaction> {
  (_: {
    connection: FakeConnection
    fetchSize?: number
    highRecordWatermark?: number,
    lowRecordWatermark?: number
  }): T
}

function newTransactionPromise({
  connection,
  fetchSize = 1000,
  highRecordWatermark = 700,
  lowRecordWatermark = 300,
  errorResolvingConnection = undefined
}: {
  connection: FakeConnection | void
  fetchSize?: number
  highRecordWatermark?: number,
  lowRecordWatermark?: number
  errorResolvingConnection?: Error
}): TransactionPromise {
  const connectionProvider = new ConnectionProvider()
  // @ts-ignore
  connectionProvider.acquireConnection = () => {
    if (errorResolvingConnection) {
      return Promise.reject(errorResolvingConnection)
    }
    return Promise.resolve(connection)
  }
  connectionProvider.close = () => Promise.resolve()

  const connectionHolder = new ConnectionHolder({ connectionProvider })
  connectionHolder.initializeConnection()

  const transaction = new TransactionPromise({
    connectionHolder,
    onClose: () => { },
    onBookmarks: (_: Bookmarks) => { },
    onConnection: () => { },
    reactive: false,
    fetchSize,
    impersonatedUser: "",
    highRecordWatermark,
    lowRecordWatermark
  })

  return transaction
}

function newRegularTransaction({
  connection,
  fetchSize = 1000,
  highRecordWatermark = 700,
  lowRecordWatermark = 300
}: {
  connection: FakeConnection
  fetchSize?: number
  highRecordWatermark?: number,
  lowRecordWatermark?: number
}): Transaction {
  const connectionProvider = new ConnectionProvider()
  connectionProvider.acquireConnection = () => Promise.resolve(connection)
  connectionProvider.close = () => Promise.resolve()

  const connectionHolder = new ConnectionHolder({ connectionProvider })
  connectionHolder.initializeConnection()

  const transaction = new Transaction({
    connectionHolder,
    onClose: () => { },
    onBookmarks: (_: Bookmarks) => { },
    onConnection: () => { },
    reactive: false,
    fetchSize,
    impersonatedUser: "",
    highRecordWatermark,
    lowRecordWatermark
  })

  return transaction
}

function newManagedTransaction({
  connection,
  fetchSize = 1000,
  highRecordWatermark = 700,
  lowRecordWatermark = 300
}: {
  connection: FakeConnection
  fetchSize?: number
  highRecordWatermark?: number,
  lowRecordWatermark?: number
}): ManagedTransaction {
  const connectionProvider = new ConnectionProvider()
  connectionProvider.acquireConnection = () => Promise.resolve(connection)
  connectionProvider.close = () => Promise.resolve()

  const connectionHolder = new ConnectionHolder({ connectionProvider })
  connectionHolder.initializeConnection()

  const transaction = new ManagedTransaction({
    connectionHolder,
    onClose: () => { },
    onBookmarks: (_: Bookmarks) => { },
    onConnection: () => { },
    reactive: false,
    fetchSize,
    impersonatedUser: "",
    highRecordWatermark,
    lowRecordWatermark
  })

  return transaction
}

function newFakeConnection(): FakeConnection {
  return new FakeConnection()
}

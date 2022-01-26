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

import { ConnectionProvider, Transaction } from "../src";
import { Bookmark } from "../src/internal/bookmark";
import { ConnectionHolder } from "../src/internal/connection-holder";
import FakeConnection from "./utils/connection.fake";

describe('Transaction', () => {

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
})

function newTransaction({
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
    onBookmark: (_: Bookmark) => { },
    onConnection: () => { },
    reactive: false,
    fetchSize,
    impersonatedUser: ""
  })

  return transaction
}

function newFakeConnection(): FakeConnection {
  return new FakeConnection()
}

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

})

function newTransaction({
  connection,
  fetchSize = 1000,
  highRecordWatermark = 700,
  lowRecordWatermark = 300
}: {
  connection: FakeConnection
  fetchSize: number
  highRecordWatermark: number,
  lowRecordWatermark: number
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
    impersonatedUser: "",
    highRecordWatermark,
    lowRecordWatermark
  })

  return transaction
}

function newFakeConnection(): FakeConnection {
  return new FakeConnection()
}

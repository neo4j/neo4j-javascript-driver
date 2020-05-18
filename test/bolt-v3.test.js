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

import neo4j from '../src'
import sharedNeo4j from './internal/shared-neo4j'

const TX_CONFIG_WITH_METADATA = { metadata: { a: 1, b: 2 } }
const TX_CONFIG_WITH_TIMEOUT = { timeout: 42 }

const INVALID_TIMEOUT_VALUES = [0, -1, -42, '15 seconds', [1, 2, 3]]
const INVALID_METADATA_VALUES = [
  'metadata',
  ['1', '2', '3'],
  () => 'hello world'
]

describe('#integration Bolt V3 API', () => {
  let driver
  let session
  let protocolVersion
  let originalTimeout

  beforeEach(async () => {
    driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken)
    session = driver.session()
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000

    protocolVersion = await sharedNeo4j.cleanupAndGetProtocolVersion(driver)
  })

  afterEach(async () => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout
    await session.close()
    await driver.close()
  })

  it('should set transaction metadata for auto-commit transaction', async () => {
    if (!databaseSupportsBoltV3()) {
      return
    }

    const metadata = {
      a: 'hello world',
      b: 424242,
      c: [true, false, true]
    }

    // call listTransactions procedure that should list itself with the specified metadata
    const result = await session.run(
      'CALL dbms.listTransactions()',
      {},
      { metadata: metadata }
    )
    const receivedMetadatas = result.records.map(r => r.get('metaData'))
    expect(receivedMetadatas).toContain(metadata)
  })

  it('should set transaction timeout for auto-commit transaction', async () => {
    if (!databaseSupportsBoltV3()) {
      return
    }

    await session.run('CREATE (:Node)') // create a dummy node

    const otherSession = driver.session()
    const tx = otherSession.beginTransaction()
    await tx.run('MATCH (n:Node) SET n.prop = 1') // lock dummy node but keep the transaction open

    // run a query in an auto-commit transaction with timeout and try to update the locked dummy node
    try {
      await session.run(
        'MATCH (n:Node) SET n.prop = $newValue',
        { newValue: 2 },
        { timeout: 1 }
      )
    } catch (e) {
      // ClientError on 4.1 and later
      if (
        e.code != 'Neo.ClientError.Transaction.TransactionTimedOut' &&
        e.code != 'Neo.TransientError.Transaction.LockClientStopped'
      ) {
        fail('Expected transaction timeout error but got: ' + e.code)
      }
    }
    await tx.rollback()
    await otherSession.close()
  })

  it('should set transaction metadata with read transaction function', () =>
    testTransactionMetadataWithTransactionFunctions(true))

  it('should set transaction metadata with write transaction function', () =>
    testTransactionMetadataWithTransactionFunctions(false))

  it('should fail auto-commit transaction with metadata when database does not support Bolt V3', () =>
    testAutoCommitTransactionConfigWhenBoltV3NotSupported(
      TX_CONFIG_WITH_METADATA
    ))

  it('should fail auto-commit transaction with timeout when database does not support Bolt V3', () =>
    testAutoCommitTransactionConfigWhenBoltV3NotSupported(
      TX_CONFIG_WITH_TIMEOUT
    ))

  it('should fail read transaction function with metadata when database does not support Bolt V3', () =>
    testTransactionFunctionConfigWhenBoltV3NotSupported(
      true,
      TX_CONFIG_WITH_METADATA
    ))

  it('should fail read transaction function with timeout when database does not support Bolt V3', () =>
    testTransactionFunctionConfigWhenBoltV3NotSupported(
      true,
      TX_CONFIG_WITH_TIMEOUT
    ))

  it('should fail write transaction function with metadata when database does not support Bolt V3', () =>
    testTransactionFunctionConfigWhenBoltV3NotSupported(
      false,
      TX_CONFIG_WITH_METADATA
    ))

  it('should fail write transaction function with timeout when database does not support Bolt V3', () =>
    testTransactionFunctionConfigWhenBoltV3NotSupported(
      false,
      TX_CONFIG_WITH_TIMEOUT
    ))

  it('should set transaction metadata for explicit transactions', async () => {
    if (!databaseSupportsBoltV3()) {
      return
    }

    const metadata = {
      a: 12345,
      b: 'string',
      c: [1, 2, 3]
    }

    const tx = session.beginTransaction({ metadata: metadata })

    // call listTransactions procedure that should list itself with the specified metadata
    const result = await tx.run('CALL dbms.listTransactions()')
    const receivedMetadatas = result.records.map(r => r.get('metaData'))
    expect(receivedMetadatas).toContain(metadata)

    await tx.commit()
  })

  it('should set transaction timeout for explicit transactions', async () => {
    if (!databaseSupportsBoltV3()) {
      return
    }

    await session.run('CREATE (:Node)') // create a dummy node

    const otherSession = driver.session()
    const otherTx = otherSession.beginTransaction()
    await otherTx.run('MATCH (n:Node) SET n.prop = 1') // lock dummy node but keep the transaction open

    // run a query in an explicit transaction with timeout and try to update the locked dummy node
    const tx = session.beginTransaction({ timeout: 1 })
    try {
      await tx.run(
        'MATCH (n:Node) SET n.prop = $newValue',
        { newValue: 2 },
        { timeout: 1 }
      )
    } catch (e) {
      // ClientError on 4.1 and later
      if (
        e.code != 'Neo.ClientError.Transaction.TransactionTimedOut' &&
        e.code != 'Neo.TransientError.Transaction.LockClientStopped'
      ) {
        fail('Expected transaction timeout error but got: ' + e.code)
      }
    }

    await otherTx.rollback()
    await otherSession.close()
  })

  it('should fail to run in explicit transaction with metadata when database does not support Bolt V3', () =>
    testRunInExplicitTransactionWithConfigWhenBoltV3NotSupported(
      TX_CONFIG_WITH_METADATA
    ))

  it('should fail to run in explicit transaction with timeout when database does not support Bolt V3', () =>
    testRunInExplicitTransactionWithConfigWhenBoltV3NotSupported(
      TX_CONFIG_WITH_TIMEOUT
    ))

  it('should fail to commit explicit transaction with metadata when database does not support Bolt V3', () =>
    testCloseExplicitTransactionWithConfigWhenBoltV3NotSupported(
      true,
      TX_CONFIG_WITH_METADATA
    ))

  it('should fail to commit explicit transaction with timeout when database does not support Bolt V3', () =>
    testCloseExplicitTransactionWithConfigWhenBoltV3NotSupported(
      true,
      TX_CONFIG_WITH_TIMEOUT
    ))

  it('should fail to rollback explicit transaction with metadata when database does not support Bolt V3', () =>
    testCloseExplicitTransactionWithConfigWhenBoltV3NotSupported(
      false,
      TX_CONFIG_WITH_METADATA
    ))

  it('should fail to rollback explicit transaction with timeout when database does not support Bolt V3', () =>
    testCloseExplicitTransactionWithConfigWhenBoltV3NotSupported(
      false,
      TX_CONFIG_WITH_TIMEOUT
    ))

  it('should fail to run auto-commit transaction with invalid timeout', () => {
    INVALID_TIMEOUT_VALUES.forEach(invalidValue =>
      expect(() =>
        session.run('RETURN $x', { x: 42 }, { timeout: invalidValue })
      ).toThrow()
    )
  })

  it('should fail to run auto-commit transaction with invalid metadata', () => {
    INVALID_METADATA_VALUES.forEach(invalidValue =>
      expect(() =>
        session.run('RETURN $x', { x: 42 }, { metadata: invalidValue })
      ).toThrow()
    )
  })

  it('should fail to begin explicit transaction with invalid timeout', () => {
    INVALID_TIMEOUT_VALUES.forEach(invalidValue =>
      expect(() =>
        session.beginTransaction({ timeout: invalidValue })
      ).toThrow()
    )
  })

  it('should fail to begin explicit transaction with invalid metadata', () => {
    INVALID_METADATA_VALUES.forEach(invalidValue =>
      expect(() =>
        session.beginTransaction({ metadata: invalidValue })
      ).toThrow()
    )
  })

  it('should fail to run read transaction function with invalid timeout', () => {
    INVALID_TIMEOUT_VALUES.forEach(invalidValue =>
      expect(() =>
        session.readTransaction(tx => tx.run('RETURN 1'), {
          timeout: invalidValue
        })
      ).toThrow()
    )
  })

  it('should fail to run read transaction function with invalid metadata', () => {
    INVALID_METADATA_VALUES.forEach(invalidValue =>
      expect(() =>
        session.readTransaction(tx => tx.run('RETURN 1'), {
          metadata: invalidValue
        })
      ).toThrow()
    )
  })

  it('should fail to run write transaction function with invalid timeout', () => {
    INVALID_TIMEOUT_VALUES.forEach(invalidValue =>
      expect(() =>
        session.writeTransaction(tx => tx.run('RETURN 1'), {
          timeout: invalidValue
        })
      ).toThrow()
    )
  })

  it('should fail to run write transaction function with invalid metadata', () => {
    INVALID_METADATA_VALUES.forEach(invalidValue =>
      expect(() =>
        session.writeTransaction(tx => tx.run('RETURN 1'), {
          metadata: invalidValue
        })
      ).toThrow()
    )
  })

  it('should use bookmarks for auto commit transactions', async () => {
    if (!databaseSupportsBoltV3()) {
      return
    }

    const initialBookmark = session.lastBookmark()

    await session.run('CREATE ()')
    const bookmark1 = session.lastBookmark()
    expect(bookmark1).not.toBeNull()
    expect(bookmark1).toBeDefined()
    expect(bookmark1).not.toEqual(initialBookmark)

    await session.run('CREATE ()')
    const bookmark2 = session.lastBookmark()
    expect(bookmark2).not.toBeNull()
    expect(bookmark2).toBeDefined()
    expect(bookmark2).not.toEqual(initialBookmark)
    expect(bookmark2).not.toEqual(bookmark1)

    await session.run('CREATE ()')
    const bookmark3 = session.lastBookmark()
    expect(bookmark3).not.toBeNull()
    expect(bookmark3).toBeDefined()
    expect(bookmark3).not.toEqual(initialBookmark)
    expect(bookmark3).not.toEqual(bookmark1)
    expect(bookmark3).not.toEqual(bookmark2)
  })

  it('should use bookmarks for auto commit and explicit transactions', async () => {
    if (!databaseSupportsBoltV3()) {
      return
    }

    const initialBookmark = session.lastBookmark()

    const tx1 = session.beginTransaction()
    await tx1.run('CREATE ()')
    await tx1.commit()
    const bookmark1 = session.lastBookmark()
    expect(bookmark1).not.toBeNull()
    expect(bookmark1).toBeDefined()
    expect(bookmark1).not.toEqual(initialBookmark)

    await session.run('CREATE ()')
    const bookmark2 = session.lastBookmark()
    expect(bookmark2).not.toBeNull()
    expect(bookmark2).toBeDefined()
    expect(bookmark2).not.toEqual(initialBookmark)
    expect(bookmark2).not.toEqual(bookmark1)

    const tx2 = session.beginTransaction()
    await tx2.run('CREATE ()')
    await tx2.commit()
    const bookmark3 = session.lastBookmark()
    expect(bookmark3).not.toBeNull()
    expect(bookmark3).toBeDefined()
    expect(bookmark3).not.toEqual(initialBookmark)
    expect(bookmark3).not.toEqual(bookmark1)
    expect(bookmark3).not.toEqual(bookmark2)
  })

  it('should use bookmarks for auto commit transactions and transaction functions', async () => {
    if (!databaseSupportsBoltV3()) {
      return
    }

    const initialBookmark = session.lastBookmark()

    await session.writeTransaction(tx => tx.run('CREATE ()'))
    const bookmark1 = session.lastBookmark()
    expect(bookmark1).not.toBeNull()
    expect(bookmark1).toBeDefined()
    expect(bookmark1).not.toEqual(initialBookmark)

    await session.run('CREATE ()')
    const bookmark2 = session.lastBookmark()
    expect(bookmark2).not.toBeNull()
    expect(bookmark2).toBeDefined()
    expect(bookmark2).not.toEqual(initialBookmark)
    expect(bookmark2).not.toEqual(bookmark1)

    await session.writeTransaction(tx => tx.run('CREATE ()'))
    const bookmark3 = session.lastBookmark()
    expect(bookmark3).not.toBeNull()
    expect(bookmark3).toBeDefined()
    expect(bookmark3).not.toEqual(initialBookmark)
    expect(bookmark3).not.toEqual(bookmark1)
    expect(bookmark3).not.toEqual(bookmark2)
  })

  async function testTransactionMetadataWithTransactionFunctions (read) {
    if (!databaseSupportsBoltV3()) {
      return
    }

    const metadata = {
      foo: 'bar',
      baz: 42
    }

    const txFunctionWithMetadata = work =>
      read
        ? session.readTransaction(work, { metadata: metadata })
        : session.writeTransaction(work, { metadata: metadata })

    const result = await txFunctionWithMetadata(tx =>
      tx.run('CALL dbms.listTransactions()')
    )
    const receivedMetadatas = result.records.map(r => r.get('metaData'))
    expect(receivedMetadatas).toContain(metadata)
  }

  async function testAutoCommitTransactionConfigWhenBoltV3NotSupported (
    txConfig
  ) {
    if (databaseSupportsBoltV3()) {
      return
    }

    await expectAsync(
      session.run('RETURN $x', { x: 42 }, txConfig)
    ).toBeRejectedWith(
      jasmine.objectContaining({
        message: jasmine.stringMatching(
          /Driver is connected to the database that does not support transaction configuration/
        )
      })
    )
  }

  async function testTransactionFunctionConfigWhenBoltV3NotSupported (
    read,
    txConfig
  ) {
    if (databaseSupportsBoltV3()) {
      return
    }

    const txFunctionWithMetadata = work =>
      read
        ? session.readTransaction(work, txConfig)
        : session.writeTransaction(work, txConfig)

    await expectAsync(
      txFunctionWithMetadata(tx => tx.run('RETURN 42'))
    ).toBeRejectedWith(
      jasmine.objectContaining({
        message: jasmine.stringMatching(
          /Driver is connected to the database that does not support transaction configuration/
        )
      })
    )
  }

  async function testRunInExplicitTransactionWithConfigWhenBoltV3NotSupported (
    txConfig
  ) {
    if (databaseSupportsBoltV3()) {
      return
    }

    const tx = session.beginTransaction(txConfig)

    await expectAsync(tx.run('RETURN 42')).toBeRejectedWith(
      jasmine.objectContaining({
        message: jasmine.stringMatching(
          /Driver is connected to the database that does not support transaction configuration/
        )
      })
    )
  }

  async function testCloseExplicitTransactionWithConfigWhenBoltV3NotSupported (
    commit,
    txConfig
  ) {
    if (databaseSupportsBoltV3()) {
      return
    }

    const tx = session.beginTransaction(txConfig)

    await expectAsync(commit ? tx.commit() : tx.rollback()).toBeRejectedWith(
      jasmine.objectContaining({
        message: jasmine.stringMatching(
          /Driver is connected to the database that does not support transaction configuration/
        )
      })
    )
  }

  function databaseSupportsBoltV3 () {
    return protocolVersion >= 3
  }
})

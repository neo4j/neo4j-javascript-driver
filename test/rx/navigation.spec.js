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
import neo4j from '../../src'
import sharedNeo4j from '../internal/shared-neo4j'
import RxSession from '../../src/session-rx'
import { Notification, Observable } from 'rxjs'
import { materialize, toArray, map } from 'rxjs/operators'
import RxTransaction from '../../src/transaction-rx'

describe('#integration-rx navigation', () => {
  describe('session', () => {
    let driver
    /** @type {RxSession} */
    let session
    /** @type {number} */
    let protocolVersion
    let originalTimeout

    beforeEach(async () => {
      driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken)
      session = driver.rxSession()
      originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL
      jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000

      protocolVersion = await sharedNeo4j.cleanupAndGetProtocolVersion(driver)
    })

    afterEach(async () => {
      jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout
      if (session) {
        await session.close().toPromise()
      }
      await driver.close()
    })

    it('should return keys', () => shouldReturnKeys(protocolVersion, session))

    it('should return summary', () =>
      shouldReturnSummary(protocolVersion, session))

    it('should return keys and records', () =>
      shouldReturnKeysAndRecords(protocolVersion, session))

    it('should return records and summary', () =>
      shouldReturnRecordsAndSummary(protocolVersion, session))

    it('should return keys, records and summary', () =>
      shouldReturnKeysRecordsAndSummary(protocolVersion, session))

    it('should return keys and summary but no records', () =>
      shouldReturnKeysAndSummaryButRecords(protocolVersion, session))

    it('should return keys even after records are complete', () =>
      shouldReturnKeysEvenAfterRecordsAreComplete(protocolVersion, session))

    it('should return keys even after summary is complete', () =>
      shouldReturnKeysEvenAfterSummaryIsComplete(protocolVersion, session))

    it('should return keys multiple times', () =>
      shouldReturnKeysMultipleTimes(protocolVersion, session))

    it('should return summary multiple times', () =>
      shouldReturnSummaryMultipleTimes(protocolVersion, session))

    it('should return records only once', () =>
      shouldReturnRecordsOnlyOnce(protocolVersion, session))

    it('should return empty keys for query without return', () =>
      shouldReturnEmptyKeysForQueryWithNoReturn(protocolVersion, session))

    it('should return no records for query without return', () =>
      shouldReturnNoRecordsForQueryWithNoReturn(protocolVersion, session))

    it('should return summary for query without return', () =>
      shouldReturnSummaryForQueryWithNoReturn(protocolVersion, session))

    it('should fail on keys when run fails', () =>
      shouldFailOnKeysWhenRunFails(protocolVersion, session))

    it('should fail on subsequent keys when run fails', () =>
      shouldFailOnSubsequentKeysWhenRunFails(protocolVersion, session))

    it('should fail on records when run fails', () =>
      shouldFailOnRecordsWhenRunFails(protocolVersion, session))

    it('should fail on subsequent records differently when run fails', () =>
      shouldFailOnSubsequentRecordsWhenRunFails(protocolVersion, session))

    it('should fail on summary when run fails', () =>
      shouldFailOnSummaryWhenRunFails(protocolVersion, session))

    it('should fail on subsequent summary when run fails', () =>
      shouldFailOnSubsequentSummaryWhenRunFails(protocolVersion, session))

    it('should fail on result when closed', () =>
      shouldFailOnResultWhenClosed(protocolVersion, session, () =>
        session.close()
      ))
  })

  describe('transaction', () => {
    let driver
    /** @type {RxSession} */
    let session
    /** @type {RxTransaction} */
    let txc
    /** @type {number} */
    let protocolVersion
    let originalTimeout

    beforeEach(async () => {
      driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken)
      session = driver.rxSession()
      txc = await session.beginTransaction().toPromise()
      originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL
      jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000

      const normalSession = driver.session()
      try {
        const result = await normalSession.run('MATCH (n) DETACH DELETE n')
        protocolVersion = result.summary.server.protocolVersion
      } finally {
        await normalSession.close()
      }
    })

    afterEach(async () => {
      jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout
      if (txc) {
        try {
          await txc.commit().toPromise()
        } catch (err) {
          // ignore
        }
      }
      if (session) {
        await session.close().toPromise()
      }
      await driver.close()
    })

    it('should return keys', () => shouldReturnKeys(protocolVersion, txc))

    it('should return summary', () => shouldReturnSummary(protocolVersion, txc))

    it('should return keys and records', () =>
      shouldReturnKeysAndRecords(protocolVersion, txc))

    it('should return records and summary', () =>
      shouldReturnRecordsAndSummary(protocolVersion, txc))

    it('should return keys, records and summary', () =>
      shouldReturnKeysRecordsAndSummary(protocolVersion, txc))

    it('should return keys and summary but no records', () =>
      shouldReturnKeysAndSummaryButRecords(protocolVersion, txc))

    it('should return keys even after records are complete', () =>
      shouldReturnKeysEvenAfterRecordsAreComplete(protocolVersion, txc))

    it('should return keys even after summary is complete', () =>
      shouldReturnKeysEvenAfterSummaryIsComplete(protocolVersion, txc))

    it('should return keys multiple times', () =>
      shouldReturnKeysMultipleTimes(protocolVersion, txc))

    it('should return summary multiple times', () =>
      shouldReturnSummaryMultipleTimes(protocolVersion, txc))

    it('should return records only once', () =>
      shouldReturnRecordsOnlyOnce(protocolVersion, txc))

    it('should return empty keys for query without return', () =>
      shouldReturnEmptyKeysForQueryWithNoReturn(protocolVersion, txc))

    it('should return no records for query without return', () =>
      shouldReturnNoRecordsForQueryWithNoReturn(protocolVersion, txc))

    it('should return summary for query without return', () =>
      shouldReturnSummaryForQueryWithNoReturn(protocolVersion, txc))

    it('should fail on keys when run fails', () =>
      shouldFailOnKeysWhenRunFails(protocolVersion, txc))

    it('should fail on subsequent keys when run fails', () =>
      shouldFailOnSubsequentKeysWhenRunFails(protocolVersion, txc))

    it('should fail on records when run fails', () =>
      shouldFailOnRecordsWhenRunFails(protocolVersion, txc))

    it('should fail on subsequent records differently when run fails', () =>
      shouldFailOnSubsequentRecordsWhenRunFails(protocolVersion, txc))

    it('should fail on summary when run fails', () =>
      shouldFailOnSummaryWhenRunFails(protocolVersion, txc))

    it('should fail on subsequent summary when run fails', () =>
      shouldFailOnSubsequentSummaryWhenRunFails(protocolVersion, txc))

    it('should fail on result when committed', () =>
      shouldFailOnResultWhenClosed(protocolVersion, txc, () => txc.commit()))

    it('should fail on result when rolled back', () =>
      shouldFailOnResultWhenClosed(protocolVersion, txc, () => txc.rollback()))
  })

  /**
   * @param {number} protocolVersion
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnKeys (protocolVersion, runnable) {
    if (protocolVersion < 4.0) {
      return
    }

    const result = await runnable
      .run("RETURN 1 as f1, true as f2, 'string' as f3")
      .keys()
      .pipe(materialize(), toArray())
      .toPromise()

    expect(result).toEqual([
      Notification.createNext(['f1', 'f2', 'f3']),
      Notification.createComplete()
    ])
  }

  /**
   * @param {number} protocolVersion
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnSummary (protocolVersion, runnable) {
    if (protocolVersion < 4.0) {
      return
    }

    await collectAndAssertSummary(
      runnable.run("RETURN 1 as f1, true as f2, 'string' as f3")
    )
  }

  /**
   * @param {number} protocolVersion
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnKeysAndRecords (protocolVersion, runnable) {
    if (protocolVersion < 4.0) {
      return
    }

    const result = runnable.run(
      "UNWIND RANGE(1,5) AS n RETURN n as number, 't'+n as text"
    )

    await collectAndAssertKeys(result)
    await collectAndAssertRecords(result)
  }

  /**
   * @param {number} protocolVersion
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnRecordsAndSummary (protocolVersion, runnable) {
    if (protocolVersion < 4.0) {
      return
    }

    const result = runnable.run(
      "UNWIND RANGE(1,5) AS n RETURN n as number, 't'+n as text"
    )

    await collectAndAssertRecords(result)
    await collectAndAssertSummary(result)
  }

  /**
   * @param {number} protocolVersion
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnKeysRecordsAndSummary (protocolVersion, runnable) {
    if (protocolVersion < 4.0) {
      return
    }

    const result = runnable.run(
      "UNWIND RANGE(1,5) AS n RETURN n as number, 't'+n as text"
    )

    await collectAndAssertKeys(result)
    await collectAndAssertRecords(result)
    await collectAndAssertSummary(result)
  }

  /**
   * @param {number} protocolVersion
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnKeysAndSummaryButRecords (
    protocolVersion,
    runnable
  ) {
    if (protocolVersion < 4.0) {
      return
    }

    const result = runnable.run(
      "UNWIND RANGE(1,5) AS n RETURN n as number, 't'+n as text"
    )

    await collectAndAssertKeys(result)
    await collectAndAssertSummary(result)

    const expectedError = jasmine.objectContaining({
      message: jasmine.stringMatching(/Streaming has already started/)
    })
    await collectAndAssertError(result.records(), expectedError)
  }

  /**
   * @param {number} protocolVersion
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnKeysEvenAfterRecordsAreComplete (
    protocolVersion,
    runnable
  ) {
    if (protocolVersion < 4.0) {
      return
    }

    const result = runnable.run(
      "UNWIND RANGE(1,5) AS n RETURN n as number, 't'+n as text"
    )

    await collectAndAssertRecords(result)
    await collectAndAssertKeys(result)
  }

  /**
   * @param {number} protocolVersion
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnKeysEvenAfterSummaryIsComplete (
    protocolVersion,
    runnable
  ) {
    if (protocolVersion < 4.0) {
      return
    }

    const result = runnable.run(
      "UNWIND RANGE(1,5) AS n RETURN n as number, 't'+n as text"
    )

    await collectAndAssertSummary(result)
    await collectAndAssertKeys(result)
  }

  /**
   * @param {number} protocolVersion
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnKeysMultipleTimes (protocolVersion, runnable) {
    if (protocolVersion < 4.0) {
      return
    }

    const result = runnable.run(
      "UNWIND RANGE(1,5) AS n RETURN n as number, 't'+n as text"
    )

    await collectAndAssertKeys(result)
    await collectAndAssertKeys(result)
    await collectAndAssertKeys(result)
    await collectAndAssertKeys(result)
  }

  /**
   * @param {number} protocolVersion
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnSummaryMultipleTimes (protocolVersion, runnable) {
    if (protocolVersion < 4.0) {
      return
    }

    const result = runnable.run(
      "UNWIND RANGE(1,5) AS n RETURN n as number, 't'+n as text"
    )

    await collectAndAssertSummary(result)
    await collectAndAssertSummary(result)
    await collectAndAssertSummary(result)
    await collectAndAssertSummary(result)
  }

  /**
   * @param {number} protocolVersion
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnRecordsOnlyOnce (protocolVersion, runnable) {
    if (protocolVersion < 4.0) {
      return
    }

    const result = runnable.run(
      "UNWIND RANGE(1,5) AS n RETURN n as number, 't'+n as text"
    )

    await collectAndAssertRecords(result)

    const expectedError = jasmine.objectContaining({
      message: jasmine.stringMatching(/Streaming has already started/)
    })
    await collectAndAssertError(result.records(), expectedError)
    await collectAndAssertError(result.records(), expectedError)
    await collectAndAssertError(result.records(), expectedError)
  }

  /**
   * @param {number} protocolVersion
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnEmptyKeysForQueryWithNoReturn (
    protocolVersion,
    runnable
  ) {
    if (protocolVersion < 4.0) {
      return
    }

    const keys = await runnable
      .run('CREATE ({id : $id})', { id: 5 })
      .keys()
      .pipe(materialize(), toArray())
      .toPromise()
    expect(keys).toEqual([
      Notification.createNext([]),
      Notification.createComplete()
    ])
  }

  /**
   * @param {number} protocolVersion
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnNoRecordsForQueryWithNoReturn (
    protocolVersion,
    runnable
  ) {
    if (protocolVersion < 4.0) {
      return
    }

    await collectAndAssertEmpty(
      runnable.run('CREATE ({id : $id})', { id: 5 }).records()
    )
  }

  /**
   * @param {number} protocolVersion
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnSummaryForQueryWithNoReturn (
    protocolVersion,
    runnable
  ) {
    if (protocolVersion < 4.0) {
      return
    }

    await collectAndAssertSummary(
      runnable.run('CREATE ({id : $id})', { id: 5 }),
      'w'
    )
  }

  /**
   * @param {number} protocolVersion
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldFailOnKeysWhenRunFails (protocolVersion, runnable) {
    if (protocolVersion < 4.0) {
      return
    }

    const result = runnable.run('THIS IS NOT A CYPHER')

    await collectAndAssertError(
      result.keys(),
      jasmine.objectContaining({
        code: 'Neo.ClientError.Statement.SyntaxError',
        message: jasmine.stringMatching(/Invalid input/)
      })
    )
  }

  /**
   * @param {number} protocolVersion
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldFailOnSubsequentKeysWhenRunFails (
    protocolVersion,
    runnable
  ) {
    if (protocolVersion < 4.0) {
      return
    }

    const result = runnable.run('THIS IS NOT A CYPHER')
    const expectedError = jasmine.objectContaining({
      code: 'Neo.ClientError.Statement.SyntaxError',
      message: jasmine.stringMatching(/Invalid input/)
    })
    await collectAndAssertError(result.keys(), expectedError)
    await collectAndAssertError(result.keys(), expectedError)
    await collectAndAssertError(result.keys(), expectedError)
  }

  /**
   * @param {number} protocolVersion
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldFailOnRecordsWhenRunFails (protocolVersion, runnable) {
    if (protocolVersion < 4.0) {
      return
    }

    const result = runnable.run('THIS IS NOT A CYPHER')

    await collectAndAssertError(
      result.records(),
      jasmine.objectContaining({
        code: 'Neo.ClientError.Statement.SyntaxError',
        message: jasmine.stringMatching(/Invalid input/)
      })
    )
  }

  /**
   * @param {number} protocolVersion
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldFailOnSubsequentRecordsWhenRunFails (
    protocolVersion,
    runnable
  ) {
    if (protocolVersion < 4.0) {
      return
    }

    const result = runnable.run('THIS IS NOT A CYPHER')

    await collectAndAssertError(
      result.records(),
      jasmine.objectContaining({
        code: 'Neo.ClientError.Statement.SyntaxError',
        message: jasmine.stringMatching(/Invalid input/)
      })
    )

    const expectedError = jasmine.objectContaining({
      message: jasmine.stringMatching(/Streaming has already started/)
    })
    await collectAndAssertError(result.records(), expectedError)
    await collectAndAssertError(result.records(), expectedError)
  }

  /**
   * @param {number} protocolVersion
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldFailOnSummaryWhenRunFails (protocolVersion, runnable) {
    if (protocolVersion < 4.0) {
      return
    }

    const result = runnable.run('THIS IS NOT A CYPHER')

    await collectAndAssertError(
      result.consume(),
      jasmine.objectContaining({
        code: 'Neo.ClientError.Statement.SyntaxError',
        message: jasmine.stringMatching(/Invalid input/)
      })
    )
  }

  /**
   * @param {number} protocolVersion
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldFailOnSubsequentSummaryWhenRunFails (
    protocolVersion,
    runnable
  ) {
    if (protocolVersion < 4.0) {
      return
    }

    const result = runnable.run('THIS IS NOT A CYPHER')
    const expectedError = jasmine.objectContaining({
      code: 'Neo.ClientError.Statement.SyntaxError',
      message: jasmine.stringMatching(/Invalid input/)
    })

    await collectAndAssertError(result.consume(), expectedError)
    await collectAndAssertError(result.consume(), expectedError)
    await collectAndAssertError(result.consume(), expectedError)
  }

  /**
   * @param {number} protocolVersion
   * @param {RxSession|RxTransaction} runnable
   * @param {function(): Observable} closeFunc
   */
  async function shouldFailOnResultWhenClosed (
    protocolVersion,
    runnable,
    closeFunc
  ) {
    if (protocolVersion < 4.0) {
      return
    }

    const result = runnable.run('RETURN 1')
    await collectAndAssertEmpty(closeFunc())

    const expectedError = jasmine.objectContaining({
      message: jasmine.stringMatching(/Cannot run query/)
    })
    await collectAndAssertError(result.keys(), expectedError)
    await collectAndAssertError(result.records(), expectedError)
    await collectAndAssertError(result.consume(), expectedError)
  }

  async function collectAndAssertKeys (result) {
    const keys = await result
      .keys()
      .pipe(materialize(), toArray())
      .toPromise()
    expect(keys).toEqual([
      Notification.createNext(['number', 'text']),
      Notification.createComplete()
    ])
  }

  async function collectAndAssertRecords (result) {
    const records = await result
      .records()
      .pipe(
        map(r => [r.get(0), r.get(1)]),
        materialize(),
        toArray()
      )
      .toPromise()
    expect(records).toEqual([
      Notification.createNext([neo4j.int(1), 't1']),
      Notification.createNext([neo4j.int(2), 't2']),
      Notification.createNext([neo4j.int(3), 't3']),
      Notification.createNext([neo4j.int(4), 't4']),
      Notification.createNext([neo4j.int(5), 't5']),
      Notification.createComplete()
    ])
  }

  async function collectAndAssertSummary (result, expectedQueryType = 'r') {
    const summary = await result
      .consume()
      .pipe(
        map(s => s.queryType),
        materialize(),
        toArray()
      )
      .toPromise()
    expect(summary).toEqual([
      Notification.createNext(expectedQueryType),
      Notification.createComplete()
    ])
  }

  async function collectAndAssertEmpty (stream) {
    const result = await stream.pipe(materialize(), toArray()).toPromise()
    expect(result).toEqual([Notification.createComplete()])
  }

  /**
   *
   * @param {Observable} stream
   * @param {function(err: Error): void} expectationFunc
   */
  async function collectAndAssertError (stream, expectedError) {
    const result = await stream.pipe(materialize(), toArray()).toPromise()

    expect(result).toEqual([Notification.createError(expectedError)])
  }
})

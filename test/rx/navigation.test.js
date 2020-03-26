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
import { ServerVersion, VERSION_4_0_0 } from '../../src/internal/server-version'
import RxSession from '../../src/session-rx'
import { Notification, Observable } from 'rxjs'
import { materialize, toArray, map } from 'rxjs/operators'
import RxTransaction from '../../src/transaction-rx'

describe('#integration-rx navigation', () => {
  describe('session', () => {
    let driver
    /** @type {RxSession} */
    let session
    /** @type {ServerVersion} */
    let serverVersion
    let originalTimeout

    beforeEach(async () => {
      driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken)
      session = driver.rxSession()
      originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL
      jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000

      serverVersion = await sharedNeo4j.cleanupAndGetVersion(driver)
    })

    afterEach(async () => {
      jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout
      if (session) {
        await session.close().toPromise()
      }
      await driver.close()
    })

    it('should return keys', () => shouldReturnKeys(serverVersion, session))

    it('should return summary', () =>
      shouldReturnSummary(serverVersion, session))

    it('should return keys and records', () =>
      shouldReturnKeysAndRecords(serverVersion, session))

    it('should return records and summary', () =>
      shouldReturnRecordsAndSummary(serverVersion, session))

    it('should return keys, records and summary', () =>
      shouldReturnKeysRecordsAndSummary(serverVersion, session))

    it('should return keys and summary but no records', () =>
      shouldReturnKeysAndSummaryButRecords(serverVersion, session))

    it('should return keys even after records are complete', () =>
      shouldReturnKeysEvenAfterRecordsAreComplete(serverVersion, session))

    it('should return keys even after summary is complete', () =>
      shouldReturnKeysEvenAfterSummaryIsComplete(serverVersion, session))

    it('should return keys multiple times', () =>
      shouldReturnKeysMultipleTimes(serverVersion, session))

    it('should return summary multiple times', () =>
      shouldReturnSummaryMultipleTimes(serverVersion, session))

    it('should return records only once', () =>
      shouldReturnRecordsOnlyOnce(serverVersion, session))

    it('should return empty keys for query without return', () =>
      shouldReturnEmptyKeysForQueryWithNoReturn(serverVersion, session))

    it('should return no records for query without return', () =>
      shouldReturnNoRecordsForQueryWithNoReturn(serverVersion, session))

    it('should return summary for query without return', () =>
      shouldReturnSummaryForQueryWithNoReturn(serverVersion, session))

    it('should fail on keys when run fails', () =>
      shouldFailOnKeysWhenRunFails(serverVersion, session))

    it('should fail on subsequent keys when run fails', () =>
      shouldFailOnSubsequentKeysWhenRunFails(serverVersion, session))

    it('should fail on records when run fails', () =>
      shouldFailOnRecordsWhenRunFails(serverVersion, session))

    it('should fail on subsequent records differently when run fails', () =>
      shouldFailOnSubsequentRecordsWhenRunFails(serverVersion, session))

    it('should fail on summary when run fails', () =>
      shouldFailOnSummaryWhenRunFails(serverVersion, session))

    it('should fail on subsequent summary when run fails', () =>
      shouldFailOnSubsequentSummaryWhenRunFails(serverVersion, session))

    it('should fail on result when closed', () =>
      shouldFailOnResultWhenClosed(serverVersion, session, () =>
        session.close()
      ))
  })

  describe('transaction', () => {
    let driver
    /** @type {RxSession} */
    let session
    /** @type {RxTransaction} */
    let txc
    /** @type {ServerVersion} */
    let serverVersion
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
        serverVersion = ServerVersion.fromString(result.summary.server.version)
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

    it('should return keys', () => shouldReturnKeys(serverVersion, txc))

    it('should return summary', () => shouldReturnSummary(serverVersion, txc))

    it('should return keys and records', () =>
      shouldReturnKeysAndRecords(serverVersion, txc))

    it('should return records and summary', () =>
      shouldReturnRecordsAndSummary(serverVersion, txc))

    it('should return keys, records and summary', () =>
      shouldReturnKeysRecordsAndSummary(serverVersion, txc))

    it('should return keys and summary but no records', () =>
      shouldReturnKeysAndSummaryButRecords(serverVersion, txc))

    it('should return keys even after records are complete', () =>
      shouldReturnKeysEvenAfterRecordsAreComplete(serverVersion, txc))

    it('should return keys even after summary is complete', () =>
      shouldReturnKeysEvenAfterSummaryIsComplete(serverVersion, txc))

    it('should return keys multiple times', () =>
      shouldReturnKeysMultipleTimes(serverVersion, txc))

    it('should return summary multiple times', () =>
      shouldReturnSummaryMultipleTimes(serverVersion, txc))

    it('should return records only once', () =>
      shouldReturnRecordsOnlyOnce(serverVersion, txc))

    it('should return empty keys for query without return', () =>
      shouldReturnEmptyKeysForQueryWithNoReturn(serverVersion, txc))

    it('should return no records for query without return', () =>
      shouldReturnNoRecordsForQueryWithNoReturn(serverVersion, txc))

    it('should return summary for query without return', () =>
      shouldReturnSummaryForQueryWithNoReturn(serverVersion, txc))

    it('should fail on keys when run fails', () =>
      shouldFailOnKeysWhenRunFails(serverVersion, txc))

    it('should fail on subsequent keys when run fails', () =>
      shouldFailOnSubsequentKeysWhenRunFails(serverVersion, txc))

    it('should fail on records when run fails', () =>
      shouldFailOnRecordsWhenRunFails(serverVersion, txc))

    it('should fail on subsequent records differently when run fails', () =>
      shouldFailOnSubsequentRecordsWhenRunFails(serverVersion, txc))

    it('should fail on summary when run fails', () =>
      shouldFailOnSummaryWhenRunFails(serverVersion, txc))

    it('should fail on subsequent summary when run fails', () =>
      shouldFailOnSubsequentSummaryWhenRunFails(serverVersion, txc))

    it('should fail on result when committed', () =>
      shouldFailOnResultWhenClosed(serverVersion, txc, () => txc.commit()))

    it('should fail on result when rolled back', () =>
      shouldFailOnResultWhenClosed(serverVersion, txc, () => txc.rollback()))
  })

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnKeys (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const result = await runnable
      .run("RETURN 1 as f1, true as f2, 'string' as f3")
      .keys()
      .pipe(
        materialize(),
        toArray()
      )
      .toPromise()

    expect(result).toEqual([
      Notification.createNext(['f1', 'f2', 'f3']),
      Notification.createComplete()
    ])
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnSummary (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    await collectAndAssertSummary(
      runnable.run("RETURN 1 as f1, true as f2, 'string' as f3")
    )
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnKeysAndRecords (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const result = runnable.run(
      "UNWIND RANGE(1,5) AS n RETURN n as number, 't'+n as text"
    )

    await collectAndAssertKeys(result)
    await collectAndAssertRecords(result)
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnRecordsAndSummary (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const result = runnable.run(
      "UNWIND RANGE(1,5) AS n RETURN n as number, 't'+n as text"
    )

    await collectAndAssertRecords(result)
    await collectAndAssertSummary(result)
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnKeysRecordsAndSummary (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
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
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnKeysAndSummaryButRecords (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
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
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnKeysEvenAfterRecordsAreComplete (
    version,
    runnable
  ) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const result = runnable.run(
      "UNWIND RANGE(1,5) AS n RETURN n as number, 't'+n as text"
    )

    await collectAndAssertRecords(result)
    await collectAndAssertKeys(result)
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnKeysEvenAfterSummaryIsComplete (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const result = runnable.run(
      "UNWIND RANGE(1,5) AS n RETURN n as number, 't'+n as text"
    )

    await collectAndAssertSummary(result)
    await collectAndAssertKeys(result)
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnKeysMultipleTimes (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
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
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnSummaryMultipleTimes (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
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
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnRecordsOnlyOnce (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
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
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnEmptyKeysForQueryWithNoReturn (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const keys = await runnable
      .run('CREATE ({id : $id})', { id: 5 })
      .keys()
      .pipe(
        materialize(),
        toArray()
      )
      .toPromise()
    expect(keys).toEqual([
      Notification.createNext([]),
      Notification.createComplete()
    ])
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnNoRecordsForQueryWithNoReturn (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    await collectAndAssertEmpty(
      runnable.run('CREATE ({id : $id})', { id: 5 }).records()
    )
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnSummaryForQueryWithNoReturn (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    await collectAndAssertSummary(
      runnable.run('CREATE ({id : $id})', { id: 5 }),
      'w'
    )
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldFailOnKeysWhenRunFails (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
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
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldFailOnSubsequentKeysWhenRunFails (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
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
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldFailOnRecordsWhenRunFails (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
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
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldFailOnSubsequentRecordsWhenRunFails (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
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
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldFailOnSummaryWhenRunFails (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
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
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldFailOnSubsequentSummaryWhenRunFails (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
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
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   * @param {function(): Observable} closeFunc
   */
  async function shouldFailOnResultWhenClosed (version, runnable, closeFunc) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
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
      .pipe(
        materialize(),
        toArray()
      )
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
    const result = await stream
      .pipe(
        materialize(),
        toArray()
      )
      .toPromise()
    expect(result).toEqual([Notification.createComplete()])
  }

  /**
   *
   * @param {Observable} stream
   * @param {function(err: Error): void} expectationFunc
   */
  async function collectAndAssertError (stream, expectedError) {
    const result = await stream
      .pipe(
        materialize(),
        toArray()
      )
      .toPromise()

    expect(result).toEqual([Notification.createError(expectedError)])
  }
})

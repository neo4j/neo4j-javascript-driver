/**
 * Copyright (c) 2002-2019 "Neo4j,"
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
import { ServerVersion, VERSION_4_0_0 } from '../../src/internal/server-version'
import RxSession from '../../src/session-rx'
import RxTransaction from '../../src/transaction-rx'
import sharedNeo4j from '../internal/shared-neo4j'

describe('#integration-rx summary', () => {
  describe('session', () => {
    let driver
    /** @type {RxSession} */
    let session
    /** @type {ServerVersion} */
    let serverVersion

    beforeEach(async () => {
      driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken)
      session = driver.rxSession()

      const normalSession = driver.session()
      try {
        const result = await normalSession.run('MATCH (n) DETACH DELETE n')
        serverVersion = ServerVersion.fromString(result.summary.server.version)
      } finally {
        await normalSession.close()
      }

      await dropConstraintsAndIndices(driver)
    })

    afterEach(async () => {
      if (session) {
        await session.close().toPromise()
      }
      driver.close()
    })

    it('should return non-null summary', () =>
      shouldReturnNonNullSummary(serverVersion, session))

    it('should return summary with statement text', () =>
      shouldReturnSummaryWithStatementText(serverVersion, session))

    it('should return summary with statement text and parameters', () =>
      shouldReturnSummaryWithStatementTextAndParams(serverVersion, session))

    it('should return summary with statement type', () =>
      shouldReturnSummaryWithCorrectStatementType(serverVersion, session))

    it('should return summary with correct counters for create', () =>
      shouldReturnSummaryWithUpdateStatisticsForCreate(serverVersion, session))

    it('should return summary with correct counters for delete', () =>
      shouldReturnSummaryWithUpdateStatisticsForDelete(serverVersion, session))

    it('should return summary with correct counters for index create', () =>
      shouldReturnSummaryWithUpdateStatisticsForIndexCreate(
        serverVersion,
        session
      ))

    it('should return summary with correct counters for index drop', () =>
      shouldReturnSummaryWithUpdateStatisticsForIndexDrop(
        serverVersion,
        driver,
        session
      ))

    it('should return summary with correct counters for constraint create', () =>
      shouldReturnSummaryWithUpdateStatisticsForConstraintCreate(
        serverVersion,
        session
      ))

    it('should return summary with correct counters for constraint drop', () =>
      shouldReturnSummaryWithUpdateStatisticsForConstraintDrop(
        serverVersion,
        driver,
        session
      ))

    it('should not return plan or profile', () =>
      shouldNotReturnPlanAndProfile(serverVersion, session))

    it('should return plan but no profile', () =>
      shouldReturnPlanButNoProfile(serverVersion, session))

    it('should return plan and profile', () =>
      shouldReturnPlanAndProfile(serverVersion, session))

    it('should not return notification', () =>
      shouldNotReturnNotification(serverVersion, session))

    it('should return notification', () =>
      shouldReturnNotification(serverVersion, session))
  })

  describe('transaction', () => {
    let driver
    /** @type {RxSession} */
    let session
    /** @type {RxTransaction} */
    let txc
    /** @type {ServerVersion} */
    let serverVersion

    beforeEach(async () => {
      driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken)
      session = driver.rxSession()
      txc = await session.beginTransaction().toPromise()

      const normalSession = driver.session()
      try {
        const result = await normalSession.run('MATCH (n) DETACH DELETE n')
        serverVersion = ServerVersion.fromString(result.summary.server.version)
      } finally {
        await normalSession.close()
      }

      await dropConstraintsAndIndices(driver)
    })

    afterEach(async () => {
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
      driver.close()
    })

    it('should return non-null summary', () =>
      shouldReturnNonNullSummary(serverVersion, txc))

    it('should return summary with statement text', () =>
      shouldReturnSummaryWithStatementText(serverVersion, txc))

    it('should return summary with statement text and parameters', () =>
      shouldReturnSummaryWithStatementTextAndParams(serverVersion, txc))

    it('should return summary with statement type', () =>
      shouldReturnSummaryWithCorrectStatementType(serverVersion, txc))

    it('should return summary with correct counters for create', () =>
      shouldReturnSummaryWithUpdateStatisticsForCreate(serverVersion, txc))

    it('should return summary with correct counters for delete', () =>
      shouldReturnSummaryWithUpdateStatisticsForDelete(serverVersion, txc))

    it('should return summary with correct counters for index create', () =>
      shouldReturnSummaryWithUpdateStatisticsForIndexCreate(serverVersion, txc))

    it('should return summary with correct counters for index drop', () =>
      shouldReturnSummaryWithUpdateStatisticsForIndexDrop(
        serverVersion,
        driver,
        txc
      ))

    it('should return summary with correct counters for constraint create', () =>
      shouldReturnSummaryWithUpdateStatisticsForConstraintCreate(
        serverVersion,
        txc
      ))

    it('should return summary with correct counters for constraint drop', () =>
      shouldReturnSummaryWithUpdateStatisticsForConstraintDrop(
        serverVersion,
        driver,
        txc
      ))

    it('should not return plan or profile', () =>
      shouldNotReturnPlanAndProfile(serverVersion, txc))

    it('should return plan but no profile', () =>
      shouldReturnPlanButNoProfile(serverVersion, txc))

    it('should return plan and profile', () =>
      shouldReturnPlanAndProfile(serverVersion, txc))

    it('should not return notification', () =>
      shouldNotReturnNotification(serverVersion, txc))

    it('should return notification', () =>
      shouldReturnNotification(serverVersion, txc))
  })

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnNonNullSummary (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const summary = await runnable
      .run('UNWIND RANGE(1,10) AS n RETURN n')
      .summary()
      .toPromise()

    expect(summary).toBeDefined()
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnSummaryWithStatementText (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    await verifyStatementTextAndParameters(
      runnable,
      'UNWIND RANGE(1, 10) AS n RETURN n'
    )
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnSummaryWithStatementTextAndParams (
    version,
    runnable
  ) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    await verifyStatementTextAndParameters(
      runnable,
      'UNWIND RANGE(1, $x) AS n RETURN n',
      { x: 100 }
    )
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnSummaryWithCorrectStatementType (
    version,
    runnable
  ) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    await verifyStatementType(runnable, 'CREATE (n)', 'w')
    await verifyStatementType(runnable, 'MATCH (n) RETURN n LIMIT 1', 'r')
    await verifyStatementType(runnable, 'CREATE (n) RETURN n', 'rw')
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnSummaryWithUpdateStatisticsForCreate (
    version,
    runnable
  ) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    await verifyCounters(
      runnable,
      'CREATE (n:Label1 {id: $id1})-[:KNOWS]->(m:Label2 {id: $id2}) RETURN n, m',
      { id1: 10, id2: 20 },
      {
        nodesCreated: 2,
        nodesDeleted: 0,
        relationshipsCreated: 1,
        relationshipsDeleted: 0,
        propertiesSet: 2,
        labelsAdded: 2,
        labelsRemoved: 0,
        indexesAdded: 0,
        indexesRemoved: 0,
        constraintsAdded: 0,
        constraintsRemoved: 0
      }
    )
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnSummaryWithUpdateStatisticsForDelete (
    version,
    runnable
  ) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    // first create the to-be-deleted nodes
    await shouldReturnSummaryWithUpdateStatisticsForCreate(version, runnable)

    await verifyCounters(
      runnable,
      'MATCH (n:Label1)-[r:KNOWS]->(m:Label2) DELETE n, r',
      null,
      {
        nodesCreated: 0,
        nodesDeleted: 1,
        relationshipsCreated: 0,
        relationshipsDeleted: 1,
        propertiesSet: 0,
        labelsAdded: 0,
        labelsRemoved: 0,
        indexesAdded: 0,
        indexesRemoved: 0,
        constraintsAdded: 0,
        constraintsRemoved: 0
      }
    )
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnSummaryWithUpdateStatisticsForIndexCreate (
    version,
    runnable
  ) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    await verifyCounters(runnable, 'CREATE INDEX on :Label(prop)', null, {
      nodesCreated: 0,
      nodesDeleted: 0,
      relationshipsCreated: 0,
      relationshipsDeleted: 0,
      propertiesSet: 0,
      labelsAdded: 0,
      labelsRemoved: 0,
      indexesAdded: 1,
      indexesRemoved: 0,
      constraintsAdded: 0,
      constraintsRemoved: 0
    })
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnSummaryWithUpdateStatisticsForIndexDrop (
    version,
    driver,
    runnable
  ) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    // first create the to-be-dropped index
    const session = driver.session()
    try {
      await session.run('CREATE INDEX on :Label(prop)')
    } finally {
      await session.close()
    }

    await verifyCounters(runnable, 'DROP INDEX on :Label(prop)', null, {
      nodesCreated: 0,
      nodesDeleted: 0,
      relationshipsCreated: 0,
      relationshipsDeleted: 0,
      propertiesSet: 0,
      labelsAdded: 0,
      labelsRemoved: 0,
      indexesAdded: 0,
      indexesRemoved: 1,
      constraintsAdded: 0,
      constraintsRemoved: 0
    })
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnSummaryWithUpdateStatisticsForConstraintCreate (
    version,
    runnable
  ) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    await verifyCounters(
      runnable,
      'CREATE CONSTRAINT ON (book:Book) ASSERT book.isbn IS UNIQUE',
      null,
      {
        nodesCreated: 0,
        nodesDeleted: 0,
        relationshipsCreated: 0,
        relationshipsDeleted: 0,
        propertiesSet: 0,
        labelsAdded: 0,
        labelsRemoved: 0,
        indexesAdded: 0,
        indexesRemoved: 0,
        constraintsAdded: 1,
        constraintsRemoved: 0
      }
    )
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnSummaryWithUpdateStatisticsForConstraintDrop (
    version,
    driver,
    runnable
  ) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    // first create the to-be-dropped index
    const session = driver.session()
    try {
      await session.run(
        'CREATE CONSTRAINT ON (book:Book) ASSERT book.isbn IS UNIQUE'
      )
    } finally {
      await session.close()
    }

    await verifyCounters(
      runnable,
      'DROP CONSTRAINT ON (book:Book) ASSERT book.isbn IS UNIQUE',
      null,
      {
        nodesCreated: 0,
        nodesDeleted: 0,
        relationshipsCreated: 0,
        relationshipsDeleted: 0,
        propertiesSet: 0,
        labelsAdded: 0,
        labelsRemoved: 0,
        indexesAdded: 0,
        indexesRemoved: 0,
        constraintsAdded: 0,
        constraintsRemoved: 1
      }
    )
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldNotReturnPlanAndProfile (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const summary = await runnable
      .run('CREATE (n) RETURN n')
      .summary()
      .toPromise()
    expect(summary).toBeDefined()
    expect(summary.hasPlan()).toBeFalsy()
    expect(summary.plan).toBeFalsy()
    expect(summary.hasProfile()).toBeFalsy()
    expect(summary.profile).toBeFalsy()
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnPlanButNoProfile (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const summary = await runnable
      .run('EXPLAIN CREATE (n) RETURN n')
      .summary()
      .toPromise()
    expect(summary).toBeDefined()
    expect(summary.hasPlan()).toBeTruthy()
    expect(summary.plan.operatorType).toBe('ProduceResults')
    expect(summary.plan.identifiers).toEqual(['n'])
    expect(summary.hasProfile()).toBeFalsy()
    expect(summary.profile).toBeFalsy()
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnPlanAndProfile (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const summary = await runnable
      .run('PROFILE CREATE (n) RETURN n')
      .summary()
      .toPromise()
    expect(summary).toBeDefined()
    expect(summary.hasPlan()).toBeTruthy()
    expect(summary.plan.operatorType).toBe('ProduceResults')
    expect(summary.plan.identifiers).toEqual(['n'])
    expect(summary.hasProfile()).toBeTruthy()
    expect(summary.profile.operatorType).toBe('ProduceResults')
    expect(summary.profile.identifiers).toEqual(['n'])
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldNotReturnNotification (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const summary = await runnable
      .run('CREATE (n) RETURN n')
      .summary()
      .toPromise()
    expect(summary).toBeDefined()
    expect(summary.notifications).toBeTruthy()
    expect(summary.notifications.length).toBe(0)
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnNotification (version, runnable) {
    // TODO: seems to be flaky
    return

    if (version.compareTo(VERSION_4_0_0) < 0) {
    }

    const summary = await runnable
      .run('CYPHER runtime=interpreted EXPLAIN MATCH (n),(m) RETURN n,m')
      .summary()
      .toPromise()
    expect(summary).toBeDefined()
    expect(summary.notifications).toBeTruthy()
    expect(summary.notifications.length).toBeGreaterThan(0)
    expect(summary.notifications[0].code).toBe(
      'Neo.ClientNotification.Statement.CartesianProductWarning'
    )
    expect(summary.notifications[0].title).toBe(
      'This query builds a cartesian product between disconnected patterns.'
    )
    expect(summary.notifications[0].description).toBe(
      'If a part of a query contains multiple disconnected patterns, this will build a cartesian product between all those parts. This may produce a large amount of data and slow down query processing. While occasionally intended, it may often be possible to reformulate the query that avoids the use of this cross product, perhaps by adding a relationship between the different parts or by using OPTIONAL MATCH (identifier is: (m))'
    )
    expect(summary.notifications[0].severity).toBe('WARNING')
  }

  /**
   *
   * @param {RxSession|RxTransaction} runnable
   * @param {string} statement
   * @param {*} parameters
   */
  async function verifyStatementTextAndParameters (
    runnable,
    statement,
    parameters = null
  ) {
    const summary = await runnable
      .run(statement, parameters)
      .summary()
      .toPromise()
    expect(summary).toBeDefined()
    expect(summary.statement).toBeDefined()
    expect(summary.statement.text).toBe(statement)
    expect(summary.statement.parameters).toEqual(parameters || {})
  }

  /**
   *
   * @param {RxSession|RxTransaction} runnable
   * @param {string} statement
   * @param {string} expectedStatementType
   */
  async function verifyStatementType (
    runnable,
    statement,
    expectedStatementType
  ) {
    const summary = await runnable
      .run(statement)
      .summary()
      .toPromise()
    expect(summary).toBeDefined()
    expect(summary.statementType).toBe(expectedStatementType)
  }

  /**
   *
   * @param {RxSession|RxTransaction} runnable
   * @param {string} statement
   * @param {*} parameters
   * @param {*} counters
   */
  async function verifyCounters (runnable, statement, parameters, counters) {
    const summary = await runnable
      .run(statement, parameters)
      .summary()
      .toPromise()
    expect(summary).toBeDefined()
    expect({
      nodesCreated: summary.counters.nodesCreated(),
      nodesDeleted: summary.counters.nodesDeleted(),
      relationshipsCreated: summary.counters.relationshipsCreated(),
      relationshipsDeleted: summary.counters.relationshipsDeleted(),
      propertiesSet: summary.counters.propertiesSet(),
      labelsAdded: summary.counters.labelsAdded(),
      labelsRemoved: summary.counters.labelsRemoved(),
      indexesAdded: summary.counters.indexesAdded(),
      indexesRemoved: summary.counters.indexesRemoved(),
      constraintsAdded: summary.counters.constraintsAdded(),
      constraintsRemoved: summary.counters.constraintsRemoved()
    }).toEqual(counters)
  }

  async function dropConstraintsAndIndices (driver) {
    const session = driver.session()
    try {
      const constraints = await session.run(
        "CALL db.constraints() yield description RETURN 'DROP ' + description"
      )
      for (let i = 0; i < constraints.records.length; i++) {
        await session.run(constraints.records[0].get(0))
      }

      const indices = await session.run(
        "CALL db.indexes() yield description RETURN 'DROP ' + description"
      )
      for (let i = 0; i < indices.records.length; i++) {
        await session.run(indices.records[0].get(0))
      }
    } finally {
      await session.close()
    }
  }
})

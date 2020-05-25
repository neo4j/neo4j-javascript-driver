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

      serverVersion = await sharedNeo4j.cleanupAndGetVersion(driver)
      await dropConstraintsAndIndices(driver)
    })

    afterEach(async () => {
      if (session) {
        await session.close().toPromise()
      }
      await driver.close()
    })

    it('should return non-null summary', () =>
      shouldReturnNonNullSummary(serverVersion, session))

    it('should return summary with query text', () =>
      shouldReturnSummaryWithQueryText(serverVersion, session))

    it('should return summary with query text and parameters', () =>
      shouldReturnSummaryWithQueryTextAndParams(serverVersion, session))

    it('should return summary with query type', () =>
      shouldReturnSummaryWithCorrectQueryType(serverVersion, session))

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
      await driver.close()
    })

    it('should return non-null summary', () =>
      shouldReturnNonNullSummary(serverVersion, txc))

    it('should return summary with query text', () =>
      shouldReturnSummaryWithQueryText(serverVersion, txc))

    it('should return summary with query text and parameters', () =>
      shouldReturnSummaryWithQueryTextAndParams(serverVersion, txc))

    it('should return summary with query type', () =>
      shouldReturnSummaryWithCorrectQueryType(serverVersion, txc))

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

  describe('system', () => {
    let driver
    /** @type {RxSession} */
    let session
    /** @type {ServerVersion} */
    let serverVersion

    beforeEach(async () => {
      driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken)
      session = driver.rxSession({ database: 'system' })
      //

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
      await driver.close()
    })

    it('session should return summary with correct system updates for create', () =>
      shouldReturnSummaryWithSystemUpdates(serverVersion, session))

    it('transaction should return summary with correct system updates for create', () =>
      shouldReturnSummaryWithSystemUpdates(serverVersion, session, true))
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
      .consume()
      .toPromise()

    expect(summary).toBeDefined()
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnSummaryWithQueryText (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    await verifyQueryTextAndParameters(
      runnable,
      'UNWIND RANGE(1, 10) AS n RETURN n'
    )
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnSummaryWithQueryTextAndParams (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    await verifyQueryTextAndParameters(
      runnable,
      'UNWIND RANGE(1, $x) AS n RETURN n',
      { x: 100 }
    )
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession|RxTransaction} runnable
   */
  async function shouldReturnSummaryWithCorrectQueryType (version, runnable) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    await verifyQueryType(runnable, 'CREATE (n)', 'w')
    await verifyQueryType(runnable, 'MATCH (n) RETURN n LIMIT 1', 'r')
    await verifyQueryType(runnable, 'CREATE (n) RETURN n', 'rw')
  }

  /**
   * @param {ServerVersion} version
   * @param {RxSession} session
   * @param {boolean} useTransaction
   */
  async function shouldReturnSummaryWithSystemUpdates (
    version,
    session,
    useTransaction = false
  ) {
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    let runnable = session
    if (useTransaction) {
      runnable = await session.beginTransaction().toPromise()
    }

    try {
      await verifySystemUpdates(
        runnable,
        "CREATE USER foo SET PASSWORD 'bar'",
        {},
        1
      )
    } finally {
      await verifySystemUpdates(runnable, 'DROP USER foo', {}, 1)
    }
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

    await verifyUpdates(
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

    await verifyUpdates(
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

    await verifyUpdates(runnable, 'CREATE INDEX on :Label(prop)', null, {
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

    await verifyUpdates(runnable, 'DROP INDEX on :Label(prop)', null, {
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

    await verifyUpdates(
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

    await verifyUpdates(
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
      .consume()
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
      .consume()
      .toPromise()
    expect(summary).toBeDefined()
    expect(summary.hasPlan()).toBeTruthy()
    expect(summary.plan.operatorType).toContain('ProduceResults')
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
      .consume()
      .toPromise()
    expect(summary).toBeDefined()
    expect(summary.hasPlan()).toBeTruthy()
    expect(summary.plan.operatorType).toContain('ProduceResults')
    expect(summary.plan.identifiers).toEqual(['n'])
    expect(summary.hasProfile()).toBeTruthy()
    expect(summary.profile.operatorType).toContain('ProduceResults')
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
      .consume()
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
    if (version.compareTo(VERSION_4_0_0) < 0) {
      return
    }

    const summary = await runnable
      .run('EXPLAIN MATCH (n:ThisLabelDoesNotExist) RETURN n')
      .consume()
      .toPromise()
    expect(summary).toBeDefined()
    expect(summary.notifications).toBeTruthy()
    expect(summary.notifications.length).toBeGreaterThan(0)
    expect(summary.notifications[0].code).toBe(
      'Neo.ClientNotification.Statement.UnknownLabelWarning'
    )
    expect(summary.notifications[0].title).toBe(
      'The provided label is not in the database.'
    )
    expect(summary.notifications[0].description).toBe(
      "One of the labels in your query is not available in the database, make sure you didn't misspell it or that" +
        ' the label is available when you run this statement in your application (the missing label name is:' +
        ' ThisLabelDoesNotExist)'
    )
    expect(summary.notifications[0].severity).toBe('WARNING')
  }

  /**
   *
   * @param {RxSession|RxTransaction} runnable
   * @param {string} query
   * @param {*} parameters
   */
  async function verifyQueryTextAndParameters (
    runnable,
    query,
    parameters = null
  ) {
    const summary = await runnable
      .run(query, parameters)
      .consume()
      .toPromise()
    expect(summary).toBeDefined()
    expect(summary.query).toBeDefined()
    expect(summary.query.text).toBe(query)
    expect(summary.query.parameters).toEqual(parameters || {})
  }

  /**
   *
   * @param {RxSession|RxTransaction} runnable
   * @param {string} query
   * @param {string} expectedQueryType
   */
  async function verifyQueryType (runnable, query, expectedQueryType) {
    const summary = await runnable
      .run(query)
      .consume()
      .toPromise()
    expect(summary).toBeDefined()
    expect(summary.queryType).toBe(expectedQueryType)
  }

  /**
   *
   * @param {RxSession|RxTransaction} runnable
   * @param {string} query
   * @param {*} parameters
   * @param {*} stats
   */
  async function verifyUpdates (runnable, query, parameters, stats) {
    const summary = await runnable
      .run(query, parameters)
      .consume()
      .toPromise()
    expect(summary).toBeDefined()
    expect(summary.counters.containsUpdates()).toBeTruthy()
    expect(summary.counters.updates()).toEqual(stats)
    expect(summary.counters.containsSystemUpdates()).toBeFalsy()
  }

  /**
   *
   * @param {RxSession|RxTransaction} runnable
   * @param {string} query
   * @param {*} parameters
   * @param {number} systemUpdates
   * @returns {Promise<void>}
   */
  async function verifySystemUpdates (
    runnable,
    query,
    parameters,
    systemUpdates
  ) {
    const summary = await runnable
      .run(query, parameters)
      .consume()
      .toPromise()
    expect(summary).toBeDefined()

    expect(summary.counters.containsSystemUpdates()).toBeTruthy()
    expect(summary.counters.systemUpdates()).toBe(systemUpdates)
    expect(summary.counters.containsUpdates()).toBeFalsy()
  }

  async function dropConstraintsAndIndices (driver) {
    const session = driver.session()
    try {
      const constraints = await session.run('CALL db.constraints()')
      for (let i = 0; i < constraints.records.length; i++) {
        const name = constraints.records[i].toObject().name
        await session.run('DROP CONSTRAINT ' + name) // ${getName(constraints.records[i])}`)
      }

      const indices = await session.run('CALL db.indexes()')
      for (let i = 0; i < indices.records.length; i++) {
        const name = indices.records[i].toObject().name
        await session.run('DROP INDEX ' + name) // ${getName(constraints.records[i])}`)
      }
    } finally {
      await session.close()
    }
  }
})

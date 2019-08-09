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

import neo4j from '../src'
import sharedNeo4j from './internal/shared-neo4j'
import { ServerVersion, VERSION_4_0_0 } from '../src/internal/server-version'

describe('#integration result summary', () => {
  let driver, session, serverVersion

  beforeEach(async () => {
    driver = neo4j.driver('bolt://localhost', sharedNeo4j.authToken)
    session = driver.session()

    const result = await session.run('MATCH (n) DETACH DELETE n')
    serverVersion = ServerVersion.fromString(result.summary.server.version)
  })

  afterEach(() => {
    driver.close()
  })

  it('should get result summary', done => {
    // When & Then
    session.run("CREATE (p:Person { Name: 'Test'})").then(result => {
      let summary = result.summary

      expect(summary.statement.text).toBe("CREATE (p:Person { Name: 'Test'})")
      expect(summary.statement.parameters).toEqual({})

      expect(summary.statementType).toBe('w')
      expect(summary.plan).toBe(false)
      expect(summary.profile).toBe(false)
      expect(summary.notifications).toEqual([])
      expect(summary.resultConsumedAfter).toBeDefined()
      expect(summary.resultAvailableAfter).toBeDefined()

      let counters = summary.counters
      expect(counters.nodesCreated()).toBe(1)
      expect(counters.nodesDeleted()).toBe(0)
      expect(counters.relationshipsCreated()).toBe(0)
      expect(counters.relationshipsDeleted()).toBe(0)
      expect(counters.propertiesSet()).toBe(1)
      expect(counters.labelsAdded()).toBe(1)
      expect(counters.labelsRemoved()).toBe(0)
      expect(counters.indexesAdded()).toBe(0)
      expect(counters.indexesRemoved()).toBe(0)
      expect(counters.constraintsAdded()).toBe(0)
      expect(counters.constraintsRemoved()).toBe(0)
      done()
    })
  })

  it('should get plan from summary', done => {
    session.run('EXPLAIN MATCH (n) RETURN 1').then(result => {
      let summary = result.summary
      expect(summary.plan).toBeDefined()
      expect(summary.profile).toBe(false)

      let plan = summary.plan
      expect(plan.arguments).toBeDefined()
      expect(plan.children).toBeDefined()
      expect(plan.identifiers).toBeDefined()
      expect(plan.operatorType).toBeDefined()
      done()
    })
  })

  it('should get profile from summary', done => {
    session.run('PROFILE RETURN 1').then(result => {
      let summary = result.summary
      expect(summary.plan).toBeDefined()
      expect(summary.profile).toBeDefined()

      let profile = summary.profile
      let plan = summary.plan

      verifyProfileAndPlanAreEqual(profile, plan)

      expect(profile.dbHits).toBe(0)
      expect(profile.rows).toBe(1)

      done()
    })
  })

  it('should get notifications from summary', done => {
    if (serverVersion.compareTo(VERSION_4_0_0) >= 0) {
      pending('seems to be flaky')
    }

    session.run('EXPLAIN MATCH (n), (m) RETURN n, m').then(result => {
      let summary = result.summary
      expect(summary.notifications).toBeDefined()
      expect(summary.notifications.length).toBe(1)
      let notification = summary.notifications[0]

      expect(notification.code).toBeDefined()
      expect(notification.title).toBeDefined()
      expect(notification.description).toBeDefined()
      expect(notification.severity).toBeDefined()
      expect(notification.position).toBeDefined()

      done()
    })
  })

  function verifyProfileAndPlanAreEqual (profile, plan) {
    expect(profile.arguments).toBe(plan.arguments)
    expect(profile.identifiers).toBe(plan.identifiers)
    expect(profile.operatorType).toBe(plan.operatorType)

    if (!profile.children || !plan.children) {
      expect(profile.children).toBeUndefined()
      expect(plan.children).toBeUndefined()
    } else {
      expect(profile.children).toBeDefined()
      expect(plan.children).toBeDefined()

      // recursively calling the same method to verify they are equal
      verifyProfileAndPlanAreEqual(profile.children, plan.children)
    }
  }
})

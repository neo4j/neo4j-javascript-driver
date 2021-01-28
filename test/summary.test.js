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

import neo4j from '../src'
import sharedNeo4j from './internal/shared-neo4j'

describe('#integration result summary', () => {
  describe('default driver', () => {
    let driver, session

    beforeEach(done => {
      driver = neo4j.driver(
        `bolt://${sharedNeo4j.hostname}`,
        sharedNeo4j.authToken
      )
      session = driver.session()

      session.run('MATCH (n) DETACH DELETE n').then(done)
    })

    afterEach(() => {
      driver.close()
    })

    it('should get result summary', done => {
      verifySummary(session, done)
    })

    it('should get plan from summary', done => {
      verifyPlan(session, done)
    })

    it('should get profile from summary', done => {
      verifyProfile(session, done)
    })

    it('should get notifications from summary', done => {
      verifyNotifications(
        session,
        'EXPLAIN MATCH (n:ThisLabelDoesNotExist) RETURN n',
        done
      )
    })
  })

  describe('driver with lossless integers disabled', () => {
    let driver, session

    beforeEach(done => {
      driver = neo4j.driver(
        `bolt://${sharedNeo4j.hostname}`,
        sharedNeo4j.authToken,
        {
          disableLosslessIntegers: true
        }
      )
      session = driver.session()

      session.run('MATCH (n) DETACH DELETE n').then(done)
    })

    afterEach(() => {
      driver.close()
    })

    it('should get result summary', done => {
      verifySummary(session, done)
    })

    it('should get plan from summary', done => {
      verifyPlan(session, done)
    })

    it('should get profile from summary', done => {
      verifyProfile(session, done)
    })

    it('should get notifications from summary', done => {
      verifyNotifications(
        session,
        'EXPLAIN MATCH (n:ThisLabelDoesNotExist) RETURN n',
        done
      )
    })
  })

  function verifySummary (session, done) {
    session.run("CREATE (p:Person { Name: 'Test'})").then(result => {
      const summary = result.summary

      expect(summary.query.text).toBe("CREATE (p:Person { Name: 'Test'})")
      expect(summary.query.parameters).toEqual({})

      expect(summary.queryType).toBe('w')
      expect(summary.plan).toBe(false)
      expect(summary.profile).toBe(false)
      expect(summary.notifications).toEqual([])
      expect(summary.resultConsumedAfter).toBeDefined()
      expect(summary.resultAvailableAfter).toBeDefined()

      expect(summary.counters.containsUpdates()).toBe(true)
      const stats = summary.counters.updates()
      expect(stats.nodesCreated).toBe(1)
      expect(stats.nodesDeleted).toBe(0)
      expect(stats.relationshipsCreated).toBe(0)
      expect(stats.relationshipsDeleted).toBe(0)
      expect(stats.propertiesSet).toBe(1)
      expect(stats.labelsAdded).toBe(1)
      expect(stats.labelsRemoved).toBe(0)
      expect(stats.indexesAdded).toBe(0)
      expect(stats.indexesRemoved).toBe(0)
      expect(stats.constraintsAdded).toBe(0)
      expect(stats.constraintsRemoved).toBe(0)
      expect(summary.counters.containsSystemUpdates()).toBe(false)
      done()
    })
  }

  function verifyPlan (session, done) {
    session.run('EXPLAIN MATCH (n) RETURN 1').then(result => {
      const summary = result.summary
      expect(summary.plan).toBeDefined()
      expect(summary.profile).toBe(false)

      const plan = summary.plan
      expect(plan.arguments).toBeDefined()
      expect(plan.children).toBeDefined()
      expect(plan.identifiers).toBeDefined()
      expect(plan.operatorType).toBeDefined()
      done()
    })
  }

  function verifyProfile (session, done) {
    session.run('PROFILE RETURN 1').then(result => {
      const summary = result.summary
      expect(summary.plan).toBeDefined()
      expect(summary.profile).toBeDefined()

      const profile = summary.profile
      const plan = summary.plan

      verifyProfileAndPlanAreEqual(profile, plan)

      expect(profile.dbHits).toBe(0)
      expect(profile.rows).toBe(1)
      expect(profile.time).toBe(0)
      expect(profile.hasPageCacheStats()).toBe(false)

      done()
    })
  }

  function verifyNotifications (session, query, done) {
    session.run(query).then(result => {
      const summary = result.summary
      expect(summary.notifications).toBeDefined()
      expect(summary.notifications.length).toBe(1)
      const notification = summary.notifications[0]

      expect(notification.code).toBeDefined()
      expect(notification.title).toBeDefined()
      expect(notification.description).toBeDefined()
      expect(notification.severity).toBeDefined()
      expect(notification.position).toBeDefined()

      done()
    })
  }

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

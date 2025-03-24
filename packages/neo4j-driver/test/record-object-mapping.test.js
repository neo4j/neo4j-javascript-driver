/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [https://neo4j.com]
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

import neo4j, { Date, Duration, Time, Point, DateTime, LocalDateTime, LocalTime } from '../src'
import sharedNeo4j from './internal/shared-neo4j'

describe('#integration record object mapping', () => {
  let driverGlobal

  class ActingJobs {
    person
    movie
  }
  class Movie {
    title
    released
    tagline
  }

  class Person {
    name
    born
  }

  class Role {
    name
  }

  // Create rules for the hydration of the created types
  const personRules = {
    name: neo4j.RulesFactories.asString(),
    born: neo4j.RulesFactories.asNumber({ acceptBigInt: true, optional: true })
  }

  const movieRules = {
    title: neo4j.RulesFactories.asString(),
    released: neo4j.RulesFactories.asNumber({ acceptBigInt: true, optional: true, from: 'release' }),
    tagline: neo4j.RulesFactories.asString({ optional: true })
  }

  const roleRules = {
    name: neo4j.RulesFactories.asString({ from: 'characterName' })
  }

  const actingJobsRules = {
    person: neo4j.RulesFactories.asNode({
      convert: (node) => node.as(Person)
    }),
    role: neo4j.RulesFactories.asRelationship({
      convert: (rel) => rel.as(Role)
    }),
    movie: neo4j.RulesFactories.asNode({
      convert: (node) => node.as(Movie)
    }),
    costars: neo4j.RulesFactories.asList({
      apply: neo4j.RulesFactories.asNode({
        convert: (node) => node.as(Person)
      })
    })
  }

  const actingJobsNestedRules = {
    person: neo4j.RulesFactories.asNode({
      convert: (node) => node.as(Person, personRules)
    }),
    role: neo4j.RulesFactories.asRelationship({
      convert: (rel) => rel.as(Role, roleRules)
    }),
    movie: neo4j.RulesFactories.asNode({
      convert: (node) => node.as(Movie, movieRules)
    }),
    costars: neo4j.RulesFactories.asList({
      apply: neo4j.RulesFactories.asNode({
        convert: (node) => node.as(Person, personRules)
      })
    })
  }
  const uri = `bolt://${sharedNeo4j.hostnameWithBoltPort}`

  beforeAll(() => {
    driverGlobal = neo4j.driver(uri, sharedNeo4j.authToken, { disableLosslessIntegers: true })
  })

  afterAll(async () => {
    await driverGlobal.close()
  })

  it('map transaction result with registered mappings', async () => {
    await driverGlobal.executeQuery(
      `MERGE (p1:Person {name: $name1, born: $born1})
       MERGE (p2:Person {name: $name2, born: $born2})
       MERGE (m:Movie {title: $title, release: 2015, tagline: $tagline})
       MERGE (p1)-[:ACTED_IN {characterName: $char1}]->(m)
       MERGE (p2)-[:ACTED_IN {characterName: $char2}]->(m)
      `, {
        name1: 'Max',
        born1: 2024,
        name2: 'TBD',
        born2: 2030,
        title: 'Neo4j JavaScript Driver',
        tagline: 'The best driver for the best database!',
        char1: 'current dev',
        char2: 'next dev'
      })

    neo4j.mapping.register(Role, roleRules)
    neo4j.mapping.register(Person, personRules)
    neo4j.mapping.register(Movie, movieRules)
    neo4j.mapping.register(ActingJobs, actingJobsRules)
    const session = driverGlobal.session()

    const res = await session.executeRead(async (tx) => {
      const txres = tx.run(
          `MATCH (p:Person)-[r:ACTED_IN]->(m:Movie)<-[:ACTED_IN]-(c:Person)
          WHERE id(p) <> id(c) AND p.name = "Max"
          RETURN p AS person, r as role, m AS movie, COLLECT(c) AS costars`
      )
      return txres.as(ActingJobs)
    })

    expect(res.records[0].person.born).toBe(2024)
    expect(res.records[0].role.name).toBe('current dev')
    expect(res.records[0].costars[0].name).toBe('TBD')

    session.close()

    neo4j.mapping.clearMappingRegistry()
  })

  it('map transaction result with registered mappings', async () => {
    await driverGlobal.executeQuery(
      `MERGE (p1:Person {name: $name1, born: $born1})
       MERGE (p2:Person {name: $name2, born: $born2})
       MERGE (m:Movie {title: $title, release: 2015, tagline: $tagline})
       MERGE (p1)-[:ACTED_IN {characterName: $char1}]->(m)
       MERGE (p2)-[:ACTED_IN {characterName: $char2}]->(m)
      `, {
        name1: 'Max',
        born1: 2024,
        name2: 'TBD',
        born2: 2030,
        title: 'Neo4j JavaScript Driver',
        tagline: 'The best driver for the best database!',
        char1: 'current dev',
        char2: 'next dev'
      })

    const session = driverGlobal.session()

    const res = await session.executeRead(async (tx) => {
      const txres = tx.run(
          `MATCH (p:Person)-[r:ACTED_IN]->(m:Movie)<-[:ACTED_IN]-(c:Person)
          WHERE id(p) <> id(c) AND p.name = "Max"
          RETURN p AS person, r as role, m AS movie, COLLECT(c) AS costars`
      )
      return txres.as(ActingJobs, actingJobsNestedRules)
    })

    expect(res.records[0].person.born).toBe(2024)
    expect(res.records[0].role.name).toBe('current dev')
    expect(res.records[0].costars[0].name).toBe('TBD')

    session.close()
  })

  it('map duration', async () => {
    const session = driverGlobal.session()

    const res = await session.executeRead(async (tx) => {
      const txres = tx.run(
        'RETURN $obj as obj',
        {
          obj: new Duration(1, 1, 1, 1)
        }
      )
      return txres.as({ obj: neo4j.RulesFactories.asDuration() })
    })
    expect(res.records[0].obj.months).toBe(1)

    session.close()
  })

  it('map local time', async () => {
    const session = driverGlobal.session()

    const res = await session.executeRead(async (tx) => {
      const txres = tx.run(
        'RETURN $obj as obj',
        {
          obj: new LocalTime(1, 1, 1, 1)
        }
      )
      return txres.as({ obj: neo4j.RulesFactories.asLocalTime() })
    })
    expect(res.records[0].obj.hour).toBe(1)

    session.close()
  })

  it('map time', async () => {
    const session = driverGlobal.session()

    const res = await session.executeRead(async (tx) => {
      const txres = tx.run(
        'RETURN $obj as obj',
        {
          obj: new Time(1, 1, 1, 1, 42)
        }
      )
      return txres.as({ obj: neo4j.RulesFactories.asTime() })
    })
    expect(res.records[0].obj.hour).toBe(1)
    expect(res.records[0].obj.timeZoneOffsetSeconds).toBe(42)

    session.close()
  })

  it('map date', async () => {
    const session = driverGlobal.session()

    const res = await session.executeRead(async (tx) => {
      const txres = tx.run(
        'RETURN $obj as obj',
        {
          obj: new Date(1, 1, 1, 1)
        }
      )
      return txres.as({ obj: neo4j.RulesFactories.asDate() })
    })
    expect(res.records[0].obj.month).toBe(1)

    session.close()
  })

  it('map datetime', async () => {
    const session = driverGlobal.session()

    const res = await session.executeRead(async (tx) => {
      const txres = tx.run(
        'RETURN $obj as obj',
        {
          obj: new DateTime(1, 1, 1, 1, 1, 1, 1, 42)
        }
      )
      return txres.as({ obj: neo4j.RulesFactories.asDateTime() })
    })
    expect(res.records[0].obj.month).toBe(1)
    expect(res.records[0].obj.hour).toBe(1)
    expect(res.records[0].obj.timeZoneOffsetSeconds).toBe(42)

    session.close()
  })

  it('map local datetime', async () => {
    const session = driverGlobal.session()

    const res = await session.executeRead(async (tx) => {
      const txres = tx.run(
        'RETURN $obj as obj',
        {
          obj: new LocalDateTime(1, 1, 1, 1, 1, 1, 1)
        }
      )
      return txres.as({ obj: neo4j.RulesFactories.asLocalDateTime() })
    })
    expect(res.records[0].obj.month).toBe(1)
    expect(res.records[0].obj.hour).toBe(1)

    session.close()
  })

  it('map point', async () => {
    const session = driverGlobal.session()

    const res = await session.executeRead(async (tx) => {
      const txres = tx.run(
        'RETURN $obj as obj',
        {
          obj: new Point(4326, 32.812493, 42.983216)
        }
      )
      return txres.as({ obj: neo4j.RulesFactories.asPoint() })
    })
    expect(res.records[0].obj.x).toBe(32.812493)
    expect(res.records[0].obj.srid).toBe(4326)

    session.close()
  })
})

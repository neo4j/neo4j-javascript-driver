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
    name: neo4j.rule.asString(),
    born: neo4j.rule.asNumber({ acceptBigInt: true, optional: true })
  }

  const movieRules = {
    title: neo4j.rule.asString(),
    released: neo4j.rule.asNumber({ acceptBigInt: true, optional: true, from: 'release' }),
    tagline: neo4j.rule.asString({ optional: true })
  }

  const roleRules = {
    name: neo4j.rule.asString({ from: 'characterName' })
  }

  const actingJobsRules = {
    person: neo4j.rule.asNode({
      convert: (node) => node.as(Person)
    }),
    role: neo4j.rule.asRelationship({
      convert: (rel) => rel.as(Role)
    }),
    movie: neo4j.rule.asNode({
      convert: (node) => node.as(Movie)
    }),
    costars: neo4j.rule.asList({
      apply: neo4j.rule.asNode({
        convert: (node) => node.as(Person)
      })
    })
  }

  const actingJobsNestedRules = {
    person: neo4j.rule.asNode({
      convert: (node) => node.as(Person, personRules)
    }),
    role: neo4j.rule.asRelationship({
      convert: (rel) => rel.as(Role, roleRules)
    }),
    movie: neo4j.rule.asNode({
      convert: (node) => node.as(Movie, movieRules)
    }),
    costars: neo4j.rule.asList({
      apply: neo4j.rule.asNode({
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
    if (typeof jasmine === 'undefined') {
      return
    }
    neo4j.RecordObjectMapping.register(Role, roleRules)
    neo4j.RecordObjectMapping.register(Person, personRules)
    neo4j.RecordObjectMapping.register(Movie, movieRules)
    neo4j.RecordObjectMapping.register(ActingJobs, actingJobsRules)
    const session = driverGlobal.session()
    await session.executeWrite(async (tx) => {
      if (typeof jasmine === 'undefined') {
        return
      }
      return await tx.run(`MERGE (p1:Person {name: $name1, born: $born1})
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
    })
    const res = await session.executeRead(async (tx) => {
      const txres = tx.run(
          `MATCH (p:Person)-[r:ACTED_IN]->(m:Movie)<-[:ACTED_IN]-(c:Person)
          WHERE id(p) <> id(c) AND p.name = "Max"
          RETURN p AS person, r as role, m AS movie, COLLECT(c) AS costars`
      ).as(ActingJobs)
      return await txres
    })

    expect(res.records[0].person.born).toBe(2024)
    expect(res.records[0].role.name).toBe('current dev')
    expect(res.records[0].costars[0].name).toBe('TBD')

    neo4j.RecordObjectMapping.clearMappingRegistry()
    await session.close()
  })

  it('map transaction result with mapping rules object', async () => {
    if (typeof jasmine === 'undefined') {
      return
    }
    const session = driverGlobal.session()
    await session.executeWrite(async (tx) => {
      return await tx.run(`MERGE (p1:Person {name: $name1, born: $born1})
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
    })
    const res = await session.executeRead(async (tx) => {
      const txres = tx.run(
          `MATCH (p:Person)-[r:ACTED_IN]->(m:Movie)<-[:ACTED_IN]-(c:Person)
          WHERE id(p) <> id(c) AND p.name = "Max"
          RETURN p AS person, r as role, m AS movie, COLLECT(c) AS costars`
      ).as(ActingJobs, actingJobsNestedRules)
      return await txres
    })

    expect(res.records[0].person.born).toBe(2024)
    expect(res.records[0].role.name).toBe('current dev')
    expect(res.records[0].costars[0].name).toBe('TBD')

    await session.close()
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
      return txres.as({ obj: neo4j.rule.asDuration() })
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
      return txres.as({ obj: neo4j.rule.asLocalTime() })
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
      return txres.as({ obj: neo4j.rule.asTime() })
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
      return txres.as({ obj: neo4j.rule.asDate() })
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
      return txres.as({ obj: neo4j.rule.asDateTime() })
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
      return txres.as({ obj: neo4j.rule.asLocalDateTime() })
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
      return txres.as({ obj: neo4j.rule.asPoint() })
    })
    expect(res.records[0].obj.x).toBe(32.812493)
    expect(res.records[0].obj.srid).toBe(4326)

    session.close()
  })
  it('should be able to map result with missing optional key', async () => {
    const session = driverGlobal.session()

    const res = await session.executeRead(async (tx) => {
      const txres = tx.run(
        'RETURN $obj as obj',
        {
          obj: new Point(4326, 32.812493, 42.983216)
        }
      )
      return txres.as({ obj: neo4j.rule.asPoint(), notHere: neo4j.rule.asPoint({ optional: true }) })
    })
    expect(res.records[0].obj.x).toBe(32.812493)
    expect(res.records[0].obj.srid).toBe(4326)
    expect(res.records[0].notHere).toBe(undefined)

    session.close()
  })

  it('map input', async () => {
    const session = driverGlobal.session()

    const rules = {
      number: neo4j.rule.asNumber(),
      string: neo4j.rule.asString(),
      bigint: neo4j.rule.asBigInt({ acceptNumber: true }),
      date: neo4j.rule.asDate({ stringify: true }),
      dateTime: neo4j.rule.asDateTime({ stringify: true }),
      standardDateTime: neo4j.rule.asDateTime({ JSNativeDate: true }),
      duration: neo4j.rule.asDuration({ stringify: true }),
      time: neo4j.rule.asTime({ from: 'wakeup' }),
      list: neo4j.rule.asList({ apply: neo4j.rule.asString() }),
      dateList: neo4j.rule.asList({ apply: neo4j.rule.asDateTime({ JSNativeDate: true }) })
    }

    const nodeRule = {
      n: neo4j.rule.asNode({ convert: (node) => node.as(rules) })
    }

    const obj = {
      string: 'hi',
      number: 1,
      bigint: BigInt(1),
      date: (new neo4j.Date(1, 1, 1)).toString(),
      dateTime: (new neo4j.DateTime(1, 1, 1, 1, 1, 1, 1, 1)).toString(),
      standardDateTime: (new neo4j.DateTime(1, 1, 1, 1, 1, 1, 1, 1)).toStandardDate(),
      duration: (new neo4j.Duration(1, 1, 1, 1)).toString(),
      time: new neo4j.Time(1, 1, 1, 1, 1),
      list: ['hi'],
      dateList: [(new neo4j.DateTime(1, 1, 1, 1, 1, 1, 1, 1)).toStandardDate()]
    }

    const res = await session.run('MERGE (n {string: $string, number: $number, bigint: $bigint, date: $date, dateTime: $dateTime, standardDateTime: $standardDateTime, duration: $duration, wakeup: $wakeup, list: $list, dateList: $dateList}) RETURN n', obj, {}, rules).as(nodeRule)
    const node = res.records[0].n
    expect(node.string).toEqual('hi')
    expect(node.number).toEqual(1)
    expect(node.bigint).toEqual(BigInt(1))
    expect(node.date).toEqual((new neo4j.Date(1, 1, 1)).toString())
    expect(node.dateTime).toEqual((new neo4j.DateTime(1, 1, 1, 1, 1, 1, 1, 1)).toString())
    expect(node.standardDateTime).toEqual((new neo4j.DateTime(1, 1, 1, 1, 1, 1, 1, 1)).toStandardDate())
    expect(node.duration).toEqual((new neo4j.Duration(1, 1, 1, 1)).toString())
    expect(node.time).toEqual(new neo4j.Time(1, 1, 1, 1, 1))
    expect(node.list).toEqual(['hi'])
    expect(node.dateList).toEqual([(new neo4j.DateTime(1, 1, 1, 1, 1, 1, 1, 1)).toStandardDate()])
  })

  it('map nestedList as mapped parameter', async () => {
    const session = driverGlobal.session()

    const rules = {
      nestedList: neo4j.rule.asList({ apply: neo4j.rule.asList({ apply: neo4j.rule.asDateTime({ JSNativeDate: true }) }) })
    }

    const obj = {
      nestedList: [[(new neo4j.DateTime(1, 1, 1, 1, 1, 1, 1, 1)).toStandardDate()]]
    }

    const res = await session.run('return $nestedList as nestedList', obj, {}, rules).as(rules)
    expect(res.records[0].nestedList).toEqual([[(new neo4j.DateTime(1, 1, 1, 1, 1, 1, 1, 1)).toStandardDate()]])
  })

  it('map object with internal rules', async () => {
    const session = driverGlobal.session()

    const rules = { obj: neo4j.rule.asObject({ date: neo4j.rule.asDate({ stringify: true }), vec: neo4j.rule.asVector({ asTypedList: true, from: 'vector' }) }) }
    const parameters = { obj: { date: '2024-01-12', vec: Int16Array.from([4, 8]) } }

    const res = await session.run('return $obj as obj', parameters, {}, rules).as(rules)
    expect(res.records[0].obj.date).toEqual(parameters.obj.date)
    expect(res.records[0].obj.vec).toEqual(parameters.obj.vec)
  })

  it('should fail parameterMapping non-optional parameter is missing', async () => {
    const session = driverGlobal.session()

    const rules = {
      number: neo4j.rule.asNumber(),
      string: neo4j.rule.asString()
    }

    const obj = {
      string: 'hi'
    }

    expect(() => session.run('RETURN $string', obj, {}, rules).then()).toThrow()
  })
})

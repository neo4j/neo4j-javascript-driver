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

import { Date, DateTime, Duration, RecordObjectMapping, Node, Relationship, Rules, rule, Time, Vector, newError, Integer, LocalDateTime, LocalTime, Point } from '../src'
import { as } from '../src/mapping.highlevel'

describe('Record Object Mapping', () => {
  describe('as', () => {
    it('should use rules set with register', () => {
      class Person {
        name
        constructor (
          name: String
        ) {
          this.name = name
        }
      }

      const personRules: Rules = {
        name: rule.asString({ from: 'firstname' })
      }

      const gettable = {
        get: (index: string) => {
          if (index === 'firstname') {
            return 'hi'
          }
          if (index === 'name') {
            return 'hello'
          }
          return undefined
        }
      }

      RecordObjectMapping.register(Person, personRules)
      // @ts-expect-error
      expect(as(gettable, Person).name).toBe('hi')
      RecordObjectMapping.clearMappingRegistry()
      // @ts-expect-error
      expect(as(gettable, Person).name).toBe('hello')
    })
    it('should perform typechecks according to rules', () => {
      const personRules: Rules = {
        name: rule.asNumber({ from: 'firstname' })
      }

      const gettable = {
        get: (index: string) => {
          if (index === 'firstname') {
            return 'hi'
          }
          if (index === 'name') {
            return 'hello'
          }
          return undefined
        }
      }
      // @ts-expect-error
      expect(() => as(gettable, personRules)).toThrow('Object#name should be a number but received string')
    })

    it('should be able to read all property types', () => {
      class Person {
        name
        constructor (
          name: String
        ) {
          this.name = name
        }
      }

      const personRules: Rules = {
        name: rule.asString({ from: 'firstname' })
      }
      const rules: Rules = {
        bool: rule.asBoolean(),
        number: rule.asNumber(),
        string: rule.asString(),
        bigint: rule.asBigInt(),
        integer: rule.asInteger(),
        point: rule.asPoint(),
        duration: rule.asDuration(),
        localTime: rule.asLocalTime(),
        time: rule.asTime(),
        date: rule.asDate(),
        localDateTime: rule.asLocalDateTime(),
        dateTime: rule.asDateTime(),
        list: rule.asList({ apply: rule.asString() }),
        node: rule.asNode({ convert: (node) => node.as(Person, personRules) }),
        rel: rule.asRelationship({ convert: (rel) => rel.as(Person, personRules) }),
        vec: rule.asVector(),
        convertedVec: rule.asVector({ asTypedList: true, from: 'vec' })
      }

      class mapped {
        bool: boolean
        string: string
        number: number
        bigint: BigInt
        integer: Integer
        point: Point
        duration: Duration
        localTime: LocalTime
        time: Time
        date: Date
        localDateTime: LocalDateTime
        dateTime: DateTime
        list: string[]
        node: Person
        rel: Person
        vec: Vector<Int32Array>
        convertedVec: Int32Array
      }

      const gettable = {
        get: (index: string) => {
          switch (index) {
            case 'bool':
              return true
            case 'string':
              return 'hi'
            case 'number':
              return 1
            case 'bigint':
              return BigInt(1)
            case 'integer':
              return new Integer(1, 0)
            case 'point':
              return new Point(0, 1, 1)
            case 'duration':
              return new Duration(1, 1, 1, 1)
            case 'localTime':
              return new LocalTime(1, 1, 1, 1)
            case 'time':
              return new Time(1, 1, 1, 1, 1)
            case 'date':
              return new Date(1, 1, 1)
            case 'localDateTime':
              return new LocalDateTime(1, 1, 1, 1, 1, 1, 1)
            case 'dateTime':
              return new DateTime(1, 1, 1, 1, 1, 1, 1, 1)
            case 'list':
              return ['hello']
            case 'node':
              return new Node(1, [], { firstname: 'hi' })
            case 'rel':
              return new Relationship(2, 1, 1, 'test', { firstname: 'bye' })
            case 'vec':
              return new Vector(Int32Array.from([0, 1, 2]))
            default:
              return undefined
          }
        }
      }

      // @ts-expect-error
      const result = as<mapped>(gettable, rules)

      expect(result.bool).toBe(true)

      expect(result.string).toBe('hi')

      expect(result.number).toBe(1)

      expect(result.bigint).toBe(BigInt(1))

      expect(result.integer).toEqual(new Integer(1, 0))

      expect(result.point).toEqual(new Point(0, 1, 1))

      expect(result.duration.toString()).toBe('P1M1DT1.000000001S')

      expect(result.localTime.toString()).toBe('01:01:01.000000001')

      expect(result.time.toString()).toBe('01:01:01.000000001+00:00:01')

      expect(result.date.toString()).toBe('0001-01-01')

      expect(result.localDateTime.toString()).toBe('0001-01-01T01:01:01.000000001')

      expect(result.dateTime.toString()).toBe('0001-01-01T01:01:01.000000001+00:00:01')

      expect(result.node.name).toBe('hi')

      expect(result.rel.name).toBe('bye')

      expect(result.list[0]).toBe('hello')

      expect(result.vec._typedArray[0]).toBe(0)

      expect(result.convertedVec[2]).toBe(2)
    })

    it('should allow records with missing optional results', () => {
      const rules: Rules = {
        string: rule.asString({ optional: true })
      }

      class mapped {
        string?: string
      }

      const gettable = {
        get: (index: string) => {
          switch (index) {
            case 'string':
              throw newError(
                'This record has no field with key \'string\', available keys are: [].\''
              )
            default:
              return undefined
          }
        }
      }

      // @ts-expect-error
      const result = as<mapped>(gettable, rules)

      expect(result.string).toBe(undefined)
    })

    it('should keep optional undefined as undefined and null as null', () => {
      const rules: Rules = {
        string: rule.asString({ optional: true }),
        null: rule.asString({ optional: true }),
        obj: rule.asObject({ undefined: rule.asString({ optional: true }), null: rule.asString({ optional: true }) })
      }

      class Obj {
        undefined?: undefined
        null?: null
      }

      class Mapped {
        string?: string
        null?: string | null
        obj?: Obj
      }

      const gettable = {
        get: (index: string) => {
          switch (index) {
            case 'string':
              throw newError(
                'This record has no field with key \'string\', available keys are: [].\''
              )
            case 'null':
              return null
            case 'obj':
              return { undefined, null: null }
            default:
              return undefined
          }
        }
      }
      // @ts-expect-error
      const result = as<Mapped>(gettable, rules)

      expect(result.string).toBe(undefined)
      expect(result.null).toBe(null)
      // @ts-expect-error
      expect(result.obj.null).toBe(null)
      // @ts-expect-error
      expect(result.obj.undefined).toBe(undefined)
    })
  })
})

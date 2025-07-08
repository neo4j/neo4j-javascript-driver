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

import { Date, DateTime, Duration, RecordObjectMapping, Node, Relationship, Rules, rule, Time } from '../src'
import { as } from '../src/mapping.highlevel'

describe('#unit Record Object Mapping', () => {
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
        number: rule.asNumber(),
        string: rule.asString(),
        bigint: rule.asBigInt(),
        date: rule.asDate(),
        dateTime: rule.asDateTime(),
        duration: rule.asDuration(),
        time: rule.asTime(),
        list: rule.asList({ apply: rule.asString() }),
        node: rule.asNode({ convert: (node) => node.as(Person, personRules) }),
        rel: rule.asRelationship({ convert: (rel) => rel.as(Person, personRules) })
      }

      const gettable = {
        get: (index: string) => {
          switch (index) {
            case 'string':
              return 'hi'
            case 'number':
              return 1
            case 'bigint':
              return BigInt(1)
            case 'date':
              return new Date(1, 1, 1)
            case 'dateTime':
              return new DateTime(1, 1, 1, 1, 1, 1, 1, 1)
            case 'duration':
              return new Duration(1, 1, 1, 1)
            case 'time':
              return new Time(1, 1, 1, 1, 1)
            case 'list':
              return ['hello']
            case 'node':
              return new Node(1, [], { firstname: 'hi' })
            case 'rel':
              return new Relationship(2, 1, 1, 'test', { firstname: 'bye' })
            default:
              return undefined
          }
        }
      }
      // @ts-expect-error
      const result = as(gettable, rules)

      // @ts-expect-error
      expect(result.string).toBe('hi')

      // @ts-expect-error
      expect(result.number).toBe(1)

      // @ts-expect-error
      expect(result.bigint).toBe(BigInt(1))

      // @ts-expect-error
      expect(result.list[0]).toBe('hello')

      // @ts-expect-error
      expect(result.date.toString()).toBe('0001-01-01')

      // @ts-expect-error
      expect(result.dateTime.toString()).toBe('0001-01-01T01:01:01.000000001+00:00:01')

      // @ts-expect-error
      expect(result.duration.toString()).toBe('P1M1DT1.000000001S')

      // @ts-expect-error
      expect(result.time.toString()).toBe('01:01:01.000000001+00:00:01')

      // @ts-expect-error
      expect(result.node.name).toBe('hi')

      // @ts-expect-error
      expect(result.rel.name).toBe('bye')
    })
  })
})

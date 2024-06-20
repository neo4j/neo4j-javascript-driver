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

import { Date, DateTime, Duration, LocalDateTime, LocalTime, Node, Path, PathSegment, Point, Relationship, Time, UnboundRelationship, int, json, newError } from '../src'
import { createBrokenObject } from '../src/internal/object-util'

describe('json', () => {
  describe('.stringify', () => {
    it('should handle objects created with createBrokenObject', () => {
      const reason = newError('some error')
      const broken = createBrokenObject(reason, { })

      expect(json.stringify(broken)).toMatchSnapshot()
    })

    it('should handle objects created with createBrokenObject in list', () => {
      const reason = newError('some error')
      const broken = createBrokenObject(reason, { })

      expect(json.stringify([broken])).toMatchSnapshot()
    })

    it('should handle objects created with createBrokenObject inside other object', () => {
      const reason = newError('some error')
      const broken = createBrokenObject(reason, { })

      expect(json.stringify({
        number: 1,
        broken
      })).toMatchSnapshot()
    })

    it.each(commonTypesFixture())('should handle %s', (_, value) => {
      expect(json.stringify(value)).toMatchSnapshot()
    })

    it.each(commonTypesFixture())('should handle %s in list', (_, value) => {
      expect(json.stringify([value])).toMatchSnapshot()
    })

    it.each(commonTypesFixture())('should handle %s in object', (_, value) => {
      expect(json.stringify({ key: value })).toMatchSnapshot()
    })

    describe('when opts.useCustomToString=true', () => {
      it.each(commonTypesFixture())('should handle %s', (_, value) => {
        expect(json.stringify(value, { useCustomToString: true })).toMatchSnapshot()
      })

      it.each(commonTypesFixture())('should handle %s in list', (_, value) => {
        expect(json.stringify([value], { useCustomToString: true })).toMatchSnapshot()
      })

      it.each(commonTypesFixture())('should handle %s in object', (_, value) => {
        expect(json.stringify({ key: value }, { useCustomToString: true })).toMatchSnapshot()
      })
    })
  })
})

function commonTypesFixture (): Array<[string, unknown]> {
  return [
    ['number', 2],
    ['bigint', BigInt(3)],
    ['Integer', int(5)],
    ['string', 'my string'],
    ['object', { identity: 123, labels: ['a'], properties: { key: 'value' }, elementId: 'abc' }],
    ['object with custom toString', { identity: '1', toString () { return 'My identity is One' } }],
    ['list', ['1', 2, { tres: 3 }]],
    ['Node', new Node<number>(1, ['Person'], { name: 'Mr. Bauer' }, 'myId')],
    ['Relationship', new Relationship<number>(1, 2, 3, 'FRIENDSHIP', { started: 1999 }, 'myId', 'startId', 'endId')],
    ['UnboundRelationship', new UnboundRelationship<number>(1, 'ALONE', { since: 2001 }, 'myId')],
    ['Path', new Path<number>(
      new Node<number>(1, ['Person'], { name: 'Antonio' }, 'antonioId'),
      new Node<number>(2, ['Person'], { name: 'Mr. Bauer' }, 'mrBauerId'),
      [new PathSegment<number>(
        new Node<number>(1, ['Person'], { name: 'Antonio' }, 'antonioId'),
        new Relationship<number>(3, 1, 2, 'PLAY_FOOTBALL', { since: 1897 }, 'relId', 'antonioId', 'mrBauerId'),
        new Node<number>(2, ['Person'], { name: 'Mr. Bauer' }, 'mrBauerId')
      )])
    ],
    ['Point', new Point<number>(4979, 1, 2, 3)],
    ['Duration', new Duration<number>(10, 2, 35, 100)],
    ['LocalTime', new LocalTime<number>(2, 30, 25, 150)],
    ['Time', new Time<number>(12, 50, 23, 300, 3600)],
    ['Date', new Date<number>(1999, 4, 12)],
    ['LocalDateTime', new LocalDateTime<number>(1999, 4, 28, 12, 40, 12, 301)],
    ['DateTime', new DateTime<number>(2024, 6, 13, 10, 0, 30, 134, -3600, 'Europe/Berlin')]
  ]
}

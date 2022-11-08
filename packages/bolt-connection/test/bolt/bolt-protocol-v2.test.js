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

import BoltProtocolV2 from '../../src/bolt/bolt-protocol-v2'
import utils from '../test-utils'

import {
  Date,
  DateTime,
  Duration,
  LocalDateTime,
  LocalTime,
  Path,
  PathSegment,
  Point,
  Relationship,
  Time,
  UnboundRelationship,
  Node
} from 'neo4j-driver-core'

import { alloc } from '../../src/channel'
import { structure } from '../../src/packstream'

describe('#unit BoltProtocolV2', () => {
  beforeEach(() => {
    expect.extend(utils.matchers)
  })

  it('should return correct bolt version number', () => {
    const protocol = new BoltProtocolV2(null, null, false)

    expect(protocol.version).toBe(2)
  })

  describe('unpacker configuration', () => {
    test.each([
      [false, false],
      [false, true],
      [true, false],
      [true, true]
    ])(
      'should create unpacker with disableLosslessIntegers=%p and useBigInt=%p',
      (disableLosslessIntegers, useBigInt) => {
        const protocol = new BoltProtocolV2(null, null, {
          disableLosslessIntegers,
          useBigInt
        })
        expect(protocol._unpacker._disableLosslessIntegers).toBe(
          disableLosslessIntegers
        )
        expect(protocol._unpacker._useBigInt).toBe(useBigInt)
      }
    )
  })

  describe('Bolt v4.4', () => {
    /**
     * @param {string} impersonatedUser The impersonated user.
     * @param {function(protocol: BoltProtocolV2)} fn
     */
    function verifyImpersonationNotSupportedErrror (impersonatedUser, fn) {
      const recorder = new utils.MessageRecordingConnection()
      const protocol = new BoltProtocolV2(recorder, null, false)

      expect(() => fn(protocol)).toThrowError(
        'Driver is connected to the database that does not support user impersonation. ' +
          'Please upgrade to neo4j 4.4.0 or later in order to use this functionality. ' +
          `Trying to impersonate ${impersonatedUser}.`
      )
    }

    describe('beginTransaction', () => {
      function verifyBeginTransaction (impersonatedUser) {
        verifyImpersonationNotSupportedErrror(
          impersonatedUser,
          protocol => protocol.beginTransaction({ impersonatedUser }))
      }

      it('should throw error when impersonatedUser is set', () => {
        verifyBeginTransaction('test')
      })
    })

    describe('run', () => {
      function verifyRun (impersonatedUser) {
        verifyImpersonationNotSupportedErrror(
          impersonatedUser,
          protocol => protocol.run('query', {}, { impersonatedUser }))
      }

      it('should throw error when impersonatedUser is set', () => {
        verifyRun('test')
      })
    })
  })

  describe('Bolt v5.1', () => {
    /**
     * @param {string[]} notificationFilters The notification filters.
     * @param {function(protocol: BoltProtocolV2)} fn
     */
    function verifyNotificationFiltersNotSupportedError (notificationFilters, fn) {
      const recorder = new utils.MessageRecordingConnection()
      const protocol = new BoltProtocolV2(recorder, null, false, undefined, undefined, () => {})

      expect(() => fn(protocol)).toThrowError(
        'Driver is connected to a database that does not support user notification filters. ' +
        'Please upgrade to neo4j 5.3.0 or later in order to use this functionality. ' +
        `Trying to set notifications to ${JSON.stringify(notificationFilters)}.`
      )
    }

    describe('initialize', () => {
      function verifyInitialize (notificationFilters) {
        verifyNotificationFiltersNotSupportedError(
          notificationFilters,
          protocol => protocol.initialize({ notificationFilters }))
      }

      it('should throw error when notificationFilters is set', () => {
        verifyInitialize(['test'])
      })
    })

    describe('beginTransaction', () => {
      function verifyBeginTransaction (notificationFilters) {
        verifyNotificationFiltersNotSupportedError(
          notificationFilters,
          protocol => protocol.beginTransaction({ notificationFilters }))
      }

      it('should throw error when notificationFilters is set', () => {
        verifyBeginTransaction(['test'])
      })
    })

    describe('run', () => {
      function verifyRun (notificationFilters) {
        verifyNotificationFiltersNotSupportedError(
          notificationFilters,
          protocol => protocol.run('query', {}, { notificationFilters }))
      }

      it('should throw error when notificationFilters is set', () => {
        verifyRun(['test'])
      })
    })
  })

  describe('watermarks', () => {
    it('.run() should configure watermarks', () => {
      const recorder = new utils.MessageRecordingConnection()
      const protocol = utils.spyProtocolWrite(
        new BoltProtocolV2(recorder, null, false)
      )

      const query = 'RETURN $x, $y'
      const parameters = { x: 'x', y: 'y' }
      const observer = protocol.run(query, parameters, {
        lowRecordWatermark: 100,
        highRecordWatermark: 200
      })

      expect(observer._lowRecordWatermark).toEqual(100)
      expect(observer._highRecordWatermark).toEqual(200)
    })
  })

  describe('.packable()', () => {
    it.each([
      ['Node', new Node(1, ['a'], { a: 'b' }, 'c')],
      ['Relationship', new Relationship(1, 2, 3, 'a', { b: 'c' }, 'd', 'e', 'f')],
      ['UnboundRelationship', new UnboundRelationship(1, 'a', { b: 'c' }, '1')],
      ['Path', new Path(new Node(1, [], {}), new Node(2, [], {}), [])]
    ])('should pack not pack graph types (%s)', (_, graphType) => {
      const protocol = new BoltProtocolV2(
        new utils.MessageRecordingConnection(),
        null,
        false
      )

      const packable = protocol.packable(graphType)

      expect(packable).toThrowErrorMatchingSnapshot()
    })

    it.each([
      ['Duration', new Duration(1, 1, 1, 1)],
      ['LocalTime', new LocalTime(1, 1, 1, 1)],
      ['Time', new Time(1, 1, 1, 1, 1)],
      ['Date', new Date(1, 1, 1)],
      ['LocalDateTime', new LocalDateTime(1, 1, 1, 1, 1, 1, 1)],
      ['DateTimeWithZoneId', new DateTime(1, 1, 1, 1, 1, 1, 1, undefined, 'America/Sao_Paulo')],
      ['DateTime', new DateTime(1, 1, 1, 1, 1, 1, 1, 1)],
      ['Point2D', new Point(1, 1, 1)],
      ['Point3D', new Point(1, 1, 1, 1)]
    ])('should pack spatial types and temporal types (%s)', (_, object) => {
      const buffer = alloc(256)
      const protocol = new BoltProtocolV2(
        new utils.MessageRecordingConnection(),
        buffer,
        {
          disableLosslessIntegers: true
        }
      )

      const packable = protocol.packable(object)

      expect(packable).not.toThrow()

      buffer.reset()

      const unpacked = protocol.unpack(buffer)
      expect(unpacked).toEqual(object)
    })
  })

  describe('.unpack()', () => {
    it.each([
      [
        'Node',
        new structure.Structure(0x4e, [1, ['a'], { c: 'd' }]),
        new Node(1, ['a'], { c: 'd' })
      ],
      [
        'Relationship',
        new structure.Structure(0x52, [1, 2, 3, '4', { 5: 6 }]),
        new Relationship(1, 2, 3, '4', { 5: 6 })
      ],
      [
        'UnboundRelationship',
        new structure.Structure(0x72, [1, '2', { 3: 4 }]),
        new UnboundRelationship(1, '2', { 3: 4 })
      ],
      [
        'Path',
        new structure.Structure(
          0x50,
          [
            [
              new structure.Structure(0x4e, [1, ['2'], { 3: '4' }]),
              new structure.Structure(0x4e, [4, ['5'], { 6: 7 }]),
              new structure.Structure(0x4e, [2, ['3'], { 4: '5' }])
            ],
            [
              new structure.Structure(0x52, [3, 1, 4, 'rel1', { 4: '5' }]),
              new structure.Structure(0x52, [5, 4, 2, 'rel2', { 6: 7 }])
            ],
            [1, 1, 2, 2]
          ]
        ),
        new Path(
          new Node(1, ['2'], { 3: '4' }),
          new Node(2, ['3'], { 4: '5' }),
          [
            new PathSegment(
              new Node(1, ['2'], { 3: '4' }),
              new Relationship(3, 1, 4, 'rel1', { 4: '5' }),
              new Node(4, ['5'], { 6: 7 })
            ),
            new PathSegment(
              new Node(4, ['5'], { 6: 7 }),
              new Relationship(5, 4, 2, 'rel2', { 6: 7 }),
              new Node(2, ['3'], { 4: '5' })
            )
          ]
        )
      ]
    ])('should unpack graph types (%s)', (_, struct, graphObject) => {
      const buffer = alloc(256)
      const protocol = new BoltProtocolV2(
        new utils.MessageRecordingConnection(),
        buffer,
        false
      )

      const packable = protocol.packable(struct)

      expect(packable).not.toThrow()

      buffer.reset()

      const unpacked = protocol.unpack(buffer)
      expect(unpacked).toEqual(graphObject)
    })

    it.each([
      [
        'Node with less fields',
        new structure.Structure(0x4e, [1, ['a']])
      ],
      [
        'Node with more fields',
        new structure.Structure(0x4e, [1, ['a'], { c: 'd' }, '1'])
      ],
      [
        'Relationship with less fields',
        new structure.Structure(0x52, [1, 2, 3, '4'])
      ],
      [
        'Relationship with more fields',
        new structure.Structure(0x52, [1, 2, 3, '4', { 5: 6 }, '1', '2', '3'])
      ],
      [
        'UnboundRelationship with less fields',
        new structure.Structure(0x72, [1, '2'])
      ],
      [
        'UnboundRelationship with more fields',
        new structure.Structure(0x72, [1, '2', { 3: 4 }, '1'])
      ],
      [
        'Path with less fields',
        new structure.Structure(
          0x50,
          [
            [
              new structure.Structure(0x4e, [1, ['2'], { 3: '4' }]),
              new structure.Structure(0x4e, [4, ['5'], { 6: 7 }]),
              new structure.Structure(0x4e, [2, ['3'], { 4: '5' }])
            ],
            [
              new structure.Structure(0x52, [3, 1, 4, 'rel1', { 4: '5' }]),
              new structure.Structure(0x52, [5, 4, 2, 'rel2', { 6: 7 }])
            ]
          ]
        )
      ],
      [
        'Path with more fields',
        new structure.Structure(
          0x50,
          [
            [
              new structure.Structure(0x4e, [1, ['2'], { 3: '4' }]),
              new structure.Structure(0x4e, [4, ['5'], { 6: 7 }]),
              new structure.Structure(0x4e, [2, ['3'], { 4: '5' }])
            ],
            [
              new structure.Structure(0x52, [3, 1, 4, 'rel1', { 4: '5' }]),
              new structure.Structure(0x52, [5, 4, 2, 'rel2', { 6: 7 }])
            ],
            [1, 1, 2, 2],
            'a'
          ]
        )
      ],
      [
        'Point with less fields',
        new structure.Structure(0x58, [1, 2])
      ],
      [
        'Point with more fields',
        new structure.Structure(0x58, [1, 2, 3, 4])
      ],
      [
        'Point3D with less fields',
        new structure.Structure(0x59, [1, 2, 3])
      ],

      [
        'Point3D with more fields',
        new structure.Structure(0x59, [1, 2, 3, 4, 6])
      ],
      [
        'Duration with less fields',
        new structure.Structure(0x45, [1, 2, 3])
      ],
      [
        'Duration with more fields',
        new structure.Structure(0x45, [1, 2, 3, 4, 5])
      ],
      [
        'LocalTime with less fields',
        new structure.Structure(0x74, [])
      ],
      [
        'LocalTime with more fields',
        new structure.Structure(0x74, [1, 2])
      ],
      [
        'Time with less fields',
        new structure.Structure(0x54, [1])
      ],
      [
        'Time with more fileds',
        new structure.Structure(0x54, [1, 2, 3])
      ],
      [
        'Date with less fields',
        new structure.Structure(0x44, [])
      ],
      [
        'Date with more fields',
        new structure.Structure(0x44, [1, 2])
      ],
      [
        'LocalDateTime with less fields',
        new structure.Structure(0x64, [1])
      ],
      [
        'LocalDateTime with more fields',
        new structure.Structure(0x64, [1, 2, 3])
      ],
      [
        'DateTimeWithZoneOffset with less fields',
        new structure.Structure(0x46, [1, 2])
      ],
      [
        'DateTimeWithZoneOffset with more fields',
        new structure.Structure(0x46, [1, 2, 3, 4])
      ],
      [
        'DateTimeWithZoneId with less fields',
        new structure.Structure(0x66, [1, 2])
      ],
      [
        'DateTimeWithZoneId with more fields',
        new structure.Structure(0x66, [1, 2, 'America/Sao_Paulo', 'Brasil'])
      ]
    ])('should not unpack with wrong size (%s)', (_, struct) => {
      const buffer = alloc(256)
      const protocol = new BoltProtocolV2(
        new utils.MessageRecordingConnection(),
        buffer,
        false
      )

      const packable = protocol.packable(struct)

      expect(packable).not.toThrow()

      buffer.reset()

      const unpacked = protocol.unpack(buffer)
      expect(() => unpacked instanceof structure.Structure).toThrowErrorMatchingSnapshot()
    })

    it.each([
      [
        'Point',
        new structure.Structure(0x58, [1, 2, 3]),
        new Point(1, 2, 3)
      ],
      [
        'Point3D',
        new structure.Structure(0x59, [1, 2, 3, 4]),
        new Point(1, 2, 3, 4)
      ],
      [
        'Duration',
        new structure.Structure(0x45, [1, 2, 3, 4]),
        new Duration(1, 2, 3, 4)
      ],
      [
        'LocalTime',
        new structure.Structure(0x74, [1]),
        new LocalTime(0, 0, 0, 1)
      ],
      [
        'Time',
        new structure.Structure(0x54, [1, 2]),
        new Time(0, 0, 0, 1, 2)
      ],
      [
        'Date',
        new structure.Structure(0x44, [1]),
        new Date(1970, 1, 2)
      ],
      [
        'LocalDateTime',
        new structure.Structure(0x64, [1, 2]),
        new LocalDateTime(1970, 1, 1, 0, 0, 1, 2)
      ],
      [
        'DateTimeWithZoneOffset',
        new structure.Structure(0x46, [1, 2, 3]),
        new DateTime(1970, 1, 1, 0, 0, 1, 2, 3)
      ],
      [
        'DateTimeWithZoneId',
        new structure.Structure(0x66, [1, 2, 'America/Sao_Paulo']),
        new DateTime(1970, 1, 1, 0, 0, 1, 2, undefined, 'America/Sao_Paulo')
      ]
    ])('should unpack spatial types and temporal types (%s)', (_, struct, object) => {
      const buffer = alloc(256)
      const protocol = new BoltProtocolV2(
        new utils.MessageRecordingConnection(),
        buffer,
        {
          disableLosslessIntegers: true
        }
      )

      const packable = protocol.packable(struct)

      expect(packable).not.toThrow()

      buffer.reset()

      const unpacked = protocol.unpack(buffer)
      expect(unpacked).toEqual(object)
    })
  })
})

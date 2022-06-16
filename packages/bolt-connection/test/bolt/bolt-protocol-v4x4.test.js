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

import BoltProtocolV4x4 from '../../src/bolt/bolt-protocol-v4x4'
import RequestMessage from '../../src/bolt/request-message'
import utils from '../test-utils'
import { RouteObserver } from '../../src/bolt/stream-observers'
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
  Node,
  internal
} from 'neo4j-driver-core'

import { alloc } from '../../src/channel'
import { structure } from '../../src/packstream'

const WRITE = 'WRITE'

const {
  txConfig: { TxConfig },
  bookmarks: { Bookmarks },
  logger: { Logger }
} = internal

describe('#unit BoltProtocolV4x4', () => {
  beforeEach(() => {
    expect.extend(utils.matchers)
  })

  it('should request routing information', () => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV4x4(recorder, null, false)
    utils.spyProtocolWrite(protocol)
    const routingContext = { someContextParam: 'value' }
    const databaseName = 'name'

    const observer = protocol.requestRoutingInformation({
      routingContext,
      databaseName
    })

    protocol.verifyMessageCount(1)
    expect(protocol.messages[0]).toBeMessage(
      RequestMessage.routeV4x4(routingContext, [], { databaseName, impersonatedUser: null })
    )
    expect(protocol.observers).toEqual([observer])
    expect(observer).toEqual(expect.any(RouteObserver))
    expect(protocol.flushes).toEqual([true])
  })

  it('should request routing information sending bookmarks', () => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV4x4(recorder, null, false)
    utils.spyProtocolWrite(protocol)
    const routingContext = { someContextParam: 'value' }
    const listOfBookmarks = ['a', 'b', 'c']
    const bookmarks = new Bookmarks(listOfBookmarks)
    const databaseName = 'name'

    const observer = protocol.requestRoutingInformation({
      routingContext,
      databaseName,
      sessionContext: { bookmarks }
    })

    protocol.verifyMessageCount(1)
    expect(protocol.messages[0]).toBeMessage(
      RequestMessage.routeV4x4(routingContext, listOfBookmarks, { databaseName, impersonatedUser: null })
    )
    expect(protocol.observers).toEqual([observer])
    expect(observer).toEqual(expect.any(RouteObserver))
    expect(protocol.flushes).toEqual([true])
  })

  it('should run a query', () => {
    const database = 'testdb'
    const bookmarks = new Bookmarks([
      'neo4j:bookmark:v1:tx1',
      'neo4j:bookmark:v1:tx2'
    ])
    const txConfig = new TxConfig({
      timeout: 5000,
      metadata: { x: 1, y: 'something' }
    })
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV4x4(recorder, null, false)
    utils.spyProtocolWrite(protocol)

    const query = 'RETURN $x, $y'
    const parameters = { x: 'x', y: 'y' }

    const observer = protocol.run(query, parameters, {
      bookmarks,
      txConfig,
      database,
      mode: WRITE
    })

    protocol.verifyMessageCount(2)

    expect(protocol.messages[0]).toBeMessage(
      RequestMessage.runWithMetadata(query, parameters, {
        bookmarks,
        txConfig,
        database,
        mode: WRITE
      })
    )
    expect(protocol.messages[1]).toBeMessage(RequestMessage.pull())
    expect(protocol.observers).toEqual([observer, observer])
    expect(protocol.flushes).toEqual([false, true])
  })

  it('should run a with impersonated user', () => {
    const database = 'testdb'
    const impersonatedUser = 'the impostor'
    const bookmarks = new Bookmarks([
      'neo4j:bookmark:v1:tx1',
      'neo4j:bookmark:v1:tx2'
    ])
    const txConfig = new TxConfig({
      timeout: 5000,
      metadata: { x: 1, y: 'something' }
    })
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV4x4(recorder, null, false)
    utils.spyProtocolWrite(protocol)

    const query = 'RETURN $x, $y'
    const parameters = { x: 'x', y: 'y' }

    const observer = protocol.run(query, parameters, {
      bookmarks,
      txConfig,
      database,
      mode: WRITE,
      impersonatedUser
    })

    protocol.verifyMessageCount(2)

    expect(protocol.messages[0]).toBeMessage(
      RequestMessage.runWithMetadata(query, parameters, {
        bookmarks,
        txConfig,
        database,
        mode: WRITE,
        impersonatedUser
      })
    )
    expect(protocol.messages[1]).toBeMessage(RequestMessage.pull())
    expect(protocol.observers).toEqual([observer, observer])
    expect(protocol.flushes).toEqual([false, true])
  })

  it('should begin a transaction', () => {
    const database = 'testdb'
    const bookmarks = new Bookmarks([
      'neo4j:bookmark:v1:tx1',
      'neo4j:bookmark:v1:tx2'
    ])
    const txConfig = new TxConfig({
      timeout: 5000,
      metadata: { x: 1, y: 'something' }
    })
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV4x4(recorder, null, false)
    utils.spyProtocolWrite(protocol)

    const observer = protocol.beginTransaction({
      bookmarks,
      txConfig,
      database,
      mode: WRITE
    })

    protocol.verifyMessageCount(1)
    expect(protocol.messages[0]).toBeMessage(
      RequestMessage.begin({ bookmarks, txConfig, database, mode: WRITE })
    )
    expect(protocol.observers).toEqual([observer])
    expect(protocol.flushes).toEqual([true])
  })

  it('should begin a transaction with impersonated user', () => {
    const database = 'testdb'
    const impersonatedUser = 'the impostor'
    const bookmarks = new Bookmarks([
      'neo4j:bookmark:v1:tx1',
      'neo4j:bookmark:v1:tx2'
    ])
    const txConfig = new TxConfig({
      timeout: 5000,
      metadata: { x: 1, y: 'something' }
    })
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV4x4(recorder, null, false)
    utils.spyProtocolWrite(protocol)

    const observer = protocol.beginTransaction({
      bookmarks,
      txConfig,
      database,
      mode: WRITE,
      impersonatedUser
    })

    protocol.verifyMessageCount(1)
    expect(protocol.messages[0]).toBeMessage(
      RequestMessage.begin({ bookmarks, txConfig, database, mode: WRITE, impersonatedUser })
    )
    expect(protocol.observers).toEqual([observer])
    expect(protocol.flushes).toEqual([true])
  })

  it('should return correct bolt version number', () => {
    const protocol = new BoltProtocolV4x4(null, null, false)

    expect(protocol.version).toBe(4.4)
  })

  it('should update metadata', () => {
    const metadata = { t_first: 1, t_last: 2, db_hits: 3, some_other_key: 4 }
    const protocol = new BoltProtocolV4x4(null, null, false)

    const transformedMetadata = protocol.transformMetadata(metadata)

    expect(transformedMetadata).toEqual({
      result_available_after: 1,
      result_consumed_after: 2,
      db_hits: 3,
      some_other_key: 4
    })
  })

  it('should initialize connection', () => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV4x4(recorder, null, false)
    utils.spyProtocolWrite(protocol)

    const clientName = 'js-driver/1.2.3'
    const authToken = { username: 'neo4j', password: 'secret' }

    const observer = protocol.initialize({ userAgent: clientName, authToken })

    protocol.verifyMessageCount(1)
    expect(protocol.messages[0]).toBeMessage(
      RequestMessage.hello(clientName, authToken, null, ['utc'])
    )
    expect(protocol.observers).toEqual([observer])
    expect(protocol.flushes).toEqual([true])
  })

  it('should begin a transaction', () => {
    const bookmarks = new Bookmarks([
      'neo4j:bookmark:v1:tx1',
      'neo4j:bookmark:v1:tx2'
    ])
    const txConfig = new TxConfig({
      timeout: 5000,
      metadata: { x: 1, y: 'something' }
    })
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV4x4(recorder, null, false)
    utils.spyProtocolWrite(protocol)

    const observer = protocol.beginTransaction({
      bookmarks,
      txConfig,
      mode: WRITE
    })

    protocol.verifyMessageCount(1)
    expect(protocol.messages[0]).toBeMessage(
      RequestMessage.begin({ bookmarks, txConfig, mode: WRITE })
    )
    expect(protocol.observers).toEqual([observer])
    expect(protocol.flushes).toEqual([true])
  })

  it('should commit', () => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV4x4(recorder, null, false)
    utils.spyProtocolWrite(protocol)

    const observer = protocol.commitTransaction()

    protocol.verifyMessageCount(1)
    expect(protocol.messages[0]).toBeMessage(RequestMessage.commit())
    expect(protocol.observers).toEqual([observer])
    expect(protocol.flushes).toEqual([true])
  })

  it('should rollback', () => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV4x4(recorder, null, false)
    utils.spyProtocolWrite(protocol)

    const observer = protocol.rollbackTransaction()

    protocol.verifyMessageCount(1)
    expect(protocol.messages[0]).toBeMessage(RequestMessage.rollback())
    expect(protocol.observers).toEqual([observer])
    expect(protocol.flushes).toEqual([true])
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
        const protocol = new BoltProtocolV4x4(null, null, {
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

  describe('watermarks', () => {
    it('.run() should configure watermarks', () => {
      const recorder = new utils.MessageRecordingConnection()
      const protocol = utils.spyProtocolWrite(
        new BoltProtocolV4x4(recorder, null, false)
      )

      const query = 'RETURN $x, $y'
      const parameters = { x: 'x', y: 'y' }
      const observer = protocol.run(query, parameters, {
        bookmarks: Bookmarks.empty(),
        txConfig: TxConfig.empty(),
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
      const protocol = new BoltProtocolV4x4(
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
      ['DateTimeWithZoneId', new DateTime(1, 1, 1, 1, 1, 1, 1, undefined, 'America/Sao Paulo')],
      ['DateTime', new DateTime(1, 1, 1, 1, 1, 1, 1, 1)],
      ['Point2D', new Point(1, 1, 1)],
      ['Point3D', new Point(1, 1, 1, 1)]
    ])('should pack spatial types and temporal types (%s)', (_, object) => {
      const buffer = alloc(256)
      const protocol = new BoltProtocolV4x4(
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
      const protocol = new BoltProtocolV4x4(
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
        new structure.Structure(0x66, [1, 2, 'America/Sao Paulo', 'Brasil'])
      ]
    ])('should not unpack with wrong size (%s)', (_, struct) => {
      const buffer = alloc(256)
      const protocol = new BoltProtocolV4x4(
        new utils.MessageRecordingConnection(),
        buffer,
        false
      )

      const packable = protocol.packable(struct)

      expect(packable).not.toThrow()

      buffer.reset()

      expect(() => protocol.unpack(buffer)).toThrowErrorMatchingSnapshot()
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
        new structure.Structure(0x66, [1, 2, 'America/Sao Paulo']),
        new DateTime(1970, 1, 1, 0, 0, 1, 2, undefined, 'America/Sao Paulo')
      ]
    ])('should unpack spatial types and temporal types (%s)', (_, struct, object) => {
      const buffer = alloc(256)
      const protocol = new BoltProtocolV4x4(
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

  describe('utc patch', () => {
    describe('the server accepted the patch', () => {
      let protocol
      let buffer
      let loggerFunction

      beforeEach(() => {
        buffer = alloc(256)
        loggerFunction = jest.fn()
        protocol = new BoltProtocolV4x4(
          new utils.MessageRecordingConnection(),
          buffer,
          { disableLosslessIntegers: true },
          undefined,
          new Logger('debug', loggerFunction)
        )
        utils.spyProtocolWrite(protocol)

        const clientName = 'js-driver/1.2.3'
        const authToken = { username: 'neo4j', password: 'secret' }

        const observer = protocol.initialize({ userAgent: clientName, authToken })

        observer.onCompleted({ patch_bolt: ['utc'] })

        buffer.reset()
      })

      it.each([
        [
          'DateTimeWithZoneOffset',
          new DateTime(2022, 6, 14, 15, 21, 18, 183_000_000, 120 * 60)
        ],
        [
          'DateTimeWithZoneId / Berlin 2:30 CET',
          new DateTime(2022, 10, 30, 2, 30, 0, 183_000_000, 2 * 60 * 60, 'Europe/Berlin')
        ],
        [
          'DateTimeWithZoneId / Berlin 2:30 CEST',
          new DateTime(2022, 10, 30, 2, 30, 0, 183_000_000, 1 * 60 * 60, 'Europe/Berlin')
        ]
      ])('should pack temporal types (%s)', (_, object) => {
        const packable = protocol.packable(object)

        expect(packable).not.toThrow()

        buffer.reset()

        const unpacked = protocol.unpack(buffer)

        expect(unpacked).toEqual(object)
      })

      it.each([
        [
          'DateTimeWithZoneId / Australia',
          new DateTime(2022, 6, 15, 15, 21, 18, 183_000_000, undefined, 'Australia/Eucla')
        ],
        [
          'DateTimeWithZoneId',
          new DateTime(2022, 6, 22, 15, 21, 18, 183_000_000, undefined, 'Europe/Berlin')
        ],
        [
          'DateTimeWithZoneId / Europe just before turn CEST',
          new DateTime(2022, 3, 27, 1, 59, 59, 183_000_000, undefined, 'Europe/Berlin')
        ],
        [
          'DateTimeWithZoneId / Europe just 1 before turn CEST',
          new DateTime(2022, 3, 27, 0, 59, 59, 183_000_000, undefined, 'Europe/Berlin')
        ],
        [
          'DateTimeWithZoneId / Europe just after turn CEST',
          new DateTime(2022, 3, 27, 3, 0, 0, 183_000_000, undefined, 'Europe/Berlin')
        ],
        [
          'DateTimeWithZoneId / Europe just 1 after turn CEST',
          new DateTime(2022, 3, 27, 4, 0, 0, 183_000_000, undefined, 'Europe/Berlin')
        ],
        [
          'DateTimeWithZoneId / Europe just before turn CET',
          new DateTime(2022, 10, 30, 2, 59, 59, 183_000_000, undefined, 'Europe/Berlin')
        ],
        [
          'DateTimeWithZoneId / Europe just 1 before turn CET',
          new DateTime(2022, 10, 30, 1, 59, 59, 183_000_000, undefined, 'Europe/Berlin')
        ],
        [
          'DateTimeWithZoneId / Europe just after turn CET',
          new DateTime(2022, 10, 30, 3, 0, 0, 183_000_000, undefined, 'Europe/Berlin')
        ],
        [
          'DateTimeWithZoneId / Europe just 1 after turn CET',
          new DateTime(2022, 10, 30, 4, 0, 0, 183_000_000, undefined, 'Europe/Berlin')
        ],
        [
          'DateTimeWithZoneId / Sao Paulo just before turn summer time',
          new DateTime(2018, 11, 4, 11, 59, 59, 183_000_000, undefined, 'America/Sao_Paulo')
        ],
        [
          'DateTimeWithZoneId / Sao Paulo just 1 before turn summer time',
          new DateTime(2018, 11, 4, 10, 59, 59, 183_000_000, undefined, 'America/Sao_Paulo')
        ],
        [
          'DateTimeWithZoneId / Sao Paulo just after turn summer time',
          new DateTime(2018, 11, 5, 1, 0, 0, 183_000_000, undefined, 'America/Sao_Paulo')
        ],
        [
          'DateTimeWithZoneId / Sao Paulo just 1 after turn summer time',
          new DateTime(2018, 11, 5, 2, 0, 0, 183_000_000, undefined, 'America/Sao_Paulo')
        ],
        [
          'DateTimeWithZoneId / Sao Paulo just before turn winter time',
          new DateTime(2019, 2, 17, 11, 59, 59, 183_000_000, undefined, 'America/Sao_Paulo')
        ],
        [
          'DateTimeWithZoneId / Sao Paulo just 1 before turn winter time',
          new DateTime(2019, 2, 17, 10, 59, 59, 183_000_000, undefined, 'America/Sao_Paulo')
        ],
        [
          'DateTimeWithZoneId / Sao Paulo just after turn winter time',
          new DateTime(2019, 2, 18, 0, 0, 0, 183_000_000, undefined, 'America/Sao_Paulo')
        ],
        [
          'DateTimeWithZoneId / Sao Paulo just 1 after turn winter time',
          new DateTime(2019, 2, 18, 1, 0, 0, 183_000_000, undefined, 'America/Sao_Paulo')
        ]
      ])('should pack and unpack DateTimeWithZoneId and without offset (%s)', (_, object) => {
        const packable = protocol.packable(object)

        expect(packable).not.toThrow()

        buffer.reset()

        const unpacked = protocol.unpack(buffer)

        expect(unpacked.timeZoneOffsetSeconds).toBeDefined()

        const unpackedDateTimeWithoutOffset = new DateTime(
          unpacked.year,
          unpacked.month,
          unpacked.day,
          unpacked.hour,
          unpacked.minute,
          unpacked.second,
          unpacked.nanosecond,
          undefined,
          unpacked.timeZoneId
        )

        expect(loggerFunction)
          .toBeCalledWith('warn',
            'DateTime objects without "timeZoneOffsetSeconds" property ' +
            'are prune to bugs related to ambiguous times. For instance, ' +
            '2022-10-30T2:30:00[Europe/Berlin] could be GMT+1 or GMT+2.')

        expect(unpackedDateTimeWithoutOffset).toEqual(object)
      })

      it.each([
        [
          'DateTimeWithZoneOffset with less fields',
          new structure.Structure(0x49, [1, 2])
        ],
        [
          'DateTimeWithZoneOffset with more fields',
          new structure.Structure(0x49, [1, 2, 3, 4])
        ],
        [
          'DateTimeWithZoneId with less fields',
          new structure.Structure(0x69, [1, 2])
        ],
        [
          'DateTimeWithZoneId with more fields',
          new structure.Structure(0x69, [1, 2, 'America/Sao Paulo', 'Brasil'])
        ]
      ])('should not unpack with wrong size (%s)', (_, struct) => {
        const packable = protocol.packable(struct)

        expect(packable).not.toThrow()

        buffer.reset()

        expect(() => protocol.unpack(buffer)).toThrowErrorMatchingSnapshot()
      })

      it.each([
        [
          'DateTimeWithZoneOffset',
          new structure.Structure(0x49, [
            1655212878, 183_000_000, 120 * 60
          ]),
          new DateTime(2022, 6, 14, 15, 21, 18, 183_000_000, 120 * 60)
        ],
        [
          'DateTimeWithZoneId',
          new structure.Structure(0x69, [
            1655212878, 183_000_000, 'Europe/Berlin'
          ]),
          new DateTime(2022, 6, 14, 15, 21, 18, 183_000_000, 2 * 60 * 60, 'Europe/Berlin')
        ],
        [
          'DateTimeWithZoneId / Australia',
          new structure.Structure(0x69, [
            1655212878, 183_000_000, 'Australia/Eucla'
          ]),
          new DateTime(2022, 6, 14, 22, 6, 18, 183_000_000, 8 * 60 * 60 + 45 * 60, 'Australia/Eucla')
        ]
      ])('should unpack temporal types (%s)', (_, struct, object) => {
        const packable = protocol.packable(struct)

        expect(packable).not.toThrow()

        buffer.reset()

        const unpacked = protocol.unpack(buffer)
        expect(unpacked).toEqual(object)
      })

      it.each([
        [
          'DateTimeWithZoneOffset/0x46',
          new structure.Structure(0x46, [1, 2, 3])
        ],
        [
          'DateTimeWithZoneId/0x66',
          new structure.Structure(0x66, [1, 2, 'America/Sao Paulo'])
        ]
      ])('should unpack deprecated temporal types as unknown structs (%s)', (_, struct) => {
        const packable = protocol.packable(struct)

        expect(packable).not.toThrow()

        buffer.reset()

        const unpacked = protocol.unpack(buffer)
        expect(unpacked).toEqual(struct)
      })
    })

    describe('the server did not accept th patch', () => {
      let protocol
      let buffer
      let loggerFunction

      beforeEach(() => {
        buffer = alloc(256)
        loggerFunction = jest.fn()
        protocol = new BoltProtocolV4x4(
          new utils.MessageRecordingConnection(),
          buffer,
          { disableLosslessIntegers: true },
          undefined,
          new Logger('debug', loggerFunction)
        )
        utils.spyProtocolWrite(protocol)

        const clientName = 'js-driver/1.2.3'
        const authToken = { username: 'neo4j', password: 'secret' }

        const observer = protocol.initialize({ userAgent: clientName, authToken })

        observer.onCompleted({})

        buffer.reset()
      })

      it.each([
        [
          'DateTimeWithZoneOffset/0x49',
          new structure.Structure(0x49, [1, 2, 3])
        ],
        [
          'DateTimeWithZoneId/0x69',
          new structure.Structure(0x69, [1, 2, 'America/Sao Paulo'])
        ]
      ])('should unpack utc temporal types as unknown structs (%s)', (_, struct) => {
        const packable = protocol.packable(struct)

        expect(packable).not.toThrow()

        buffer.reset()

        const unpacked = protocol.unpack(buffer)
        expect(unpacked).toEqual(struct)
      })

      it.each([
        [
          'DateTimeWithZoneOffset',
          new structure.Structure(0x46, [1, 2, 3]),
          new DateTime(1970, 1, 1, 0, 0, 1, 2, 3)
        ],
        [
          'DateTimeWithZoneId',
          new structure.Structure(0x66, [1, 2, 'America/Sao Paulo']),
          new DateTime(1970, 1, 1, 0, 0, 1, 2, undefined, 'America/Sao Paulo')
        ]
      ])('should unpack temporal types without utc fix (%s)', (_, struct, object) => {
        const packable = protocol.packable(struct)

        expect(packable).not.toThrow()

        buffer.reset()

        const unpacked = protocol.unpack(buffer)
        expect(unpacked).toEqual(object)
      })

      it.each([
        ['DateTimeWithZoneId', new DateTime(1, 1, 1, 1, 1, 1, 1, undefined, 'America/Sao Paulo')],
        ['DateTime', new DateTime(1, 1, 1, 1, 1, 1, 1, 1)]
      ])('should pack temporal types (no utc) (%s)', (_, object) => {
        const packable = protocol.packable(object)

        expect(packable).not.toThrow()

        buffer.reset()

        const unpacked = protocol.unpack(buffer)
        expect(unpacked).toEqual(object)
      })
    })
  })
})

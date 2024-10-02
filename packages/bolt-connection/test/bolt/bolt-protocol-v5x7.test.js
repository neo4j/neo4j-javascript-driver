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

import BoltProtocolV5x7 from '../../src/bolt/bolt-protocol-v5x7'
import RequestMessage from '../../src/bolt/request-message'
import { v2, structure } from '../../src/packstream'
import utils from '../test-utils'
import { LoginObserver, RouteObserver } from '../../src/bolt/stream-observers'
import fc from 'fast-check'
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
import { notificationFilterBehaviour, telemetryBehaviour } from './behaviour'

const WRITE = 'WRITE'

const {
  txConfig: { TxConfig },
  bookmarks: { Bookmarks },
  logger: { Logger },
  temporalUtil
} = internal

describe('#unit BoltProtocolV5x7', () => {
  beforeEach(() => {
    expect.extend(utils.matchers)
  })

  telemetryBehaviour.protocolSupportsTelemetry(newProtocol)

  it('should enrich error metadata', () => {
    const protocol = new BoltProtocolV5x7()
    const enrichedData = protocol.enrichErrorMetadata({ neo4j_code: 'hello', diagnostic_record: {} })
    expect(enrichedData.code).toBe('hello')
    expect(enrichedData.diagnostic_record.OPERATION).toBe('')
    expect(enrichedData.diagnostic_record.OPERATION_CODE).toBe('0')
    expect(enrichedData.diagnostic_record.CURRENT_SCHEMA).toBe('/')
  })

  it('should request routing information', () => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV5x7(recorder, null, false)
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
    const protocol = new BoltProtocolV5x7(recorder, null, false)
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
    const protocol = new BoltProtocolV5x7(recorder, null, false)
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
    const protocol = new BoltProtocolV5x7(recorder, null, false)
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
    const protocol = new BoltProtocolV5x7(recorder, null, false)
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
    const protocol = new BoltProtocolV5x7(recorder, null, false)
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
    const protocol = new BoltProtocolV5x7(null, null, false)

    expect(protocol.version).toBe(5.7)
  })

  it('should update metadata', () => {
    const metadata = { t_first: 1, t_last: 2, db_hits: 3, some_other_key: 4 }
    const protocol = new BoltProtocolV5x7(null, null, false)

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
    const protocol = new BoltProtocolV5x7(recorder, null, false)
    utils.spyProtocolWrite(protocol)

    const clientName = 'js-driver/1.2.3'
    const boltAgent = {
      product: 'neo4j-javascript/5.7',
      platform: 'netbsd 1.1.1; Some arch',
      languageDetails: 'Node/16.0.1 (v8 1.7.0)'
    }
    const authToken = { username: 'neo4j', password: 'secret' }

    const observer = protocol.initialize({ userAgent: clientName, boltAgent, authToken })

    protocol.verifyMessageCount(2)
    expect(protocol.messages[0]).toBeMessage(
      RequestMessage.hello5x3(clientName, boltAgent)
    )
    expect(protocol.messages[1]).toBeMessage(
      RequestMessage.logon(authToken)
    )

    expect(protocol.observers.length).toBe(2)

    // hello observer
    const helloObserver = protocol.observers[0]
    expect(helloObserver).toBeInstanceOf(LoginObserver)
    expect(helloObserver).not.toBe(observer)

    // login observer
    const loginObserver = protocol.observers[1]
    expect(loginObserver).toBeInstanceOf(LoginObserver)
    expect(loginObserver).toBe(observer)

    expect(protocol.flushes).toEqual([false, true])
  })

  it.each([
    'javascript-driver/5.7.0',
    '',
    undefined,
    null
  ])('should always use the user agent set by the user', (userAgent) => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV5x7(recorder, null, false)
    utils.spyProtocolWrite(protocol)

    const boltAgent = {
      product: 'neo4j-javascript/5.7',
      platform: 'netbsd 1.1.1; Some arch',
      languageDetails: 'Node/16.0.1 (v8 1.7.0)'
    }
    const authToken = { username: 'neo4j', password: 'secret' }

    const observer = protocol.initialize({ userAgent, boltAgent, authToken })

    protocol.verifyMessageCount(2)
    expect(protocol.messages[0]).toBeMessage(
      RequestMessage.hello5x3(userAgent, boltAgent)
    )
    expect(protocol.messages[1]).toBeMessage(
      RequestMessage.logon(authToken)
    )

    expect(protocol.observers.length).toBe(2)

    // hello observer
    const helloObserver = protocol.observers[0]
    expect(helloObserver).toBeInstanceOf(LoginObserver)
    expect(helloObserver).not.toBe(observer)

    // login observer
    const loginObserver = protocol.observers[1]
    expect(loginObserver).toBeInstanceOf(LoginObserver)
    expect(loginObserver).toBe(observer)

    expect(protocol.flushes).toEqual([false, true])
  })

  it.each(
    [true, false]
  )('should logon to the server [flush=%s]', (flush) => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV5x7(recorder, null, false)
    utils.spyProtocolWrite(protocol)

    const authToken = { username: 'neo4j', password: 'secret' }

    const observer = protocol.logon({ authToken, flush })

    protocol.verifyMessageCount(1)

    expect(protocol.messages[0]).toBeMessage(
      RequestMessage.logon(authToken)
    )

    expect(protocol.observers).toEqual([observer])
    expect(protocol.flushes).toEqual([flush])
  })

  it.each(
    [true, false]
  )('should logoff from the server [flush=%s]', (flush) => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV5x7(recorder, null, false)
    utils.spyProtocolWrite(protocol)

    const observer = protocol.logoff({ flush })

    protocol.verifyMessageCount(1)

    expect(protocol.messages[0]).toBeMessage(
      RequestMessage.logoff()
    )

    expect(protocol.observers).toEqual([observer])
    expect(protocol.flushes).toEqual([flush])
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
    const protocol = new BoltProtocolV5x7(recorder, null, false)
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
    const protocol = new BoltProtocolV5x7(recorder, null, false)
    utils.spyProtocolWrite(protocol)

    const observer = protocol.commitTransaction()

    protocol.verifyMessageCount(1)
    expect(protocol.messages[0]).toBeMessage(RequestMessage.commit())
    expect(protocol.observers).toEqual([observer])
    expect(protocol.flushes).toEqual([true])
  })

  it('should rollback', () => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV5x7(recorder, null, false)
    utils.spyProtocolWrite(protocol)

    const observer = protocol.rollbackTransaction()

    protocol.verifyMessageCount(1)
    expect(protocol.messages[0]).toBeMessage(RequestMessage.rollback())
    expect(protocol.observers).toEqual([observer])
    expect(protocol.flushes).toEqual([true])
  })

  it('should support logoff', () => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = new BoltProtocolV5x7(recorder, null, false)

    expect(protocol.supportsReAuth).toBe(true)
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
        const protocol = new BoltProtocolV5x7(null, null, {
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

  describe('notificationFilter', () => {
    notificationFilterBehaviour.shouldSupportGqlNotificationFilterOnInitialize(newProtocol)
    notificationFilterBehaviour.shouldSupportGqlNotificationFilterOnBeginTransaction(newProtocol)
    notificationFilterBehaviour.shouldSupportGqlNotificationFilterOnRun(newProtocol)
  })

  describe('watermarks', () => {
    it('.run() should configure watermarks', () => {
      const recorder = new utils.MessageRecordingConnection()
      const protocol = utils.spyProtocolWrite(
        new BoltProtocolV5x7(recorder, null, false)
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

  describe('packstream', () => {
    it('should configure v2 packer', () => {
      const protocol = new BoltProtocolV5x7(null, null, false)
      expect(protocol.packer()).toBeInstanceOf(v2.Packer)
    })

    it('should configure v2 unpacker', () => {
      const protocol = new BoltProtocolV5x7(null, null, false)
      expect(protocol.unpacker()).toBeInstanceOf(v2.Unpacker)
    })
  })

  describe('.packable()', () => {
    it.each([
      ['Node', new Node(1, ['a'], { a: 'b' }, 'c')],
      ['Relationship', new Relationship(1, 2, 3, 'a', { b: 'c' }, 'd', 'e', 'f')],
      ['UnboundRelationship', new UnboundRelationship(1, 'a', { b: 'c' }, '1')],
      ['Path', new Path(new Node(1, [], {}), new Node(2, [], {}), [])]
    ])('should resultant function not pack graph types (%s)', (_, graphType) => {
      const protocol = new BoltProtocolV5x7(
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
      [
        'DateTimeWithZoneOffset',
        new DateTime(2022, 6, 14, 15, 21, 18, 183_000_000, 120 * 60)
      ],
      [
        'DateTimeWithZoneOffset / 1978',
        new DateTime(1978, 12, 16, 10, 5, 59, 128000987, -150 * 60)
      ],
      [
        'DateTimeWithZoneId / Berlin 2:30 CET',
        new DateTime(2022, 10, 30, 2, 30, 0, 183_000_000, 2 * 60 * 60, 'Europe/Berlin')
      ],
      [
        'DateTimeWithZoneId / Berlin 2:30 CEST',
        new DateTime(2022, 10, 30, 2, 30, 0, 183_000_000, 1 * 60 * 60, 'Europe/Berlin')
      ],
      ['Point2D', new Point(1, 1, 1)],
      ['Point3D', new Point(1, 1, 1, 1)]
    ])('should pack spatial types and temporal types (%s)', (_, object) => {
      const buffer = alloc(256)
      const protocol = new BoltProtocolV5x7(
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
      ],
      [
        'DateTimeWithZoneId / Istanbul',
        new DateTime(1978, 12, 16, 12, 35, 59, 128000987, undefined, 'Europe/Istanbul')
      ],
      [
        'DateTimeWithZoneId / Istanbul',
        new DateTime(2020, 6, 15, 4, 30, 0, 183_000_000, undefined, 'Pacific/Honolulu')
      ],
      [
        'DateWithWithZoneId / Berlin before common era',
        new DateTime(-2020, 6, 15, 4, 30, 0, 183_000_000, undefined, 'Europe/Berlin')
      ],
      [
        'DateWithWithZoneId / Max Date',
        new DateTime(99_999, 12, 31, 23, 59, 59, 999_999_999, undefined, 'Pacific/Kiritimati')
      ],
      [
        'DateWithWithZoneId / Min Date',
        new DateTime(-99_999, 12, 31, 23, 59, 59, 999_999_999, undefined, 'Pacific/Samoa')
      ],
      [
        'DateWithWithZoneId / Ambiguous date between 00 and 99',
        new DateTime(50, 12, 31, 23, 59, 59, 999_999_999, undefined, 'Pacific/Samoa')
      ]
    ])('should pack and unpack DateTimeWithZoneId and without offset (%s)', (_, object) => {
      const buffer = alloc(256)
      const loggerFunction = jest.fn()
      const protocol = new BoltProtocolV5x7(
        new utils.MessageRecordingConnection(),
        buffer,
        {
          disableLosslessIntegers: true
        },
        undefined,
        new Logger('debug', loggerFunction)
      )

      const packable = protocol.packable(object)

      expect(packable).not.toThrow()
      expect(loggerFunction)
        .toBeCalledWith('warn',
          'DateTime objects without "timeZoneOffsetSeconds" property ' +
          'are prune to bugs related to ambiguous times. For instance, ' +
          '2022-10-30T2:30:00[Europe/Berlin] could be GMT+1 or GMT+2.')

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

      expect(unpackedDateTimeWithoutOffset).toEqual(object)
    })

    it('should pack and unpack DateTimeWithOffset', () => {
      fc.assert(
        fc.property(
          fc.date({
            min: temporalUtil.newDate(utils.MIN_UTC_IN_MS + utils.ONE_DAY_IN_MS),
            max: temporalUtil.newDate(utils.MAX_UTC_IN_MS - utils.ONE_DAY_IN_MS)
          }),
          fc.integer({ min: 0, max: 999_999 }),
          utils.arbitraryTimeZoneId(),
          (date, nanoseconds, timeZoneId) => {
            const object = new DateTime(
              date.getUTCFullYear(),
              date.getUTCMonth() + 1,
              date.getUTCDate(),
              date.getUTCHours(),
              date.getUTCMinutes(),
              date.getUTCSeconds(),
              date.getUTCMilliseconds() * 1_000_000 + nanoseconds,
              undefined,
              timeZoneId
            )
            const buffer = alloc(256)
            const loggerFunction = jest.fn()
            const protocol = new BoltProtocolV5x7(
              new utils.MessageRecordingConnection(),
              buffer,
              {
                disableLosslessIntegers: true
              },
              undefined,
              new Logger('debug', loggerFunction)
            )

            const packable = protocol.packable(object)

            expect(packable).not.toThrow()
            expect(loggerFunction)
              .toBeCalledWith('warn',
                'DateTime objects without "timeZoneOffsetSeconds" property ' +
                'are prune to bugs related to ambiguous times. For instance, ' +
                '2022-10-30T2:30:00[Europe/Berlin] could be GMT+1 or GMT+2.')

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

            expect(unpackedDateTimeWithoutOffset).toEqual(object)
          })
      )
    })

    it('should pack and unpack DateTimeWithZoneIdAndNoOffset', () => {
      fc.assert(
        fc.property(fc.date(), date => {
          const object = DateTime.fromStandardDate(date)
          const buffer = alloc(256)
          const loggerFunction = jest.fn()
          const protocol = new BoltProtocolV5x7(
            new utils.MessageRecordingConnection(),
            buffer,
            {
              disableLosslessIntegers: true
            },
            undefined,
            new Logger('debug', loggerFunction)
          )

          const packable = protocol.packable(object)

          expect(packable).not.toThrow()

          buffer.reset()

          const unpacked = protocol.unpack(buffer)

          expect(unpacked.timeZoneOffsetSeconds).toBeDefined()

          expect(unpacked).toEqual(object)
        })
      )
    })
  })

  describe('.unpack()', () => {
    it.each([
      [
        'Node',
        new structure.Structure(0x4e, [1, ['a'], { c: 'd' }, 'elementId']),
        new Node(1, ['a'], { c: 'd' }, 'elementId')
      ],
      [
        'Relationship',
        new structure.Structure(0x52, [1, 2, 3, '4', { 5: 6 }, 'elementId', 'node1', 'node2']),
        new Relationship(1, 2, 3, '4', { 5: 6 }, 'elementId', 'node1', 'node2')
      ],
      [
        'UnboundRelationship',
        new structure.Structure(0x72, [1, '2', { 3: 4 }, 'elementId']),
        new UnboundRelationship(1, '2', { 3: 4 }, 'elementId')
      ],
      [
        'Path',
        new structure.Structure(
          0x50,
          [
            [
              new structure.Structure(0x4e, [1, ['2'], { 3: '4' }, 'node1']),
              new structure.Structure(0x4e, [4, ['5'], { 6: 7 }, 'node2']),
              new structure.Structure(0x4e, [2, ['3'], { 4: '5' }, 'node3'])
            ],
            [
              new structure.Structure(0x52, [3, 1, 4, 'reltype1', { 4: '5' }, 'rel1', 'node1', 'node2']),
              new structure.Structure(0x52, [5, 4, 2, 'reltype2', { 6: 7 }, 'rel2', 'node2', 'node3'])
            ],
            [1, 1, 2, 2]
          ]
        ),
        new Path(
          new Node(1, ['2'], { 3: '4' }, 'node1'),
          new Node(2, ['3'], { 4: '5' }, 'node3'),
          [
            new PathSegment(
              new Node(1, ['2'], { 3: '4' }, 'node1'),
              new Relationship(3, 1, 4, 'reltype1', { 4: '5' }, 'rel1', 'node1', 'node2'),
              new Node(4, ['5'], { 6: 7 }, 'node2')
            ),
            new PathSegment(
              new Node(4, ['5'], { 6: 7 }, 'node2'),
              new Relationship(5, 4, 2, 'reltype2', { 6: 7 }, 'rel2', 'node2', 'node3'),
              new Node(2, ['3'], { 4: '5' }, 'node3')
            )
          ]
        )
      ]
    ])('should unpack graph types (%s)', (_, struct, graphObject) => {
      const buffer = alloc(256)
      const protocol = new BoltProtocolV5x7(
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
        new structure.Structure(0x4e, [1, ['a'], { c: 'd' }])
      ],
      [
        'Node with more fields',
        new structure.Structure(0x4e, [1, ['a'], { c: 'd' }, '1', 'b'])
      ],
      [
        'Relationship with less fields',
        new structure.Structure(0x52, [1, 2, 3, '4', { 5: 6 }])
      ],
      [
        'Relationship with more fields',
        new structure.Structure(0x52, [1, 2, 3, '4', { 5: 6 }, '1', '2', '3', '4'])
      ],
      [
        'UnboundRelationship with less fields',
        new structure.Structure(0x72, [1, '2', { 3: 4 }])
      ],
      [
        'UnboundRelationship with more fields',
        new structure.Structure(0x72, [1, '2', { 3: 4 }, '1', '2'])
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
      const buffer = alloc(256)
      const protocol = new BoltProtocolV5x7(
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
        new structure.Structure(0x49, [
          1655212878, 183_000_000, 120 * 60
        ]),
        new DateTime(2022, 6, 14, 15, 21, 18, 183_000_000, 120 * 60)
      ],
      [
        'DateTimeWithZoneOffset / 1978',
        new structure.Structure(0x49, [
          282659759, 128000987, -150 * 60
        ]),
        new DateTime(1978, 12, 16, 10, 5, 59, 128000987, -150 * 60)
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
      ],
      [
        'DateTimeWithZoneId / Honolulu',
        new structure.Structure(0x69, [
          1592231400, 183_000_000, 'Pacific/Honolulu'
        ]),
        new DateTime(2020, 6, 15, 4, 30, 0, 183_000_000, -10 * 60 * 60, 'Pacific/Honolulu')
      ],
      [
        'DateTimeWithZoneId / Midnight',
        new structure.Structure(0x69, [
          1685397950, 183_000_000, 'Europe/Berlin'
        ]),
        new DateTime(2023, 5, 30, 0, 5, 50, 183_000_000, 2 * 60 * 60, 'Europe/Berlin')
      ]
    ])('should unpack spatial types and temporal types (%s)', (_, struct, object) => {
      const buffer = alloc(256)
      const protocol = new BoltProtocolV5x7(
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

    it.each([
      [
        'DateTimeWithZoneOffset/0x46',
        new structure.Structure(0x46, [1, 2, 3])
      ],
      [
        'DateTimeWithZoneId/0x66',
        new structure.Structure(0x66, [1, 2, 'America/Sao_Paulo'])
      ]
    ])('should unpack deprecated temporal types as unknown structs (%s)', (_, struct) => {
      const buffer = alloc(256)
      const protocol = new BoltProtocolV5x7(
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
      expect(unpacked).toEqual(struct)
    })
  })

  describe('result metadata enrichment', () => {
    it('run should configure BoltProtocolV5x7._enrichMetadata as enrichMetadata', () => {
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
      const protocol = new BoltProtocolV5x7(recorder, null, false)
      utils.spyProtocolWrite(protocol)

      const query = 'RETURN $x, $y'
      const parameters = { x: 'x', y: 'y' }

      const observer = protocol.run(query, parameters, {
        bookmarks,
        txConfig,
        database,
        mode: WRITE
      })

      expect(observer._enrichMetadata).toBe(protocol._enrichMetadata)
    })

    describe('BoltProtocolV5x7._enrichMetadata', () => {
      const protocol = newProtocol()

      it('should handle empty metadata', () => {
        const metadata = protocol._enrichMetadata({})

        expect(metadata).toEqual({})
      })

      it('should handle metadata with random objects', () => {
        const metadata = protocol._enrichMetadata({
          a: 1133,
          b: 345
        })

        expect(metadata).toEqual({
          a: 1133,
          b: 345
        })
      })

      it('should handle metadata not change notifications ', () => {
        const metadata = protocol._enrichMetadata({
          a: 1133,
          b: 345,
          notifications: [
            {
              severity: 'WARNING',
              category: 'HINT'
            }
          ]
        })

        expect(metadata).toEqual({
          a: 1133,
          b: 345,
          notifications: [
            {
              severity: 'WARNING',
              category: 'HINT'
            }
          ]
        })
      })

      it.each([
        [null, null],
        [undefined, undefined],
        [[], []],
        [statusesWithDiagnosticRecord(null, null), statusesWithDiagnosticRecord(null, null)],
        [statusesWithDiagnosticRecord(undefined, undefined), statusesWithDiagnosticRecord({
          OPERATION: '',
          OPERATION_CODE: '0',
          CURRENT_SCHEMA: '/'
        },
        {
          OPERATION: '',
          OPERATION_CODE: '0',
          CURRENT_SCHEMA: '/'
        })],
        [
          statusesWithDiagnosticRecord({
            OPERATION: 'A'
          }),
          statusesWithDiagnosticRecord({
            OPERATION: 'A',
            OPERATION_CODE: '0',
            CURRENT_SCHEMA: '/'
          })
        ],
        [
          statusesWithDiagnosticRecord({
            OPERATION: 'A',
            OPERATION_CODE: 'B'
          }),
          statusesWithDiagnosticRecord({
            OPERATION: 'A',
            OPERATION_CODE: 'B',
            CURRENT_SCHEMA: '/'
          })
        ],
        [
          statusesWithDiagnosticRecord({
            OPERATION: 'A',
            OPERATION_CODE: 'B',
            CURRENT_SCHEMA: '/C'
          }),
          statusesWithDiagnosticRecord({
            OPERATION: 'A',
            OPERATION_CODE: 'B',
            CURRENT_SCHEMA: '/C'
          })
        ],
        [
          statusesWithDiagnosticRecord({
            OPERATION: 'A',
            OPERATION_CODE: 'B',
            CURRENT_SCHEMA: '/C',
            _status_parameters: { d: 'E' }
          }),
          statusesWithDiagnosticRecord({
            OPERATION: 'A',
            OPERATION_CODE: 'B',
            CURRENT_SCHEMA: '/C',
            _status_parameters: { d: 'E' }
          })
        ],
        [
          statusesWithDiagnosticRecord({
            OPERATION: 'A',
            OPERATION_CODE: 'B',
            CURRENT_SCHEMA: '/C',
            _status_parameters: { d: 'E' },
            _severity: 'F'
          }),
          statusesWithDiagnosticRecord({
            OPERATION: 'A',
            OPERATION_CODE: 'B',
            CURRENT_SCHEMA: '/C',
            _status_parameters: { d: 'E' },
            _severity: 'F'
          })
        ],
        [
          statusesWithDiagnosticRecord({
            OPERATION: 'A',
            OPERATION_CODE: 'B',
            CURRENT_SCHEMA: '/C',
            _status_parameters: { d: 'E' },
            _severity: 'F',
            _classification: 'G'
          }),
          statusesWithDiagnosticRecord({
            OPERATION: 'A',
            OPERATION_CODE: 'B',
            CURRENT_SCHEMA: '/C',
            _status_parameters: { d: 'E' },
            _severity: 'F',
            _classification: 'G'
          })
        ],
        [
          statusesWithDiagnosticRecord({
            OPERATION: 'A',
            OPERATION_CODE: 'B',
            CURRENT_SCHEMA: '/C',
            _status_parameters: { d: 'E' },
            _severity: 'F',
            _classification: 'G',
            _position: {
              offset: 1,
              line: 2,
              column: 3
            }
          }),
          statusesWithDiagnosticRecord({
            OPERATION: 'A',
            OPERATION_CODE: 'B',
            CURRENT_SCHEMA: '/C',
            _status_parameters: { d: 'E' },
            _severity: 'F',
            _classification: 'G',
            _position: {
              offset: 1,
              line: 2,
              column: 3
            }
          })
        ],
        [
          statusesWithDiagnosticRecord({
            OPERATION: null
          }),
          statusesWithDiagnosticRecord({
            OPERATION: null,
            OPERATION_CODE: '0',
            CURRENT_SCHEMA: '/'
          })
        ],
        [
          statusesWithDiagnosticRecord({
            OPERATION: null,
            OPERATION_CODE: null
          }),
          statusesWithDiagnosticRecord({
            OPERATION: null,
            OPERATION_CODE: null,
            CURRENT_SCHEMA: '/'
          })
        ],
        [
          statusesWithDiagnosticRecord({
            OPERATION: null,
            OPERATION_CODE: null,
            CURRENT_SCHEMA: null
          }),
          statusesWithDiagnosticRecord({
            OPERATION: null,
            OPERATION_CODE: null,
            CURRENT_SCHEMA: null
          })
        ],
        [
          statusesWithDiagnosticRecord({
            OPERATION: null,
            OPERATION_CODE: null,
            CURRENT_SCHEMA: null,
            _status_parameters: null
          }),
          statusesWithDiagnosticRecord({
            OPERATION: null,
            OPERATION_CODE: null,
            CURRENT_SCHEMA: null,
            _status_parameters: null
          })
        ],
        [
          statusesWithDiagnosticRecord({
            OPERATION: null,
            OPERATION_CODE: null,
            CURRENT_SCHEMA: null,
            _status_parameters: null,
            _severity: null
          }),
          statusesWithDiagnosticRecord({
            OPERATION: null,
            OPERATION_CODE: null,
            CURRENT_SCHEMA: null,
            _status_parameters: null,
            _severity: null
          })
        ],
        [
          statusesWithDiagnosticRecord({
            OPERATION: null,
            OPERATION_CODE: null,
            CURRENT_SCHEMA: null,
            _status_parameters: null,
            _severity: null,
            _classification: null
          }),
          statusesWithDiagnosticRecord({
            OPERATION: null,
            OPERATION_CODE: null,
            CURRENT_SCHEMA: null,
            _status_parameters: null,
            _severity: null,
            _classification: null
          })
        ],
        [
          statusesWithDiagnosticRecord({
            OPERATION: null,
            OPERATION_CODE: null,
            CURRENT_SCHEMA: null,
            _status_parameters: null,
            _severity: null,
            _classification: null,
            _position: null
          }),
          statusesWithDiagnosticRecord({
            OPERATION: null,
            OPERATION_CODE: null,
            CURRENT_SCHEMA: null,
            _status_parameters: null,
            _severity: null,
            _classification: null,
            _position: null
          })
        ],
        [
          statusesWithDiagnosticRecord({
            OPERATION: undefined,
            OPERATION_CODE: undefined,
            CURRENT_SCHEMA: undefined,
            _status_parameters: undefined,
            _severity: undefined,
            _classification: undefined,
            _position: undefined
          }),
          statusesWithDiagnosticRecord({
            OPERATION: undefined,
            OPERATION_CODE: undefined,
            CURRENT_SCHEMA: undefined,
            _status_parameters: undefined,
            _severity: undefined,
            _classification: undefined,
            _position: undefined
          })
        ],
        [
          [{
            gql_status: '03N33',
            status_description: 'info: description',
            neo4j_code: 'Neo.Info.My.Code',
            title: 'Mitt title',
            diagnostic_record: {
              _classification: 'SOME',
              _severity: 'INFORMATION'
            }
          }],
          [{
            gql_status: '03N33',
            status_description: 'info: description',
            neo4j_code: 'Neo.Info.My.Code',
            title: 'Mitt title',
            diagnostic_record: {
              OPERATION: '',
              OPERATION_CODE: '0',
              CURRENT_SCHEMA: '/',
              _classification: 'SOME',
              _severity: 'INFORMATION'
            }
          }]
        ],
        [
          [{
            gql_status: '03N33',
            status_description: 'info: description',
            neo4j_code: 'Neo.Info.My.Code',
            description: 'description',
            title: 'Mitt title',
            diagnostic_record: {
              _classification: 'SOME',
              _severity: 'INFORMATION'
            }
          }],
          [{
            gql_status: '03N33',
            status_description: 'info: description',
            neo4j_code: 'Neo.Info.My.Code',
            title: 'Mitt title',
            description: 'description',
            diagnostic_record: {
              OPERATION: '',
              OPERATION_CODE: '0',
              CURRENT_SCHEMA: '/',
              _classification: 'SOME',
              _severity: 'INFORMATION'
            }
          }]
        ],
        [
          [{
            gql_status: '03N33',
            status_description: 'info: description',
            description: 'description'
          }],
          [{
            gql_status: '03N33',
            status_description: 'info: description',
            description: 'description',
            diagnostic_record: {
              OPERATION: '',
              OPERATION_CODE: '0',
              CURRENT_SCHEMA: '/'
            }
          }]
        ]
      ])('should handle statuses (%o) ', (statuses, expectedStatuses) => {
        const metadata = protocol._enrichMetadata({
          a: 1133,
          b: 345,
          statuses
        })

        expect(metadata).toEqual({
          a: 1133,
          b: 345,
          statuses: expectedStatuses
        })
      })
    })

    function statusesWithDiagnosticRecord (...diagnosticRecords) {
      return diagnosticRecords.map(diagnosticRecord => {
        return {
          gql_status: '00000',
          status_description: 'note: successful completion',
          diagnostic_record: diagnosticRecord
        }
      })
    }
  })

  function newProtocol (recorder) {
    return new BoltProtocolV5x7(recorder, null, false, undefined, undefined, () => {})
  }
})

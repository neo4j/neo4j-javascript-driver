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

import {
  internal,
  notificationFilterDisabledCategory,
  notificationFilterMinimumSeverityLevel
} from 'neo4j-driver-core'
import RequestMessage from '../../../src/bolt/request-message'
import { LoginObserver } from '../../../src/bolt/stream-observers'

import utils from '../../test-utils'

const WRITE = 'WRITE'

const {
  txConfig: { TxConfig },
  bookmarks: { Bookmarks }
} = internal

/**
 * @param {function(recorder:MessageRecorder):BoltProtocolV1} createProtocol The protocol factory
 */
export function shouldNotSupportNotificationFilterOnInitialize (createProtocol) {
  describe('initialize', () => {
    function verifyInitialize (notificationFilter) {
      verifyNotificationFilterNotSupportedError(
        createProtocol,
        notificationFilter,
        protocol => protocol.initialize({ notificationFilter }))
    }

    it.each(
      notificationFilterSetFixture()
    )('should throw error when notificationsFilter=%o is set (%o)', (notificationFilter) => {
      verifyInitialize({
        notificationFilter
      })
    })
  })
}

/**
 * @param {function(recorder:MessageRecorder):BoltProtocolV1} createProtocol The protocol factory
 */
export function shouldNotSupportNotificationFilterOnBeginTransaction (createProtocol) {
  describe('beginTransaction', () => {
    function verifyBeginTransaction (notificationFilter) {
      verifyNotificationFilterNotSupportedError(
        createProtocol,
        notificationFilter,
        protocol => protocol.beginTransaction({ notificationFilter }))
    }

    it.each(
      notificationFilterSetFixture()
    )('should throw error when notificationsFilter=%o is set', (notificationFilter) => {
      verifyBeginTransaction(notificationFilter)
    })
  })
}

/**
 * @param {function(recorder:MessageRecorder):BoltProtocolV1} createProtocol The protocol factory
 */
export function shouldNotSupportNotificationFilterOnRun (createProtocol) {
  describe('beginTransaction', () => {
    function verifyRun (notificationFilter) {
      verifyNotificationFilterNotSupportedError(
        createProtocol,
        notificationFilter,
        protocol => protocol.run('query', {}, { notificationFilter }))
    }

    it.each(
      notificationFilterSetFixture()
    )('should throw error when notificationsFilter=%o is set', (notificationFilter) => {
      verifyRun(notificationFilter)
    })
  })
}

/**
 * @param {function(recorder:MessageRecorder):BoltProtocolV1} createProtocol The protocol factory
 */
export function shouldSupportNotificationFilterOnInitialize (createProtocol) {
  it.each(
    notificationFilterFixture()
  )('should send notificationsFilter=%o on initialize', (notificationFilter) => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = createProtocol(recorder)
    utils.spyProtocolWrite(protocol)
    const userAgent = 'js-driver-123'
    const authToken = { type: 'none' }

    const observer = protocol.initialize({ userAgent, authToken, notificationFilter })

    protocol.verifyMessageCount(2)

    expect(protocol.messages[0]).toBeMessage(
      RequestMessage.hello5x2(userAgent, notificationFilter)
    )
    expect(protocol.messages[1]).toBeMessage(
      RequestMessage.logon(authToken)
    )

    verifyObserversAndFlushes(protocol, observer)
  })

  function verifyObserversAndFlushes (protocol, observer) {
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
  }
}

/**
 * @param {function(recorder:MessageRecorder):BoltProtocolV1} createProtocol The protocol factory
 */
export function shouldSupportNotificationFilterOnBeginTransaction (createProtocol) {
  it.each(
    notificationFilterFixture()
  )('should send notificationsFilter=%o on begin a transaction', (notificationFilter) => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = createProtocol(recorder)
    utils.spyProtocolWrite(protocol)

    const database = 'testdb'
    const bookmarks = new Bookmarks([
      'neo4j:bookmark:v1:tx1',
      'neo4j:bookmark:v1:tx2'
    ])
    const txConfig = new TxConfig({
      timeout: 5000,
      metadata: { x: 1, y: 'something' }
    })

    const observer = protocol.beginTransaction({
      bookmarks,
      txConfig,
      database,
      notificationFilter,
      mode: WRITE
    })

    protocol.verifyMessageCount(1)

    expect(protocol.messages[0]).toBeMessage(
      RequestMessage.begin({ bookmarks, txConfig, database, mode: WRITE, notificationFilter })
    )

    expect(protocol.observers).toEqual([observer])
    expect(protocol.flushes).toEqual([true])
  })
}

/**
 * @param {function(recorder:MessageRecorder):BoltProtocolV1} createProtocol The protocol factory
 */
export function shouldSupportNotificationFilterOnRun (createProtocol) {
  it.each(
    notificationFilterFixture()
  )('should send notificationsFilter=%o on run', (notificationFilter) => {
    const recorder = new utils.MessageRecordingConnection()
    const protocol = createProtocol(recorder)
    utils.spyProtocolWrite(protocol)

    const database = 'testdb'
    const bookmarks = new Bookmarks([
      'neo4j:bookmark:v1:tx1',
      'neo4j:bookmark:v1:tx2'
    ])
    const txConfig = new TxConfig({
      timeout: 5000,
      metadata: { x: 1, y: 'something' }
    })
    const query = 'RETURN $x, $y'
    const parameters = { x: 'x', y: 'y' }

    const observer = protocol.run(query, parameters, {
      bookmarks,
      txConfig,
      database,
      mode: WRITE,
      notificationFilter
    })

    protocol.verifyMessageCount(2)

    expect(protocol.messages[0]).toBeMessage(
      RequestMessage.runWithMetadata(query, parameters, {
        bookmarks,
        txConfig,
        database,
        mode: WRITE,
        notificationFilter
      })
    )

    expect(protocol.messages[1]).toBeMessage(RequestMessage.pull())
    expect(protocol.observers).toEqual([observer, observer])
    expect(protocol.flushes).toEqual([false, true])
  })
}

export function notificationFilterFixture () {
  return [
    undefined,
    null,
    ...notificationFilterSetFixture()
  ]
}

/**
 *
 * @returns {Array<NotificationFilter>} Return the list of notification features used in test
 */
function notificationFilterSetFixture () {
  const minimumSeverityLevelSet = Object.values(notificationFilterMinimumSeverityLevel)
  const disabledCategories = Object.values(notificationFilterDisabledCategory)
  const disabledCategoriesSet = [...disabledCategories.keys()]
    .map(length => disabledCategories.slice(0, length + 1))

  /** Polyfill flatMap for Node10 tests */
  if (!minimumSeverityLevelSet.flatMap) {
    minimumSeverityLevelSet.flatMap = function (callback, thisArg) {
      return minimumSeverityLevelSet.concat.apply([], minimumSeverityLevelSet.map(callback, thisArg))
    }
  }

  return [
    {},
    ...minimumSeverityLevelSet.map(minimumSeverityLevel => ({ minimumSeverityLevel })),
    ...disabledCategoriesSet.map(disabledCategories => ({ disabledCategories })),
    ...minimumSeverityLevelSet.flatMap(
      minimumSeverityLevel => disabledCategories.map(
        disabledCategories => ({ minimumSeverityLevel, disabledCategories })))
  ]
}

/**
 * @param {function(recorder:MessageRecorder):BoltProtocolV1} createProtocol The protocol factory
 * @param {string[]} notificationFilter The notification filters.
 * @param {function(protocol: BoltProtocolV1)} fn
 */
function verifyNotificationFilterNotSupportedError (createProtocol, notificationFilter, fn) {
  const recorder = new utils.MessageRecordingConnection()
  const protocol = createProtocol(recorder)

  expect(() => fn(protocol)).toThrowError(
    'Driver is connected to a database that does not support user notification filters. ' +
    'Please upgrade to Neo4j 5.7.0 or later in order to use this functionality. ' +
    `Trying to set notifications to ${JSON.stringify(notificationFilter)}.`
  )
}

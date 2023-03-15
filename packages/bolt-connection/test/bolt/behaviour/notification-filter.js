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

import utils from '../../test-utils'

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
      notificationFilters()
    )('should throw error when notificationFilters is set (%o)', (notificationFilter) => {
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
      notificationFilters()
    )('should throw error when notificationFilters is set', (notificationFilter) => {
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
      notificationFilters()
    )('should throw error when notificationFilters is set', (notificationFilter) => {
      verifyRun(notificationFilter)
    })
  })
}

/**
 *
 * @returns {Array<NotificationFilter>} Return the list of notification features used in test
 */
function notificationFilters () {
  return [
    {},
    { minimumSeverityLevel: 'OFF' },
    { minimumSeverityLevel: 'INFORMATION' },
    { disabledCategories: [] },
    { disabledCategories: ['UNRECOGNIZED'] }
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

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
import {
  NotificationsCategory,
  notificationsCategory,
  NotificationsMinimumSeverityLevel,
  notificationsMinimumSeverityLevel,
  notificationsOff,
  notifications,
  NotificationConfig
} from '../src/notification-config'

describe('notificationsOff()', () => {
  it('should return disable notification config', () => {
    expect(notificationsOff()).toEqual({
      minimumSeverityLevel: 'OFF'
    })
  })
})

describe('notifications()', () => {
  it.each(notificationFixture())('called with %o and %o', (minimumSeverityLevel, disabledCategories, expectedConfig) => {
    expect(notifications(minimumSeverityLevel, disabledCategories))
      .toEqual(expectedConfig)
  })

  function notificationFixture (): Array<[
    NotificationsMinimumSeverityLevel?,
    NotificationsCategory[]?,
    NotificationConfig?
  ]> {
    return [
      [undefined, undefined, {}],
      ['OFF', undefined, { minimumSeverityLevel: 'OFF' }],
      [undefined, ['DEPRECATION', 'PERFORMANCE'], { disabledCategories: ['DEPRECATION', 'PERFORMANCE'] }],
      ['WARNING', ['UNRECOGNIZED', 'GENERIC'], { minimumSeverityLevel: 'WARNING', disabledCategories: ['UNRECOGNIZED', 'GENERIC'] }]
    ]
  }
})

describe('notificationsMinimumSeverityLevel', () => {
  it('should have keys equals to values', () => {
    for (const [key, value] of Object.entries(notificationsMinimumSeverityLevel)) {
      expect(key).toEqual(value)
    }
  })

  it('should values be assignable to NotificationsMinimumSeverityLevel', () => {
    for (const [, value] of Object.entries(notificationsMinimumSeverityLevel)) {
      const assignableValue: NotificationsMinimumSeverityLevel = value
      expect(assignableValue).toBeDefined()
    }
  })

  it.each(getValidNotificationsSeverityLevels())('should have %s as key', (minimumSeverityLevel) => {
    const keys = Object.keys(notificationsMinimumSeverityLevel)
    expect(keys.includes(minimumSeverityLevel)).toBe(true)
  })
})

describe('notificationsCategory', () => {
  it('should have keys equals to values', () => {
    for (const [key, value] of Object.entries(notificationsCategory)) {
      expect(key).toEqual(value)
    }
  })

  it('should values be assignable to NotificationsCategory', () => {
    for (const [, value] of Object.entries(notificationsCategory)) {
      const assignableValue: NotificationsCategory = value
      expect(assignableValue).toBeDefined()
    }
  })

  it.each(getValidNotificationsCategories())('should have %s as key', (category) => {
    const keys = Object.keys(notificationsCategory)
    expect(keys.includes(category)).toBe(true)
  })
})

function getValidNotificationsSeverityLevels (): NotificationsMinimumSeverityLevel[] {
  return [
    'OFF',
    'INFORMATION',
    'WARNING'
  ]
}

function getValidNotificationsCategories (): NotificationsCategory[] {
  return [
    'HINT',
    'DEPRECATION',
    'GENERIC',
    'PERFORMANCE',
    'UNRECOGNIZED',
    'UNSUPPORTED'
  ]
}

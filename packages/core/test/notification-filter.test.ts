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
  NotificationFilterDisabledCategory,
  notificationFilterDisabledCategory,
  NotificationFilterDisabledClassification,
  notificationFilterDisabledClassification,
  NotificationFilterMinimumSeverityLevel,
  notificationFilterMinimumSeverityLevel
} from '../src/notification-filter'

describe('notificationFilterMinimumSeverityLevel', () => {
  it('should have keys equals to values', () => {
    for (const [key, value] of Object.entries(notificationFilterMinimumSeverityLevel)) {
      expect(key).toEqual(value)
    }
  })

  it('should values be assignable to NotificationFilterMinimumSeverityLevel', () => {
    for (const [, value] of Object.entries(notificationFilterMinimumSeverityLevel)) {
      const assignableValue: NotificationFilterMinimumSeverityLevel = value
      expect(assignableValue).toBeDefined()
    }
  })

  it.each(getValidNotificationsSeverityLevels())('should have %s as key', (minimumSeverityLevel) => {
    const keys = Object.keys(notificationFilterMinimumSeverityLevel)
    expect(keys.includes(minimumSeverityLevel)).toBe(true)
  })
})

describe('notificationFilterDisabledCategory', () => {
  it('should have keys equals to values', () => {
    for (const [key, value] of Object.entries(notificationFilterDisabledCategory)) {
      expect(key).toEqual(value)
    }
  })

  it('should values be assignable to NotificationFilterDisabledCategory', () => {
    for (const [, value] of Object.entries(notificationFilterDisabledCategory)) {
      const assignableValue: NotificationFilterDisabledCategory = value
      expect(assignableValue).toBeDefined()
    }
  })

  it.each(getValidNotificationsCategories())('should have %s as key', (category) => {
    const keys = Object.keys(notificationFilterDisabledCategory)
    expect(keys.includes(category)).toBe(true)
  })
})

describe('notificationFilterDisabledClassification', () => {
  it('should have keys equals to values', () => {
    for (const [key, value] of Object.entries(notificationFilterDisabledClassification)) {
      expect(key).toEqual(value)
    }
  })

  it('should values be assignable to NotificationFilterDisabledClassification', () => {
    for (const [, value] of Object.entries(notificationFilterDisabledClassification)) {
      const assignableValue: NotificationFilterDisabledClassification = value
      expect(assignableValue).toBeDefined()
    }
  })

  it.each(getValidNotificationsCategories())('should have %s as key', (category) => {
    const keys = Object.keys(notificationFilterDisabledCategory)
    expect(keys.includes(category)).toBe(true)
  })

  it('should be notificationFilterDisabledCategory', () => {
    expect(notificationFilterDisabledClassification).toBe(notificationFilterDisabledCategory)
  })
})

function getValidNotificationsSeverityLevels (): NotificationFilterMinimumSeverityLevel[] {
  return [
    'OFF',
    'INFORMATION',
    'WARNING'
  ]
}

function getValidNotificationsCategories (): NotificationFilterDisabledCategory[] {
  return [
    'HINT',
    'DEPRECATION',
    'GENERIC',
    'PERFORMANCE',
    'TOPOLOGY',
    'SECURITY',
    'SCHEMA',
    'UNRECOGNIZED',
    'UNSUPPORTED'
  ]
}

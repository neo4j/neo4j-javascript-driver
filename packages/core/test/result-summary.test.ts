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
  ServerInfo,
  Notification,
  NotificationSeverityLevel,
  NotificationCategory,
  notificationSeverityLevel,
  notificationCategory
} from '../src/result-summary'

describe('ServerInfo', () => {
  it.each([
    [
      { address: '192.168.0.1', version: 'neo4j' },
      4.3,
      {
        address: '192.168.0.1',
        protocolVersion: 4.3,
        agent: 'neo4j'
      }
    ],
    [
      { address: '192.168.0.1', version: 'neo4j' },
      undefined,
      {
        address: '192.168.0.1',
        protocolVersion: undefined,
        agent: 'neo4j'
      }
    ],
    [undefined, 4.3, { protocolVersion: 4.3 }],
    [undefined, undefined, {}]
  ])(
    'new ServerInfo(%o, %i) === %j',
    (meta, protocolVersion, expectedServerInfo) => {
      expect(new ServerInfo(meta, protocolVersion)).toEqual(expectedServerInfo)
    }
  )
})

describe('Notification', () => {
  describe('.severityLevel', () => {
    it.each(getValidSeverityLevels())('should fill severityLevel with the rawSeverityLevel equals to %s', rawSeverityLevel => {
      const rawNotification = {
        severity: rawSeverityLevel
      }

      const notification = new Notification(rawNotification)

      expect(notification.severityLevel).toBe(rawSeverityLevel)
      expect(notification.rawSeverityLevel).toBe(rawSeverityLevel)
    })

    it.each([
      'UNKNOWN',
      null,
      undefined,
      'I_AM_NOT_OKAY',
      'information'
    ])('should fill severityLevel UNKNOWN if the rawSeverityLevel equals to %s', rawSeverityLevel => {
      const rawNotification = {
        severity: rawSeverityLevel
      }

      const notification = new Notification(rawNotification)

      expect(notification.severityLevel).toBe('UNKNOWN')
      expect(notification.rawSeverityLevel).toBe(rawSeverityLevel)
    })
  })

  describe('.category', () => {
    it.each(getValidCategories())('should fill category with the rawCategory equals to %s', rawCategory => {
      const rawNotification = {
        category: rawCategory
      }

      const notification = new Notification(rawNotification)

      expect(notification.category).toBe(rawCategory)
      expect(notification.rawCategory).toBe(rawCategory)
    })

    it.each([
      'UNKNOWN',
      undefined,
      null,
      'DUNNO',
      'deprecation'
    ])('should fill category with UNKNOWN the rawCategory equals to %s', rawCategory => {
      const rawNotification = {
        category: rawCategory
      }

      const notification = new Notification(rawNotification)

      expect(notification.category).toBe('UNKNOWN')
      expect(notification.rawCategory).toBe(rawCategory)
    })
  })
})

describe('notificationSeverityLevel', () => {
  it('should have keys equals to values', () => {
    for (const [key, value] of Object.entries(notificationSeverityLevel)) {
      expect(key).toEqual(value)
    }
  })

  it('should values be assignable to NotificationSeverityLevel', () => {
    for (const [, value] of Object.entries(notificationSeverityLevel)) {
      const assignableValue: NotificationSeverityLevel = value
      expect(assignableValue).toBeDefined()
    }
  })

  it.each(getValidSeverityLevels())('should have %s as key', (severity) => {
    const keys = Object.keys(notificationSeverityLevel)
    expect(keys.includes(severity)).toBe(true)
  })
})

describe('notificationCategory', () => {
  it('should have keys equals to values', () => {
    for (const [key, value] of Object.entries(notificationCategory)) {
      expect(key).toEqual(value)
    }
  })

  it('should values be assignable to NotificationCategory', () => {
    for (const [, value] of Object.entries(notificationCategory)) {
      const assignableValue: NotificationCategory = value
      expect(assignableValue).toBeDefined()
    }
  })

  it.each(getValidCategories())('should have %s as key', (category) => {
    const keys = Object.keys(notificationCategory)
    expect(keys.includes(category)).toBe(true)
  })
})

function getValidSeverityLevels (): NotificationSeverityLevel[] {
  return [
    'WARNING',
    'INFORMATION',
    'UNKNOWN'
  ]
}

function getValidCategories (): NotificationCategory[] {
  return [
    'HINT',
    'QUERY',
    'UNSUPPORTED',
    'PERFORMANCE',
    'DEPRECATION',
    'RUNTIME',
    'UNKNOWN'
  ]
}

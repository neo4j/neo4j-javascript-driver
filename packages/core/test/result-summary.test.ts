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

import { int } from '../src'
import {
  ServerInfo,
  Notification,
  NotificationSeverityLevel,
  NotificationCategory,
  notificationSeverityLevel,
  notificationCategory,
  ProfiledPlan,
  QueryStatistics,
  Stats,
  notificationClassification
} from '../src/result-summary'

import fc from 'fast-check'

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

  it('should have values assignable to NotificationSeverityLevel', () => {
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

describe('notificationClassification', () => {
  it('should have keys equals to values', () => {
    for (const [key, value] of Object.entries(notificationClassification)) {
      expect(key).toEqual(value)
    }
  })

  it('should values be assignable to NotificationClassification', () => {
    for (const [, value] of Object.entries(notificationClassification)) {
      const assignableValue: NotificationCategory = value
      expect(assignableValue).toBeDefined()
    }
  })

  it.each(getValidCategories())('should have %s as key', (category) => {
    const keys = Object.keys(notificationClassification)
    expect(keys.includes(category)).toBe(true)
  })

  it('should be notificationCategory', () => {
    expect(notificationClassification).toBe(notificationCategory)
  })
})

describe('ProfilePlan', () => {
  describe.each([
    'dbHits',
    'rows',
    'pageCacheMisses',
    'pageCacheHits',
    'pageCacheHitRatio',
    'time'
  ])('.%s', (field: keyof ProfiledPlan) => {
    it('should handle return arbitrary integer as it is', () => {
      return fc.assert(
        fc.property(
          fc.integer(),
          value => {
            const rawProfilePlan = {
              [field]: value
            }

            const profilePlan = new ProfiledPlan(rawProfilePlan)

            return profilePlan[field] === value
          }
        )
      )
    })

    it('should handle Integer with maxSafeInteger', () => {
      return fc.assert(
        fc.property(
          fc.maxSafeInteger().map(value => [int(value), value]),
          ([value, expectedValue]) => {
            const rawProfilePlan = {
              [field]: value
            }

            const profilePlan = new ProfiledPlan(rawProfilePlan)

            return profilePlan[field] === expectedValue
          }
        )
      )
    })

    it('should handle Integer with arbitrary integer', () => {
      return fc.assert(
        fc.property(
          fc.integer().map(value => [int(value), value]),
          ([value, expectedValue]) => {
            const rawProfilePlan = {
              [field]: value
            }

            const profilePlan = new ProfiledPlan(rawProfilePlan)

            return profilePlan[field] === expectedValue
          }
        )
      )
    })

    it('should handle BigInt with maxSafeInteger', () => {
      return fc.assert(
        fc.property(
          fc.maxSafeInteger().map(value => [BigInt(value), value]),
          ([value, expectedValue]) => {
            const rawProfilePlan = {
              [field]: value
            }

            const profilePlan = new ProfiledPlan(rawProfilePlan)

            return profilePlan[field] === expectedValue
          }
        )
      )
    })

    it('should handle Integer with arbitrary integer', () => {
      return fc.assert(
        fc.property(
          fc.integer().map(value => [BigInt(value), value]),
          ([value, expectedValue]) => {
            const rawProfilePlan = {
              [field]: value
            }

            const profilePlan = new ProfiledPlan(rawProfilePlan)

            return profilePlan[field] === expectedValue
          }
        )
      )
    })
  })
})

describe('QueryStatistics', () => {
  describe.each([
    ['nodesCreated', 'nodes-created'],
    ['nodesDeleted', 'nodes-deleted'],
    ['relationshipsCreated', 'relationships-created'],
    ['relationshipsDeleted', 'relationships-deleted'],
    ['propertiesSet', 'properties-set'],
    ['labelsAdded', 'labels-added'],
    ['labelsRemoved', 'labels-removed'],
    ['indexesAdded', 'indexes-added'],
    ['indexesRemoved', 'indexes-removed'],
    ['constraintsAdded', 'constraints-added'],
    ['constraintsRemoved', 'constraints-removed']
  ])('.updates().%s', (field: keyof Stats, rawField: string) => {
    it('should handle return arbitrary integer as it is', () => {
      return fc.assert(
        fc.property(
          fc.integer(),
          value => {
            const stats = {
              [rawField]: value
            }

            const queryStatistics = new QueryStatistics(stats)

            return queryStatistics.updates()[field] === value
          }
        )
      )
    })

    it('should handle Integer with maxSafeInteger', () => {
      return fc.assert(
        fc.property(
          fc.maxSafeInteger().map(value => [int(value), value]),
          ([value, expectedValue]) => {
            const stats = {
              [rawField]: value
            }

            const queryStatistics = new QueryStatistics(stats)

            return queryStatistics.updates()[field] === expectedValue
          }
        )
      )
    })

    it('should handle Integer with arbitrary integer', () => {
      return fc.assert(
        fc.property(
          fc.integer().map(value => [int(value), value]),
          ([value, expectedValue]) => {
            const stats = {
              [rawField]: value
            }

            const queryStatistics = new QueryStatistics(stats)

            return queryStatistics.updates()[field] === expectedValue
          }
        )
      )
    })

    it('should handle BigInt with maxSafeInteger', () => {
      return fc.assert(
        fc.property(
          fc.maxSafeInteger().map(value => [BigInt(value), value]),
          ([value, expectedValue]) => {
            const stats = {
              [rawField]: value
            }

            const queryStatistics = new QueryStatistics(stats)

            return queryStatistics.updates()[field] === expectedValue
          }
        )
      )
    })

    it('should handle Integer with arbitrary integer', () => {
      return fc.assert(
        fc.property(
          fc.integer().map(value => [BigInt(value), value]),
          ([value, expectedValue]) => {
            const stats = {
              [rawField]: value
            }

            const queryStatistics = new QueryStatistics(stats)

            return queryStatistics.updates()[field] === expectedValue
          }
        )
      )
    })
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
    'UNRECOGNIZED',
    'UNSUPPORTED',
    'PERFORMANCE',
    'TOPOLOGY',
    'SECURITY',
    'DEPRECATION',
    'GENERIC',
    'UNKNOWN'
  ]
}

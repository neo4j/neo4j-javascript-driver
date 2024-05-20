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

import * as json from '../src/json'
import {
  Notification,
  GqlStatusObject,
  NotificationSeverityLevel,
  NotificationCategory,
  notificationSeverityLevel,
  notificationCategory,
  notificationClassification,
  NotificationClassification
} from '../src/notification'

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

describe('GqlStatusObject', () => {
  describe('constructor', () => {
    it('should fill gqlStatus with raw.gql_status', () => {
      const gqlStatus = '00001'
      const rawGqlStatusObject = {
        gql_status: gqlStatus
      }

      const gqlStatusObject = new GqlStatusObject(rawGqlStatusObject)

      expect(gqlStatusObject.gqlStatus).toBe(gqlStatus)
    })

    it('should fill statusDescription with raw.status_description', () => {
      const statusDescription = 'some gql standard status description'
      const rawGqlStatusObject = {
        status_description: statusDescription
      }

      const gqlStatusObject = new GqlStatusObject(rawGqlStatusObject)

      expect(gqlStatusObject.statusDescription).toBe(statusDescription)
    })

    it('should fill diagnosticRecord with raw.diagnostic_record', () => {
      const diagnosticRecord = {
        OPERATION: '',
        OPERATION_CODE: '0',
        CURRENT_SCHEMA: '/',
        _severity: '',
        _classification: '',
        _position: {
          offset: 0,
          line: 0,
          column: 0
        },
        _status_parameters: {}
      }
      const rawGqlStatusObject = {
        diagnostic_record: diagnosticRecord
      }

      const gqlStatusObject = new GqlStatusObject(rawGqlStatusObject)

      expect(gqlStatusObject.diagnosticRecord).toBe(diagnosticRecord)
    })

    it('should fill position with values came from raw.diagnostic_record', () => {
      const diagnosticRecord = {
        OPERATION: '',
        OPERATION_CODE: '0',
        CURRENT_SCHEMA: '/',
        _severity: '',
        _classification: '',
        _position: {
          offset: 0,
          line: 0,
          column: 0
        },
        _status_parameters: {}
      }

      const rawGqlStatusObject = {
        diagnostic_record: diagnosticRecord
      }

      const gqlStatusObject = new GqlStatusObject(rawGqlStatusObject)

      expect(gqlStatusObject.position).toEqual(diagnosticRecord._position)
    })

    it.each(getValidSeverityLevels())('should fill severity with values came from raw.diagnostic_record (%s)', (severity) => {
      const diagnosticRecord = {
        OPERATION: '',
        OPERATION_CODE: '0',
        CURRENT_SCHEMA: '/',
        _severity: severity,
        _classification: '',
        _position: {
          offset: 0,
          line: 0,
          column: 0
        },
        _status_parameters: {}
      }

      const rawGqlStatusObject = {
        diagnostic_record: diagnosticRecord
      }

      const gqlStatusObject = new GqlStatusObject(rawGqlStatusObject)

      expect(gqlStatusObject.severity).toEqual(severity)
      expect(gqlStatusObject.rawSeverity).toEqual(severity)
    })

    it.each([
      'UNKNOWN',
      null,
      undefined,
      'I_AM_NOT_OKAY',
      'information'
    ])('should fill severity UNKNOWN if the raw.diagnostic_record._severity equals to %s', severity => {
      const diagnosticRecord = {
        OPERATION: '',
        OPERATION_CODE: '0',
        CURRENT_SCHEMA: '/',
        _severity: severity,
        _classification: '',
        _position: {
          offset: 0,
          line: 0,
          column: 0
        },
        _status_parameters: {}
      }

      const rawGqlStatusObject = {
        diagnostic_record: diagnosticRecord
      }

      const gqlStatusObject = new GqlStatusObject(rawGqlStatusObject)

      expect(gqlStatusObject.severity).toEqual(notificationSeverityLevel.UNKNOWN)
      expect(gqlStatusObject.rawSeverity).toEqual(severity)
    })

    it.each(getValidClassifications())('should fill classification with values came from raw.diagnostic_record (%s)', (classification) => {
      const diagnosticRecord = {
        OPERATION: '',
        OPERATION_CODE: '0',
        CURRENT_SCHEMA: '/',
        _severity: '',
        _classification: classification,
        _position: {
          offset: 0,
          line: 0,
          column: 0
        },
        _status_parameters: {}
      }

      const rawGqlStatusObject = {
        diagnostic_record: diagnosticRecord
      }

      const gqlStatusObject = new GqlStatusObject(rawGqlStatusObject)

      expect(gqlStatusObject.classification).toEqual(classification)
      expect(gqlStatusObject.rawClassification).toEqual(classification)
    })

    it.each([
      'UNKNOWN',
      undefined,
      null,
      'DUNNO',
      'deprecation'
    ])('should fill classification UNKNOWN if the raw.diagnostic_record._classification equals to %s', classification => {
      const diagnosticRecord = {
        OPERATION: '',
        OPERATION_CODE: '0',
        CURRENT_SCHEMA: '/',
        _severity: '',
        _classification: classification,
        _position: {
          offset: 0,
          line: 0,
          column: 0
        },
        _status_parameters: {}
      }

      const rawGqlStatusObject = {
        diagnostic_record: diagnosticRecord
      }

      const gqlStatusObject = new GqlStatusObject(rawGqlStatusObject)

      expect(gqlStatusObject.classification).toEqual(notificationClassification.UNKNOWN)
      expect(gqlStatusObject.rawClassification).toEqual(classification)
    })
  })

  describe('diagnosticRecordAsJsonString()', () => {
    it('should stringify diagnosticRecord', () => {
      const diagnosticRecord = {
        OPERATION: '',
        OPERATION_CODE: '0',
        CURRENT_SCHEMA: '/',
        _severity: '',
        _classification: '',
        _position: {
          offset: 0,
          line: 0,
          column: 0
        },
        _status_parameters: {}
      }
      const rawGqlStatusObject = {
        diagnostic_record: diagnosticRecord
      }

      const gqlStatusObject = new GqlStatusObject(rawGqlStatusObject)

      expect(gqlStatusObject.diagnosticRecordAsJsonString).toBe(json.stringify(diagnosticRecord))
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

function getValidClassifications (): NotificationClassification[] {
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

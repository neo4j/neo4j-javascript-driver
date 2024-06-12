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
  NotificationClassification,
  polyfillGqlStatusObject,
  polyfillNotification,
  buildGqlStatusObjectFromMetadata,
  buildNotificationsFromMetadata
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

  describe('polyfillNotification()', () => {
    it.each([
      getSuccessStatus(),
      getNoDataStatus(),
      getOmittedResultStatus(),
      getNoDataUnknownSubconditionStatus()
    ])('should return undefined when status is not a notification (%o)', (status: any) => {
      expect(polyfillNotification(status)).toBeUndefined()
    })

    it.each(getValidCategories())('should polyfill severity WARNING', (category) => {
      const status = {
        neo4j_code: 'Neo.Notification.Warning.Code',
        gql_status: '01N42',
        status_description: 'Description',
        title: 'Notification Title',
        diagnostic_record: {
          OPERATION: '',
          OPERATION_CODE: '0',
          CURRENT_SCHEMA: '/',
          _severity: 'WARNING',
          _classification: category,
          _position: {
            offset: 0,
            line: 0,
            column: 0
          },
          _status_parameters: {}
        }
      }

      const notification = polyfillNotification(status)

      expect(notification).toEqual(new Notification({
        code: 'Neo.Notification.Warning.Code',
        title: 'Notification Title',
        description: 'Description',
        severity: 'WARNING',
        position: {
          offset: 0,
          line: 0,
          column: 0
        },
        category
      }))
    })

    it.each(getValidCategories())('should polyfill severity INFORMATION', (category) => {
      const status = {
        neo4j_code: 'Neo.Notification.Warning.Code',
        gql_status: '03N42',
        title: 'Notification Title',
        status_description: 'Description',
        diagnostic_record: {
          OPERATION: '',
          OPERATION_CODE: '0',
          CURRENT_SCHEMA: '/',
          _severity: 'INFORMATION',
          _classification: category,
          _position: {
            offset: 0,
            line: 0,
            column: 0
          },
          _status_parameters: {}
        }
      }

      const notification = polyfillNotification(status)

      expect(notification).toEqual(new Notification({
        code: 'Neo.Notification.Warning.Code',
        title: 'Notification Title',
        description: 'Description',
        severity: 'INFORMATION',
        position: {
          offset: 0,
          line: 0,
          column: 0
        },
        category
      }))
    })

    it.each([
      'UNKNOWN',
      null,
      undefined,
      'I_AM_NOT_OKAY',
      'information'
    ])('should polyfill severity UNKNOWN', (severity) => {
      const status = {
        neo4j_code: 'Neo.Notification.Warning.Code',
        gql_status: '03N42',
        title: 'Notification Title',
        status_description: 'Description',
        diagnostic_record: {
          OPERATION: '',
          OPERATION_CODE: '0',
          CURRENT_SCHEMA: '/',
          _severity: severity,
          _classification: 'UNSUPPORTED',
          _position: {
            offset: 1,
            line: 2,
            column: 3
          },
          _status_parameters: {}
        }
      }

      const notification = polyfillNotification(status)

      expect(notification).toEqual(new Notification({
        code: 'Neo.Notification.Warning.Code',
        title: 'Notification Title',
        description: 'Description',
        severity,
        position: {
          offset: 1,
          line: 2,
          column: 3
        },
        category: 'UNSUPPORTED'
      }))
    })

    it('should polyfill when diagnostic record is not present', () => {
      const status = {
        neo4j_code: 'Neo.Notification.Warning.Code',
        gql_status: '03N42',
        title: 'Notification Title',
        status_description: 'Description'
      }

      const notification = polyfillNotification(status)

      expect(notification).toEqual(new Notification({
        code: 'Neo.Notification.Warning.Code',
        title: 'Notification Title',
        description: 'Description'
      }))
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

    it('should fill position with values from raw.diagnostic_record', () => {
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

  describe('polyfillGqlStatusObject()', () => {
    it.each(getValidCategories())('should polyfill severity WARNING', (category) => {
      const rawNotification = {
        code: 'Neo.Notification.Warning.Code',
        title: 'Notification Title',
        description: 'Description',
        severity: 'WARNING',
        position: {
          offset: 0,
          line: 0,
          column: 0
        },
        category
      }

      const gqlStatusObject = polyfillGqlStatusObject(rawNotification)

      expect(gqlStatusObject).toEqual(new GqlStatusObject({
        neo4j_code: rawNotification.code,
        gql_status: '01N42',
        status_description: rawNotification.description,
        diagnostic_record: {
          OPERATION: '',
          OPERATION_CODE: '0',
          CURRENT_SCHEMA: '/',
          _severity: 'WARNING',
          _classification: category,
          _position: {
            offset: 0,
            line: 0,
            column: 0
          }
        }
      }))
    })

    it.each(getValidCategories())('should polyfill severity WARNING and no description', (category) => {
      const rawNotification = {
        code: 'Neo.Notification.Warning.Code',
        title: 'Notification Title',
        severity: 'WARNING',
        position: {
          offset: 0,
          line: 0,
          column: 0
        },
        category
      }

      const gqlStatusObject = polyfillGqlStatusObject(rawNotification)

      expect(gqlStatusObject).toEqual(new GqlStatusObject({
        neo4j_code: rawNotification.code,
        gql_status: '01N42',
        status_description: 'warn: warning - unknown warning',
        diagnostic_record: {
          OPERATION: '',
          OPERATION_CODE: '0',
          CURRENT_SCHEMA: '/',
          _severity: 'WARNING',
          _classification: category,
          _position: {
            offset: 0,
            line: 0,
            column: 0
          }
        }
      }))
    })

    it.each(getValidCategories())('should polyfill severity INFORMATION', (category) => {
      const rawNotification = {
        code: 'Neo.Notification.Warning.Code',
        title: 'Notification Title',
        description: 'Description',
        severity: 'INFORMATION',
        position: {
          offset: 0,
          line: 0,
          column: 0
        },
        category
      }

      const gqlStatusObject = polyfillGqlStatusObject(rawNotification)

      expect(gqlStatusObject).toEqual(new GqlStatusObject({
        neo4j_code: rawNotification.code,
        gql_status: '03N42',
        status_description: rawNotification.description,
        diagnostic_record: {
          OPERATION: '',
          OPERATION_CODE: '0',
          CURRENT_SCHEMA: '/',
          _severity: 'INFORMATION',
          _classification: category,
          _position: {
            offset: 0,
            line: 0,
            column: 0
          }
        }
      }))
    })

    it.each(getValidCategories())('should polyfill severity INFORMATION and no description', (category) => {
      const rawNotification = {
        code: 'Neo.Notification.Warning.Code',
        title: 'Notification Title',
        severity: 'INFORMATION',
        position: {
          offset: 0,
          line: 0,
          column: 0
        },
        category
      }

      const gqlStatusObject = polyfillGqlStatusObject(rawNotification)

      expect(gqlStatusObject).toEqual(new GqlStatusObject({
        neo4j_code: rawNotification.code,
        gql_status: '03N42',
        status_description: 'info: informational - unknown notification',
        diagnostic_record: {
          OPERATION: '',
          OPERATION_CODE: '0',
          CURRENT_SCHEMA: '/',
          _severity: 'INFORMATION',
          _classification: category,
          _position: {
            offset: 0,
            line: 0,
            column: 0
          }
        }
      }))
    })

    it.each([
      'UNKNOWN',
      null,
      undefined,
      'I_AM_NOT_OKAY',
      'information'
    ])('should polyfill severity UNKNOWN', (severity) => {
      const rawNotification = {
        code: 'Neo.Notification.Warning.Code',
        title: 'Notification Title',
        description: 'Description',
        severity,
        position: {
          offset: 0,
          line: 0,
          column: 0
        },
        category: 'UNSUPPORTED'
      }

      const gqlStatusObject = polyfillGqlStatusObject(rawNotification)

      expect(gqlStatusObject).toEqual(new GqlStatusObject({
        neo4j_code: rawNotification.code,
        gql_status: '03N42',
        status_description: rawNotification.description,
        diagnostic_record: {
          OPERATION: '',
          OPERATION_CODE: '0',
          CURRENT_SCHEMA: '/',
          _severity: severity != null ? severity : undefined,
          _classification: rawNotification.category,
          _position: {
            offset: 0,
            line: 0,
            column: 0
          }
        }
      }))
    })

    it.each([
      'UNKNOWN',
      null,
      undefined,
      'I_AM_NOT_OKAY',
      'information'
    ])('should polyfill UNKNOWN and no description', (severity) => {
      const rawNotification = {
        code: 'Neo.Notification.Warning.Code',
        title: 'Notification Title',
        severity,
        position: {
          offset: 0,
          line: 0,
          column: 0
        },
        category: 'UNSUPPORTED'
      }

      const gqlStatusObject = polyfillGqlStatusObject(rawNotification)

      expect(gqlStatusObject).toEqual(new GqlStatusObject({
        neo4j_code: rawNotification.code,
        gql_status: '03N42',
        status_description: 'info: informational - unknown notification',
        diagnostic_record: {
          OPERATION: '',
          OPERATION_CODE: '0',
          CURRENT_SCHEMA: '/',
          _severity: severity != null ? severity : undefined,
          _classification: rawNotification.category,
          _position: {
            offset: 0,
            line: 0,
            column: 0
          }
        }
      }))
    })
  })
})

describe('buildGqlStatusObjectFromMetadata', () => {
  it.each([
    {
      statuses: getValidStatus(),
      notifications: [{
        severity: 'WARNING',
        description: 'Some description',
        code: 'Neo.Notification.Warning.Code',
        title: 'The title',
        category: 'DEPRECATION',
        position: {
          offset: 10,
          line: 13,
          column: 123
        }
      }]
    },
    {
      statuses: [
        {
          gql_status: '00000',
          status_description: 'successful completion — omitted',
          diagnostic_record: {
            OPERATION_CODE: '0',
            CURRENT_SCHEMA: '/'
          }
        }
      ],
      notifications: [{
        severity: 'WARNING',
        description: 'Some description',
        code: 'Neo.Notification.Warning.Code',
        title: 'The title',
        category: 'DEPRECATION',
        position: {
          offset: 10,
          line: 13,
          column: 123
        }
      }]
    },
    {
      statuses: [
        {
          gql_status: '00000',
          status_description: 'successful completion — omitted',
          diagnostic_record: {
            OPERATION_CODE: '0',
            CURRENT_SCHEMA: '/'
          }
        }
      ]
    },
    {
      statuses: []
    },
    {
      statuses: [],
      notifications: [
        {
          severity: 'WARNING',
          description: 'Some description',
          code: 'Neo.Notification.Warning.Code',
          title: 'The title',
          category: 'DEPRECATION',
          position: {
            offset: 10,
            line: 13,
            column: 123
          }
        }
      ]
    }
  ])('should build from statuses when available', (metadata: any) => {
    const expectedStatuses = metadata.statuses.map((status: any) => new GqlStatusObject(status))

    expect(buildGqlStatusObjectFromMetadata(metadata)).toEqual(expectedStatuses)
  })

  it.each([
    // SUCCESS
    [
      getSuccessStatusObject(), 0, {
        stream_summary: {
          have_records_streamed: true
        }
      }
    ],
    [
      getSuccessStatusObject(), 0, {
        stream_summary: {
          have_records_streamed: true
        },
        notifications: []
      }
    ],
    [
      getSuccessStatusObject(), 1, {
        stream_summary: {
          have_records_streamed: true
        },
        notifications: [{
          code: 'Neo.Notification.Warning.Code',
          title: 'Notification Title',
          description: 'Description',
          severity: 'WARNING',
          position: {
            offset: 0,
            line: 0,
            column: 0
          },
          category: 'TOPOLOGY'
        }]
      }
    ],
    [
      getSuccessStatusObject(), 2, {
        stream_summary: {
          have_records_streamed: true
        },
        notifications: [{
          code: 'Neo.Notification.Warning.Code',
          title: 'Notification Title',
          description: 'Description',
          severity: 'WARNING',
          position: {
            offset: 0,
            line: 0,
            column: 0
          },
          category: 'TOPOLOGY'
        }, {
          code: 'Neo.Notification.Warning.Code',
          title: 'Notification Title',
          description: 'Description',
          severity: 'WARNING',
          position: {
            offset: 0,
            line: 0,
            column: 0
          },
          category: 'TOPOLOGY'
        }]
      }
    ],
    [
      getSuccessStatusObject(), 2, {
        stream_summary: {
          have_records_streamed: true
        },
        notifications: [{
          code: 'Neo.Notification.Warning.Code',
          title: 'Notification Title',
          description: 'Description',
          severity: 'WARNING',
          position: {
            offset: 0,
            line: 0,
            column: 0
          },
          category: 'TOPOLOGY'
        }, {
          code: 'Neo.Notification.Warning.Code',
          title: 'Notification Title',
          description: 'Description',
          severity: 'WARNING',
          position: {
            offset: 0,
            line: 0,
            column: 0
          },
          category: 'TOPOLOGY'
        }, {
          code: 'Neo.Notification.Info.Code',
          title: 'Notification Title',
          description: 'Description',
          severity: 'INFORMATION',
          position: {
            offset: 0,
            line: 0,
            column: 0
          },
          category: 'TOPOLOGY'
        }]
      }
    ],
    [
      getSuccessStatusObject(), 0, {
        stream_summary: {
          have_records_streamed: true
        },
        notifications: [{
          code: 'Neo.Notification.Info.Code',
          title: 'Notification Title',
          description: 'Description',
          severity: 'INFORMATION',
          position: {
            offset: 0,
            line: 0,
            column: 0
          },
          category: 'TOPOLOGY'
        }, {
          code: 'Neo.Notification.Info.Code',
          title: 'Notification Title',
          description: 'Description',
          severity: 'INFORMATION',
          position: {
            offset: 0,
            line: 0,
            column: 0
          },
          category: 'TOPOLOGY'
        }]
      }
    ],
    // NO DATA
    [
      getNoDataStatusObject(), 0, {
        stream_summary: {
          have_records_streamed: false,
          pulled: true,
          has_keys: true
        }
      }
    ],
    [
      getNoDataStatusObject(), 0, {
        stream_summary: {
          have_records_streamed: false,
          pulled: true,
          has_keys: true
        },
        notifications: []
      }
    ],
    [
      getNoDataStatusObject(), 0, {
        stream_summary: {
          have_records_streamed: false,
          pulled: true,
          has_keys: true
        },
        notifications: [{
          code: 'Neo.Notification.Warning.Code',
          title: 'Notification Title',
          description: 'Description',
          severity: 'WARNING',
          position: {
            offset: 0,
            line: 0,
            column: 0
          },
          category: 'TOPOLOGY'
        }]
      }
    ],
    [
      getNoDataStatusObject(), 0, {
        stream_summary: {
          have_records_streamed: false,
          pulled: true,
          has_keys: true
        },
        notifications: [{
          code: 'Neo.Notification.Warning.Code',
          title: 'Notification Title',
          description: 'Description',
          severity: 'WARNING',
          position: {
            offset: 0,
            line: 0,
            column: 0
          },
          category: 'TOPOLOGY'
        },
        {
          code: 'Neo.Notification.Warning.Code',
          title: 'Notification Title',
          description: 'Description',
          severity: 'WARNING',
          position: {
            offset: 0,
            line: 0,
            column: 0
          },
          category: 'TOPOLOGY'
        }]
      }
    ],
    // OMITTED RESULT
    [
      getOmittedResultStatusObject(), 0, {
        stream_summary: {
          have_records_streamed: false,
          pulled: true,
          has_keys: false
        }
      }
    ],
    [
      getOmittedResultStatusObject(), 0, {
        stream_summary: {
          have_records_streamed: false,
          pulled: true,
          has_keys: false
        },
        notifications: []
      }
    ],
    [
      getOmittedResultStatusObject(), 1, {
        stream_summary: {
          have_records_streamed: false,
          pulled: true,
          has_keys: false
        },
        notifications: [{
          code: 'Neo.Notification.Warning.Code',
          title: 'Notification Title',
          description: 'Description',
          severity: 'WARNING',
          position: {
            offset: 0,
            line: 0,
            column: 0
          },
          category: 'TOPOLOGY'
        }]
      }
    ],
    [
      getOmittedResultStatusObject(), 2, {
        stream_summary: {
          have_records_streamed: false,
          pulled: true,
          has_keys: false
        },
        notifications: [{
          code: 'Neo.Notification.Warning.Code',
          title: 'Notification Title',
          description: 'Description',
          severity: 'WARNING',
          position: {
            offset: 0,
            line: 0,
            column: 0
          },
          category: 'TOPOLOGY'
        },
        {
          code: 'Neo.Notification.Warning.Code',
          title: 'Notification Title',
          description: 'Description',
          severity: 'WARNING',
          position: {
            offset: 0,
            line: 0,
            column: 0
          },
          category: 'TOPOLOGY'
        }]
      }
    ],
    [
      getOmittedResultStatusObject(), 1, {
        stream_summary: {
          have_records_streamed: false,
          pulled: true,
          has_keys: false
        },
        notifications: [{
          code: 'Neo.Notification.Warning.Code',
          title: 'Notification Title',
          description: 'Description',
          severity: 'WARNING',
          position: {
            offset: 0,
            line: 0,
            column: 0
          },
          category: 'TOPOLOGY'
        },
        {
          code: 'Neo.Notification.Information.Code',
          title: 'Notification Title',
          description: 'Description',
          severity: 'INFORMATION',
          position: {
            offset: 0,
            line: 0,
            column: 0
          },
          category: 'TOPOLOGY'
        }]
      }
    ],
    // NO DATA - UNKNOWN SUBCONDITION
    [
      getNoDataUnknownSubconditionStatusObject(), 0, {
        stream_summary: {
          have_records_streamed: false,
          pulled: false,
          has_keys: true
        }
      }
    ],
    [
      getNoDataUnknownSubconditionStatusObject(), 0, {
        stream_summary: {
          have_records_streamed: false,
          pulled: false,
          has_keys: true
        },
        notifications: []
      }
    ],
    [
      getNoDataUnknownSubconditionStatusObject(), 0, {
        stream_summary: {
          have_records_streamed: false,
          pulled: false,
          has_keys: true
        },
        notifications: [{
          code: 'Neo.Notification.Warning.Code',
          title: 'Notification Title',
          description: 'Description',
          severity: 'WARNING',
          position: {
            offset: 0,
            line: 0,
            column: 0
          },
          category: 'TOPOLOGY'
        }]
      }
    ]
  ])('should build from notifications when statuses not available', (filledObject: GqlStatusObject, position: number, metadata: any) => {
    const notifications = metadata.notifications != null ? metadata.notifications : []
    const expectedStatuses = notifications.map(polyfillGqlStatusObject)
    expectedStatuses.splice(position, 0, filledObject)

    expect(buildGqlStatusObjectFromMetadata(metadata)).toEqual(expectedStatuses)
  })
})

describe('buildNotificationsFromMetadata', () => {
  it.each([
    [
      {
      }
    ],
    [
      {
        notifications: []
      }
    ],
    [
      {
        notifications: [],
        statuses: getValidNotificationStatus()
      }
    ],
    [
      {
        notifications: [{
          code: 'Neo.Notification.Warning.Code',
          title: 'Notification Title',
          description: 'Description',
          severity: 'WARNING',
          position: {
            offset: 0,
            line: 0,
            column: 0
          },
          category: 'TOPOLOGY'
        }]
      }
    ],
    [
      {
        notifications: [{
          code: 'Neo.Notification.Warning.Code',
          title: 'Notification Title',
          description: 'Description',
          severity: 'WARNING',
          position: {
            offset: 0,
            line: 0,
            column: 0
          },
          category: 'TOPOLOGY'
        }],
        statuses: getValidNotificationStatus()
      }
    ],
    [
      {
        notifications: [{
          code: 'Neo.Notification.Warning.Code',
          title: 'Notification Title',
          description: 'Description',
          severity: 'WARNING',
          position: {
            offset: 0,
            line: 0,
            column: 0
          },
          category: 'TOPOLOGY'
        }, {
          code: 'Neo.Notification.Warning.Code',
          title: 'Notification Title',
          description: 'Description',
          severity: 'WARNING',
          position: {
            offset: 0,
            line: 0,
            column: 0
          },
          category: 'TOPOLOGY'
        }]
      }
    ],
    [
      {
        notifications: [{
          code: 'Neo.Notification.Warning.Code',
          title: 'Notification Title',
          description: 'Description',
          severity: 'WARNING',
          position: {
            offset: 0,
            line: 0,
            column: 0
          },
          category: 'TOPOLOGY'
        }, {
          code: 'Neo.Notification.Warning.Code',
          title: 'Notification Title',
          description: 'Description',
          severity: 'WARNING',
          position: {
            offset: 0,
            line: 0,
            column: 0
          },
          category: 'TOPOLOGY'
        }, {
          code: 'Neo.Notification.Info.Code',
          title: 'Notification Title',
          description: 'Description',
          severity: 'INFORMATION',
          position: {
            offset: 0,
            line: 0,
            column: 0
          },
          category: 'TOPOLOGY'
        }]
      }
    ],
    [
      {
        stream_summary: {
          have_records_streamed: true
        },
        notifications: [{
          code: 'Neo.Notification.Info.Code',
          title: 'Notification Title',
          description: 'Description',
          severity: 'INFORMATION',
          position: {
            offset: 0,
            line: 0,
            column: 0
          },
          category: 'TOPOLOGY'
        }, {
          code: 'Neo.Notification.Info.Code',
          title: 'Notification Title',
          description: 'Description',
          severity: 'INFORMATION',
          position: {
            offset: 0,
            line: 0,
            column: 0
          },
          category: 'TOPOLOGY'
        }],
        statuses: [getSuccessStatusObject()]
      }
    ]
  ])('should build from notifications when available', (metadata: any) => {
    const notifications = metadata.notifications != null ? metadata.notifications : []
    const expectedNotifications = notifications.map((notification: any) => new Notification(notification))

    expect(buildNotificationsFromMetadata(metadata)).toEqual(expectedNotifications)
  })

  it.each([
    {
      statuses: getValidStatus()
    },
    {
      statuses: [
        {
          gql_status: '00000',
          status_description: 'successful completion — omitted',
          diagnostic_record: {
            OPERATION_CODE: '0',
            CURRENT_SCHEMA: '/'
          }
        }
      ]
    },
    {
      statuses: []
    }
  ])('should build from statuses when notifications not available', (metadata: any) => {
    const expectedNotifications = metadata.statuses.map(polyfillNotification)
      .filter((notification: unknown) => notification != null)

    expect(buildNotificationsFromMetadata(metadata)).toEqual(expectedNotifications)
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

function getValidStatus (): any[] {
  return [
    {
      gql_status: '00000',
      status_description: 'note: successful completion',
      diagnostic_record: {
        OPERATION_CODE: '0',
        CURRENT_SCHEMA: '/',
        _status_parameters: {},
        _severity: '',
        _classification: '',
        _position: {
          offset: -1,
          line: -1,
          column: -1
        }
      }
    },
    ...getValidNotificationStatus()
  ]
}

function getValidNotificationStatus (): any [] {
  return [
    {
      gql_status: '01N00',
      status_description: 'warn: warning - feature deprecated',
      neo4j_code: 'Neo.Some.Warning.Code',
      title: 'the title',
      diagnostic_record: {
        OPERATION: '',
        OPERATION_CODE: '0',
        CURRENT_SCHEMA: '/',
        _status_parameters: {},
        _severity: 'WARNING',
        _classification: 'DEPRECATION'
      }
    },
    {
      gql_status: '03N60',
      status_description: 'info: informational - subquery variable shadowing',
      neo4j_code: 'Neo.Some.Informational.Code',
      title: 'the title',
      diagnostic_record: {
        OPERATION: '',
        OPERATION_CODE: '0',
        CURRENT_SCHEMA: '/',
        _status_parameters: {},
        _severity: 'INFORMATION',
        _classification: 'HINT'
      }
    }
  ]
}

function getSuccessStatus (): any {
  return {
    gql_status: '00000',
    status_description: 'note: successful completion',
    diagnostic_record: {
      OPERATION: '',
      OPERATION_CODE: '0',
      CURRENT_SCHEMA: '/'
    }
  }
}

function getSuccessStatusObject (): GqlStatusObject {
  return new GqlStatusObject(getSuccessStatus())
}

function getNoDataStatus (): any {
  return {
    gql_status: '02000',
    status_description: 'note: no data',
    diagnostic_record: {
      OPERATION: '',
      OPERATION_CODE: '0',
      CURRENT_SCHEMA: '/'
    }
  }
}

function getNoDataStatusObject (): GqlStatusObject {
  return new GqlStatusObject(getNoDataStatus())
}

function getOmittedResultStatus (): any {
  return {
    gql_status: '00001',
    status_description: 'note: successful completion - omitted result',
    diagnostic_record: {
      OPERATION: '',
      OPERATION_CODE: '0',
      CURRENT_SCHEMA: '/'
    }
  }
}

function getOmittedResultStatusObject (): GqlStatusObject {
  return new GqlStatusObject(getOmittedResultStatus())
}

function getNoDataUnknownSubconditionStatus (): any {
  return {
    gql_status: '02N42',
    status_description: 'note: no data - unknown subcondition',
    diagnostic_record: {
      OPERATION: '',
      OPERATION_CODE: '0',
      CURRENT_SCHEMA: '/'
    }
  }
}

function getNoDataUnknownSubconditionStatusObject (): GqlStatusObject {
  return new GqlStatusObject(getNoDataUnknownSubconditionStatus())
}

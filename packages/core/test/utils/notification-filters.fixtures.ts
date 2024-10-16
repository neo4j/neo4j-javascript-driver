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
import { NotificationFilter, notificationFilterDisabledCategory, notificationFilterMinimumSeverityLevel } from '../../src'
import { notificationFilterDisabledClassification } from '../../src/notification-filter'

export function validNotificationFilters (): Array<NotificationFilter | undefined> {
  return [
    undefined,
    {
      minimumSeverityLevel: 'OFF'
    },
    {
      minimumSeverityLevel: notificationFilterMinimumSeverityLevel.INFORMATION
    },
    {
      disabledCategories: []
    },
    {
      disabledCategories: ['DEPRECATION']
    },
    {
      disabledCategories: [notificationFilterDisabledCategory.GENERIC, notificationFilterDisabledCategory.PERFORMANCE]
    },
    {
      disabledCategories: [notificationFilterDisabledCategory.GENERIC, 'PERFORMANCE']
    },
    {
      minimumSeverityLevel: notificationFilterMinimumSeverityLevel.INFORMATION,
      disabledCategories: [notificationFilterDisabledCategory.GENERIC, notificationFilterDisabledCategory.PERFORMANCE]
    },
    {
      disabledClassifications: []
    },
    {
      disabledClassifications: ['DEPRECATION']
    },
    {
      disabledClassifications: [notificationFilterDisabledClassification.GENERIC, notificationFilterDisabledClassification.PERFORMANCE]
    },
    {
      disabledClassifications: [notificationFilterDisabledClassification.GENERIC, 'PERFORMANCE']
    },
    {
      minimumSeverityLevel: notificationFilterMinimumSeverityLevel.INFORMATION,
      disabledClassifications: [notificationFilterDisabledClassification.GENERIC, notificationFilterDisabledClassification.PERFORMANCE]
    }
  ]
}

export function invalidNotificationFilters (): Array<NotificationFilter | undefined> {
  return [
    {
      disabledCategories: [],
      disabledClassifications: []
    },
    {
      disabledCategories: [notificationFilterDisabledCategory.GENERIC, notificationFilterDisabledCategory.PERFORMANCE],
      disabledClassifications: []
    },
    {
      disabledCategories: [],
      disabledClassifications: [notificationFilterDisabledClassification.GENERIC, notificationFilterDisabledClassification.PERFORMANCE]
    },
    {
      minimumSeverityLevel: notificationFilterMinimumSeverityLevel.INFORMATION,
      disabledCategories: [],
      disabledClassifications: []
    },
    {
      minimumSeverityLevel: notificationFilterMinimumSeverityLevel.INFORMATION,
      disabledCategories: [notificationFilterDisabledCategory.GENERIC, notificationFilterDisabledCategory.PERFORMANCE],
      disabledClassifications: []
    },
    {
      minimumSeverityLevel: notificationFilterMinimumSeverityLevel.INFORMATION,
      disabledCategories: [],
      disabledClassifications: [notificationFilterDisabledClassification.GENERIC, notificationFilterDisabledClassification.PERFORMANCE]
    }
  ]
}

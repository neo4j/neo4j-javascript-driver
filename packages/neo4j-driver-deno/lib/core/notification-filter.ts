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
  NotificationCategory,
  NotificationClassification,
  NotificationSeverityLevel
} from './notification.ts'

type ExcludeUnknown<T> = Exclude<T, 'UNKNOWN'>
type OFF = 'OFF'
type EnumRecord<T extends string | symbol> = { [key in T]: key }

type NotificationFilterMinimumSeverityLevel = ExcludeUnknown<NotificationSeverityLevel> | OFF
/**
 * @typedef {'WARNING' | 'INFORMATION' | 'OFF'} NotificationFilterMinimumSeverityLevel
 */
/**
 * Constants that represents the minimum Severity level in the {@link NotificationFilter}
 */
const notificationFilterMinimumSeverityLevel: EnumRecord<NotificationFilterMinimumSeverityLevel> = {
  OFF: 'OFF',
  WARNING: 'WARNING',
  INFORMATION: 'INFORMATION'
}
Object.freeze(notificationFilterMinimumSeverityLevel)

type NotificationFilterDisabledCategory = ExcludeUnknown<NotificationCategory>
/**
 * @typedef {'HINT' | 'UNRECOGNIZED' | 'UNSUPPORTED' |'PERFORMANCE' | 'TOPOLOGY' | 'SECURITY' | 'DEPRECATION' | 'GENERIC'} NotificationFilterDisabledCategory
 */
/**
 * Constants that represents the disabled categories in the {@link NotificationFilter}
 */
const notificationFilterDisabledCategory: EnumRecord<NotificationFilterDisabledCategory> = {
  HINT: 'HINT',
  UNRECOGNIZED: 'UNRECOGNIZED',
  UNSUPPORTED: 'UNSUPPORTED',
  PERFORMANCE: 'PERFORMANCE',
  TOPOLOGY: 'TOPOLOGY',
  SECURITY: 'SECURITY',
  DEPRECATION: 'DEPRECATION',
  GENERIC: 'GENERIC'
}
Object.freeze(notificationFilterDisabledCategory)

type NotificationFilterDisabledClassification = ExcludeUnknown<NotificationClassification>
/**
 * @typedef {NotificationFilterDisabledCategory} NotificationFilterDisabledClassification
 * @experimental
 */
/**
 * Constants that represents the disabled classifications in the {@link NotificationFilter}
 *
 * @type {notificationFilterDisabledCategory}
 * @experimental
 */
const notificationFilterDisabledClassification: EnumRecord<NotificationFilterDisabledClassification> = notificationFilterDisabledCategory

/**
 * The notification filter object which can be configured in
 * the session and driver creation.
 *
 * Values not defined are interpreted as default.
 *
 * @interface
 */
class NotificationFilter {
  minimumSeverityLevel?: NotificationFilterMinimumSeverityLevel
  disabledCategories?: NotificationFilterDisabledCategory[]
  disabledClassifications?: NotificationFilterDisabledClassification[]

  /**
   * @constructor
   * @private
   */
  constructor () {
    /**
     * The minimum level of all notifications to receive.
     *
     * @public
     * @type {?NotificationFilterMinimumSeverityLevel}
     */
    this.minimumSeverityLevel = undefined

    /**
     * Categories the user would like to opt-out of receiving.
     *
     *
     * This property is equivalent to {@link NotificationFilter#disabledClassifications}
     * and it should not be enabled at same time.
     *
     * @type {?NotificationFilterDisabledCategory[]}
     */
    this.disabledCategories = undefined

    /**
     * Classifications the user would like to opt-out of receiving.
     *
     * This property is equivalent to {@link NotificationFilter#disabledCategories}
     * and it should not be enabled at same time.
     *
     *
     * @type {?NotificationFilterDisabledClassification[]}
     * @experimental
     */
    this.disabledClassifications = undefined

    throw new Error('Not implemented')
  }
}

export default NotificationFilter

export {
  notificationFilterMinimumSeverityLevel,
  notificationFilterDisabledCategory,
  notificationFilterDisabledClassification
}

export type {
  NotificationFilterMinimumSeverityLevel,
  NotificationFilterDisabledCategory,
  NotificationFilterDisabledClassification
}

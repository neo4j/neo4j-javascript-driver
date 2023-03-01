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
  NotificationCategory,
  NotificationSeverityLevel
} from './result-summary'

type ExcludeUnknown<T> = Exclude<T, 'UNKNOWN'>
type OFF = 'OFF'
type EnumRecord<T extends string | symbol> = { [key in T]: key }

type NotificationsMinimumSeverityLevel = ExcludeUnknown<NotificationSeverityLevel> | OFF
/**
 * @typedef {'WARNING' | 'INFORMATION' | 'DISABLED'} NotificationsMinimumSeverityLevel
 */
/**
 * Constants that represents the minimum Severity level in the {@link NotificationConfig}
 */
const notificationsMinimumSeverityLevel: EnumRecord<NotificationsMinimumSeverityLevel> = {
  OFF: 'OFF',
  WARNING: 'WARNING',
  INFORMATION: 'INFORMATION'
}
Object.freeze(notificationsMinimumSeverityLevel)

type NotificationsCategory = ExcludeUnknown<NotificationCategory>
/**
 * @typedef {'HINT' | 'UNRECOGNIZED' | 'UNSUPPORTED' |'PERFORMANCE' | 'DEPRECATION' | 'GENERIC' } NotificationsCategory
 */
/**
 * Constants that represents the disabled categories in the {@link NotificationConfig}
 */
const notificationsCategory: EnumRecord<NotificationsCategory> = {
  HINT: 'HINT',
  UNRECOGNIZED: 'UNRECOGNIZED',
  UNSUPPORTED: 'UNSUPPORTED',
  PERFORMANCE: 'PERFORMANCE',
  DEPRECATION: 'DEPRECATION',
  GENERIC: 'GENERIC'
}
Object.freeze(notificationsCategory)

/**
 * The notification config object used
 *
 * @interface
 */
class NotificationConfig {
  minimumSeverityLevel?: NotificationsMinimumSeverityLevel
  disabledCategories?: NotificationsCategory[]

  /**
   * @constructor
   * @private
   */
  constructor () {
    /**
     * The minimum level of all notifications to receive.
     *
     * @public
     * @type {?NotificationsMinimumSeverityLevel}
     */
    this.minimumSeverityLevel = undefined

    /**
     * Categories the user would like to opt-out of receiving.
     * @type {?NotificationsCategory[]}
     */
    this.disabledCategories = undefined

    throw new Error('Not implemented')
  }
}

/**
 * Creates a {@link NotificationConfig} for disabling the notifications.
 *
 * @returns {NotificationConfig} Notification configuration with disabled.
 */
function notificationsOff (): NotificationConfig {
  return {
    minimumSeverityLevel: notificationsMinimumSeverityLevel.OFF
  }
}

/**
 * Creates a {@link NotificationConfig} with {@link NotificationConfig#minimumSeverityLevel}
 * and {@link NotificationConfig#disabledCategories}.
 *
 * @param {NotificationsMinimumSeverityLevel} [minimumSeverityLevel=undefined] The minimum level of all notifications to receive.
 * @param {NotificationsCategory[]} [disabledCategories=undefined] Categories the user would like to opt-out of receiving.
 * @returns {NotificationConfig}
 */
function notifications (
  minimumSeverityLevel?: NotificationsMinimumSeverityLevel,
  disabledCategories?: NotificationsCategory[]
): NotificationConfig {
  return {
    minimumSeverityLevel,
    disabledCategories
  }
}

export {
  notificationsMinimumSeverityLevel,
  notificationsCategory,
  notificationsOff,
  notifications,
  NotificationConfig
}

export type {
  NotificationsMinimumSeverityLevel,
  NotificationsCategory
}

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
import { util } from './internal'

interface NotificationPosition {
  offset?: number
  line?: number
  column?: number
}

type NotificationSeverityLevel = 'WARNING' | 'INFORMATION' | 'UNKNOWN'
/**
 * @typedef {'WARNING' | 'INFORMATION' | 'UNKNOWN'} NotificationSeverityLevel
 */
/**
 * Constants that represents the Severity level in the {@link Notification}
 */
const notificationSeverityLevel: { [key in NotificationSeverityLevel]: key } = {
  WARNING: 'WARNING',
  INFORMATION: 'INFORMATION',
  UNKNOWN: 'UNKNOWN'
}

Object.freeze(notificationSeverityLevel)
const severityLevels = Object.values(notificationSeverityLevel)

type NotificationCategory = 'HINT' | 'UNRECOGNIZED' | 'UNSUPPORTED' | 'PERFORMANCE' |
'TOPOLOGY' | 'SECURITY' | 'DEPRECATION' | 'GENERIC' | 'UNKNOWN'
/**
 * @typedef {'HINT' | 'UNRECOGNIZED' | 'UNSUPPORTED' |'PERFORMANCE' | 'TOPOLOGY' | 'SECURITY' | 'DEPRECATION' | 'GENERIC' | 'UNKNOWN' } NotificationCategory
 */
/**
 * Constants that represents the Category in the {@link Notification}
 */
const notificationCategory: { [key in NotificationCategory]: key } = {
  HINT: 'HINT',
  UNRECOGNIZED: 'UNRECOGNIZED',
  UNSUPPORTED: 'UNSUPPORTED',
  PERFORMANCE: 'PERFORMANCE',
  DEPRECATION: 'DEPRECATION',
  TOPOLOGY: 'TOPOLOGY',
  SECURITY: 'SECURITY',
  GENERIC: 'GENERIC',
  UNKNOWN: 'UNKNOWN'
}

Object.freeze(notificationCategory)
const categories = Object.values(notificationCategory)

type NotificationClassification = NotificationCategory
/**
 * @typedef {NotificationCategory} NotificationClassification
 * @experimental
 */
/**
 * Constants that represents the Classification in the {@link GqlStatusObject}
 * @type {notificationCategory}
 * @experimental
 */
const notificationClassification = notificationCategory

/**
 * Class for Cypher notifications
 * @access public
 */
class Notification {
  code: string
  title: string
  description: string
  severity: string
  position: NotificationPosition | {}
  severityLevel: NotificationSeverityLevel
  category: NotificationCategory
  rawSeverityLevel: string
  rawCategory?: string

  /**
   * Create a Notification instance
   * @constructor
   * @param {Object} notification - Object with notification data
   */
  constructor (notification: any) {
    /**
     * The code
     * @type {string}
     * @public
     */
    this.code = notification.code
    /**
     * The title
     * @type {string}
     * @public
     */
    this.title = notification.title
    /**
     * The description
     * @type {string}
     * @public
     */
    this.description = notification.description
    /**
     * The raw severity
     *
     * Use {@link Notification#rawSeverityLevel} for the raw value or {@link Notification#severityLevel} for an enumerated value.
     *
     * @type {string}
     * @public
     * @deprecated This property will be removed in 6.0.
     */
    this.severity = notification.severity
    /**
     * The position which the notification had occur.
     *
     * @type {NotificationPosition}
     * @public
     */
    this.position = Notification._constructPosition(notification.position)

    /**
     * The severity level
     *
     * @type {NotificationSeverityLevel}
     * @public
     * @example
     * const { summary } = await session.run("RETURN 1")
     *
     * for (const notification of summary.notifications) {
     *     switch(notification.severityLevel) {
     *         case neo4j.notificationSeverityLevel.INFORMATION: // or simply 'INFORMATION'
     *             console.info(`${notification.title} - ${notification.description}`)
     *             break
     *         case neo4j.notificationSeverityLevel.WARNING: // or simply 'WARNING'
     *             console.warn(`${notification.title} - ${notification.description}`)
     *             break
     *         case neo4j.notificationSeverityLevel.UNKNOWN: // or simply 'UNKNOWN'
     *         default:
     *             // the raw info came from the server could be found at notification.rawSeverityLevel
     *             console.log(`${notification.title} - ${notification.description}`)
     *             break
     *     }
     * }
     */
    this.severityLevel = severityLevels.includes(notification.severity)
      ? notification.severity
      : notificationSeverityLevel.UNKNOWN

    /**
     * The severity level returned by the server without any validation.
     *
     * @type {string}
     * @public
     */
    this.rawSeverityLevel = notification.severity

    /**
     * The category
     *
     * @type {NotificationCategory}
     * @public
     * @example
     * const { summary } = await session.run("RETURN 1")
     *
     * for (const notification of summary.notifications) {
     *     switch(notification.category) {
     *         case neo4j.notificationCategory.QUERY: // or simply 'QUERY'
     *             console.info(`${notification.title} - ${notification.description}`)
     *             break
     *         case neo4j.notificationCategory.PERFORMANCE: // or simply 'PERFORMANCE'
     *             console.warn(`${notification.title} - ${notification.description}`)
     *             break
     *         case neo4j.notificationCategory.UNKNOWN: // or simply 'UNKNOWN'
     *         default:
     *             // the raw info came from the server could be found at notification.rawCategory
     *             console.log(`${notification.title} - ${notification.description}`)
     *             break
     *     }
     * }
     */
    this.category = categories.includes(notification.category)
      ? notification.category
      : notificationCategory.UNKNOWN

    /**
     * The category returned by the server without any validation.
     *
     * @type {string|undefined}
     * @public
     */
    this.rawCategory = notification.category
  }

  static _constructPosition (pos: NotificationPosition): NotificationPosition {
    if (pos == null) {
      return {}
    }
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    return {
      offset: util.toNumber(pos.offset!),
      line: util.toNumber(pos.line!),
      column: util.toNumber(pos.column!)
    }
    /* eslint-enable @typescript-eslint/no-non-null-assertion */
  }
}

/**
 * Representation for GqlStatusObject found when executing a query.
 * <p>
 * This object represents a status of query execution.
 * This status is a superset of {@link Notification}.
 *
 * @experimental
 */
class GqlStatusObject {
  /**
   * The GQLSTATUS
   */
  getGqlStatus (): String {
    return ''
  }

  /**
   * Retrieve the severity from the diagnostic record.
   */
  getSeverity (): NotificationSeverityLevel {
    return notificationSeverityLevel.UNKNOWN
  }

  /**
   * Retrieve the severity from the diagnostic record as string.
   */
  getRawSeverity (): String {
    return ''
  }

  /**
     * Retrieve the classification from the diagnostic record.
     */
  getClassification (): NotificationClassification {
    return notificationClassification.UNKNOWN
  }

  /**
   * Retrieve the classification from the diagnostic record as string
   */
  getRawClassification (): String {
    return ''
  }
}

export default Notification

export {
  notificationSeverityLevel,
  notificationCategory,
  notificationClassification,
  Notification,
  GqlStatusObject
}

export type {
  NotificationPosition,
  NotificationSeverityLevel,
  NotificationCategory,
  NotificationClassification
}

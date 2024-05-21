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
import * as json from './json'
import { util } from './internal'

interface NotificationPosition {
  offset?: number
  line?: number
  column?: number
}

type UnknownGqlStatus = `${'01' | '02' | '03' | '50'}N42`

const unknownGqlStatus: Record<string, UnknownGqlStatus> = {
  WARNING: '01N42',
  NO_DATA: '02N42',
  INFORMATION: '03N42',
  ERROR: '50N42'
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
    this.position = _constructPosition(notification.position)

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
    this.severityLevel = _asEnumerableSeverity(this.severity)

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
    this.category = _asEnumerableClassification(notification.category)

    /**
     * The category returned by the server without any validation.
     *
     * @type {string|undefined}
     * @public
     */
    this.rawCategory = notification.category
  }
}

interface DiagnosticRecord {
  OPERATION: string
  OPERATION_CODE: string
  CURRENT_SCHEMA: string
  _severity?: string
  _classification?: string
  _position?: object
  _status_parameters?: object
  [key: string]: unknown
}

/**
 * Representation for GqlStatusObject found when executing a query.
 * <p>
 * This object represents a status of query execution.
 * This status is a superset of {@link Notification}.
 *
 * @experimental
 * @public
 */
class GqlStatusObject {
  public readonly gqlStatus: string
  public readonly statusDescription: string
  public readonly diagnosticRecord: DiagnosticRecord
  public readonly position: NotificationPosition
  public readonly severity: NotificationSeverityLevel
  public readonly rawSeverity?: string
  public readonly classification: NotificationClassification
  public readonly rawClassification?: string

  constructor (rawGqlStatusObject: any) {
    /**
     * The GQLSTATUS
     *
     * @type {string}
     * @public
     */
    this.gqlStatus = rawGqlStatusObject.gql_status

    /**
     * The GQLSTATUS description
     *
     * @type {string}
     * @public
     */
    this.statusDescription = rawGqlStatusObject.status_description

    /**
     * The diagnostic record as it is.
     *
     * @type {object}
     * @public
     */
    this.diagnosticRecord = rawGqlStatusObject.diagnostic_record ?? {}

    /**
     * The position which the notification had occur.
     *
     * @type {NotificationPosition}
     * @public
     */
    this.position = _constructPosition(this.diagnosticRecord._position)

    /**
     * The severity
     *
     * @type {NotificationSeverityLevel}
     * @public
     * @example
     * const { summary } = await session.run("RETURN 1")
     *
     * for (const gqlStatusObject of summary.gqlStatusObjects) {
     *     switch(gqlStatusObject.severity) {
     *         case neo4j.notificationSeverityLevel.INFORMATION: // or simply 'INFORMATION'
     *             console.info(gqlStatusObject.statusDescription)
     *             break
     *         case neo4j.notificationSeverityLevel.WARNING: // or simply 'WARNING'
     *             console.warn(gqlStatusObject.statusDescription)
     *             break
     *         case neo4j.notificationSeverityLevel.UNKNOWN: // or simply 'UNKNOWN'
     *         default:
     *             // the raw info came from the server could be found at gqlStatusObject.rawSeverity
     *             console.log(gqlStatusObject.statusDescription)
     *             break
     *     }
     * }
     */
    this.severity = _asEnumerableSeverity(this.diagnosticRecord._severity)

    /**
     * The severity returned in the diagnostic record from the server without any validation.
     *
     * @type {string | undefined}
     * @public
     */
    this.rawSeverity = this.diagnosticRecord._severity

    /**
     * The classification
     *
     * @type {NotificationClassification}
     * @public
     * @example
     * const { summary } = await session.run("RETURN 1")
     *
     * for (const gqlStatusObject of summary.gqlStatusObjects) {
     *     switch(gqlStatusObject.classification) {
     *         case neo4j.notificationClassification.QUERY: // or simply 'QUERY'
     *             console.info(gqlStatusObject.statusDescription)
     *             break
     *         case neo4j.notificationClassification.PERFORMANCE: // or simply 'PERFORMANCE'
     *             console.warn(gqlStatusObject.statusDescription)
     *             break
     *         case neo4j.notificationClassification.UNKNOWN: // or simply 'UNKNOWN'
     *         default:
     *             // the raw info came from the server could be found at notification.rawCategory
     *             console.log(gqlStatusObject.statusDescription)
     *             break
     *     }
     * }
     */
    this.classification = _asEnumerableClassification(this.diagnosticRecord._classification)

    /**
     * The category returned by the server without any validation.
     *
     * @type {string|undefined}
     * @public
     */
    this.rawClassification = this.diagnosticRecord._classification
    Object.freeze(this)
  }

  /**
   * The json string representation of the diagnostic record.
   * The goal of this method is provide a serialized object for human inspection.
   *
   * @type {string}
   * @public
   */
  public get diagnosticRecordAsJsonString (): string {
    return json.stringify(this.diagnosticRecord)
  }
}

/**
 *
 * @private
 * @param status
 * @returns {Notification|undefined}
 */
function polyfillNotification (status: any): Notification | undefined {
  // Non notification status should have neo4j_code
  if (status.neo4j_code == null) {
    return undefined
  }

  return new Notification({
    code: status.neo4j_code,
    title: status.title,
    description: status.status_description,
    severity: status.diagnostic_record?._severity,
    category: status.diagnostic_record?._classification,
    position: status.diagnostic_record?._position
  })
}

/**
 * @private
 * @param notification
 * @returns {GqlStatusObject}
 */
function polyfillGqlStatusObject (notification: any): GqlStatusObject {
  return new GqlStatusObject({
    gql_status: notification.severity === notificationSeverityLevel.WARNING ? unknownGqlStatus.WARNING : unknownGqlStatus.INFORMATION,
    status_description: notification.description,
    neo4j_code: notification.code,
    title: notification.title,
    diagnostic_record: {
      OPERATION: '',
      OPERATION_CODE: '0',
      CURRENT_SCHEMA: '/',
      _status_parameters: {},
      _severity: notification.severity,
      _classification: notification.category,
      _position: notification.position
    }
  })
}

const defaultRawDiagnosticRecord = {
  OPERATION: '',
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

Object.freeze(defaultRawDiagnosticRecord)

/**
 * This objects are used for polyfilling the first status on the status list
 *
 * @private
 */
const staticGqlStatusObjects = {
  SUCCESS: new GqlStatusObject({
    gql_status: '00000',
    status_description: 'successful completion',
    diagnostic_record: defaultRawDiagnosticRecord
  }),
  NO_DATA: new GqlStatusObject({
    gql_status: '02000',
    status_description: 'no data',
    diagnostic_record: defaultRawDiagnosticRecord
  }),
  NO_DATA_UNKNOWN_SUBCONDITION: new GqlStatusObject({
    gql_status: unknownGqlStatus.NO_DATA,
    status_description: 'no data - unknown subcondition',
    diagnostic_record: defaultRawDiagnosticRecord
  }),
  OMITTED_RESULT: new GqlStatusObject({
    gql_status: '00001',
    status_description: 'successful completion - omitted',
    diagnostic_record: defaultRawDiagnosticRecord
  })
}

Object.freeze(staticGqlStatusObjects)

/**
 *
 * @private
 * @param metadata
 * @returns
 */
function buildGqlStatusObjectFromMetadata (metadata: any): [GqlStatusObject, ...GqlStatusObject[]] {
  function getGqlStatusObjectFromStreamSummary (summary: any): GqlStatusObject {
    if (summary?.have_records_streamed === true) {
      return staticGqlStatusObjects.SUCCESS
    }

    if (summary?.has_keys === false) {
      return staticGqlStatusObjects.OMITTED_RESULT
    }

    if (summary?.pulled === true) {
      return staticGqlStatusObjects.NO_DATA
    }

    return staticGqlStatusObjects.NO_DATA_UNKNOWN_SUBCONDITION
  }

  if (metadata.statuses != null) {
    return metadata.statuses.map((status: unknown) => new GqlStatusObject(status))
  }

  return [getGqlStatusObjectFromStreamSummary(metadata.stream_summary), ...(metadata.notifications?.map(polyfillGqlStatusObject) ?? [])]
}

/**
 *
 * @private
 * @param pos
 * @returns {NotificationPosition}
 */
function _constructPosition (pos: any): NotificationPosition {
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

function _asEnumerableSeverity (severity: any): NotificationSeverityLevel {
  return severityLevels.includes(severity)
    ? severity
    : notificationSeverityLevel.UNKNOWN
}

function _asEnumerableClassification (classification: any): NotificationClassification {
  return categories.includes(classification)
    ? classification
    : notificationClassification.UNKNOWN
}

export default Notification

export {
  notificationSeverityLevel,
  notificationCategory,
  notificationClassification,
  Notification,
  GqlStatusObject,
  polyfillGqlStatusObject,
  polyfillNotification,
  buildGqlStatusObjectFromMetadata
}

export type {
  NotificationPosition,
  NotificationSeverityLevel,
  NotificationCategory,
  NotificationClassification,
  DiagnosticRecord
}

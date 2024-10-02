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
import * as json from './json.ts'
import { util } from './internal/index.ts'
import { DiagnosticRecord, rawPolyfilledDiagnosticRecord } from './gql-constants.ts'

interface NotificationPosition {
  offset?: number
  line?: number
  column?: number
}

type UnknownGqlStatus = `${'01' | '02' | '03' | '50'}N42`

const unknownGqlStatus: Record<string, { gql_status: UnknownGqlStatus, status_description: string }> = {
  WARNING: {
    gql_status: '01N42',
    status_description: 'warn: unknown warning'
  },
  NO_DATA: {
    gql_status: '02N42',
    status_description: 'note: no data - unknown subcondition'
  },
  INFORMATION: {
    gql_status: '03N42',
    status_description: 'info: unknown notification'
  },
  ERROR: {
    gql_status: '50N42',
    status_description: 'error: general processing exception - unexpected error'
  }
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
'TOPOLOGY' | 'SECURITY' | 'DEPRECATION' | 'GENERIC' | 'SCHEMA' | 'UNKNOWN'
/**
 * @typedef {'HINT' | 'UNRECOGNIZED' | 'UNSUPPORTED' |'PERFORMANCE' | 'TOPOLOGY' | 'SECURITY' | 'DEPRECATION' | 'GENERIC' | 'SCHEMA' | 'UNKNOWN' } NotificationCategory
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
  SCHEMA: 'SCHEMA',
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
    this.severityLevel = _asEnumerableSeverity(notification.severity)

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
  public readonly position?: NotificationPosition
  public readonly severity: NotificationSeverityLevel
  public readonly rawSeverity?: string
  public readonly classification: NotificationClassification
  public readonly rawClassification?: string
  public readonly isNotification: boolean

  /**
   *
   * @param rawGqlStatusObject
   * @private
   */
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
     * The position at which the notification had occurred.
     *
     * @type {NotificationPosition | undefined}
     * @public
     */
    this.position = this.diagnosticRecord._position != null ? _constructPosition(this.diagnosticRecord._position) : undefined

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
     *             // the raw info came from the server can be found at notification.rawCategory
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

    /**
     * Indicates if this object represents a notification and it can be filtered using
     * NotificationFilter.
     *
     * Only GqlStatusObject which is Notification has meaningful position, severity and
     * classification.
     *
     * @type {boolean}
     * @public
     */
    this.isNotification = rawGqlStatusObject.neo4j_code != null
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
    return json.stringify(this.diagnosticRecord, { useCustomToString: true })
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
    description: status.description,
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
  const defaultStatus = notification.severity === notificationSeverityLevel.WARNING ? unknownGqlStatus.WARNING : unknownGqlStatus.INFORMATION
  const polyfilledRawObj: any & { diagnostic_record: DiagnosticRecord } = {
    gql_status: defaultStatus.gql_status,
    status_description: notification.description ?? defaultStatus.status_description,
    neo4j_code: notification.code,
    title: notification.title,
    diagnostic_record: {
      ...rawPolyfilledDiagnosticRecord
    }
  }

  if (notification.severity != null) {
    polyfilledRawObj.diagnostic_record._severity = notification.severity
  }

  if (notification.category != null) {
    polyfilledRawObj.diagnostic_record._classification = notification.category
  }

  if (notification.position != null) {
    polyfilledRawObj.diagnostic_record._position = notification.position
  }

  return new GqlStatusObject(polyfilledRawObj)
}

/**
 * This objects are used for polyfilling the first status on the status list
 *
 * @private
 */
const staticGqlStatusObjects = {
  SUCCESS: new GqlStatusObject({
    gql_status: '00000',
    status_description: 'note: successful completion',
    diagnostic_record: rawPolyfilledDiagnosticRecord
  }),
  NO_DATA: new GqlStatusObject({
    gql_status: '02000',
    status_description: 'note: no data',
    diagnostic_record: rawPolyfilledDiagnosticRecord
  }),
  NO_DATA_UNKNOWN_SUBCONDITION: new GqlStatusObject({
    ...unknownGqlStatus.NO_DATA,
    diagnostic_record: rawPolyfilledDiagnosticRecord
  }),
  OMITTED_RESULT: new GqlStatusObject({
    gql_status: '00001',
    status_description: 'note: successful completion - omitted result',
    diagnostic_record: rawPolyfilledDiagnosticRecord
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

  const clientGenerated = getGqlStatusObjectFromStreamSummary(metadata.stream_summary)
  const polyfilledObjects = [clientGenerated, ...(metadata.notifications?.map(polyfillGqlStatusObject) ?? []) as GqlStatusObject[]]

  return polyfilledObjects.sort((a: GqlStatusObject, b: GqlStatusObject) => calculateWeight(a) - calculateWeight(b)) as [GqlStatusObject, ...GqlStatusObject[]]
}

const gqlStatusWeightByClass = Object.freeze({
  '02': 0,
  '01': 1,
  '00': 2
})
/**
 * GqlStatus weight
 *
 * @private
 */
function calculateWeight (gqlStatusObject: GqlStatusObject): number {
  const gqlClass = gqlStatusObject.gqlStatus?.slice(0, 2)
  // @ts-expect-error
  return gqlStatusWeightByClass[gqlClass] ?? 9999
}

/**
 *
 * @private
 * @param metadata
 * @returns
 */
function buildNotificationsFromMetadata (metadata: any): Notification[] {
  if (metadata.notifications != null) {
    return metadata.notifications.map((n: any) => new Notification(n))
  }

  if (metadata.statuses != null) {
    return metadata.statuses.map(polyfillNotification).filter((n: unknown) => n != null)
  }

  return []
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
  buildGqlStatusObjectFromMetadata,
  buildNotificationsFromMetadata
}

export type {
  NotificationPosition,
  NotificationSeverityLevel,
  NotificationCategory,
  NotificationClassification
}

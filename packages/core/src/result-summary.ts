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

import Integer, { int } from './integer'
import { NumberOrInteger } from './graph-types'

/**
 * A ResultSummary instance contains structured metadata for a {@link Result}.
 * @access public
 */
class ResultSummary<T extends NumberOrInteger = Integer> {
  query: { text: string; parameters: { [key: string]: any } }
  queryType: string
  counters: QueryStatistics
  updateStatistics: QueryStatistics
  plan: Plan | false
  profile: ProfiledPlan | false
  notifications: Notification[]
  server: ServerInfo
  resultConsumedAfter: T
  resultAvailableAfter: T
  database: { name: string | undefined | null }
  /**
   * @constructor
   * @param {string} query - The query this summary is for
   * @param {Object} parameters - Parameters for the query
   * @param {Object} metadata - Query metadata
   * @param {number|undefined} protocolVersion - Bolt Protocol Version
   */
  constructor(
    query: string,
    parameters: { [key: string]: any },
    metadata: any,
    protocolVersion?: number
  ) {
    /**
     * The query and parameters this summary is for.
     * @type {{text: string, parameters: Object}}
     * @public
     */
    this.query = { text: query, parameters }

    /**
     * The type of query executed. Can be "r" for read-only query, "rw" for read-write query,
     * "w" for write-only query and "s" for schema-write query.
     * String constants are available in {@link queryType} object.
     * @type {string}
     * @public
     */
    this.queryType = metadata.type

    /**
     * Counters for operations the query triggered.
     * @type {QueryStatistics}
     * @public
     */
    this.counters = new QueryStatistics(metadata.stats || {})
    // for backwards compatibility, remove in future version
    /**
     * Use {@link ResultSummary.counters} instead.
     * @type {QueryStatistics}
     * @deprecated
     */
    this.updateStatistics = this.counters

    /**
     * This describes how the database will execute the query.
     * Query plan for the executed query if available, otherwise undefined.
     * Will only be populated for queries that start with "EXPLAIN".
     * @type {Plan|false}
     * @public
     */
    this.plan =
      metadata.plan || metadata.profile
        ? new Plan(metadata.plan || metadata.profile)
        : false

    /**
     * This describes how the database did execute your query. This will contain detailed information about what
     * each step of the plan did. Profiled query plan for the executed query if available, otherwise undefined.
     * Will only be populated for queries that start with "PROFILE".
     * @type {ProfiledPlan}
     * @public
     */
    this.profile = metadata.profile ? new ProfiledPlan(metadata.profile) : false

    /**
     * An array of notifications that might arise when executing the query. Notifications can be warnings about
     * problematic queries or other valuable information that can be presented in a client. Unlike failures
     * or errors, notifications do not affect the execution of a query.
     * @type {Array<Notification>}
     * @public
     */
    this.notifications = this._buildNotifications(metadata.notifications)

    /**
     * The basic information of the server where the result is obtained from.
     * @type {ServerInfo}
     * @public
     */
    this.server = new ServerInfo(metadata.server, protocolVersion)

    /**
     * The time it took the server to consume the result.
     * @type {number}
     * @public
     */
    this.resultConsumedAfter = metadata.result_consumed_after

    /**
     * The time it took the server to make the result available for consumption in milliseconds.
     * @type {number}
     * @public
     */
    this.resultAvailableAfter = metadata.result_available_after

    /**
     * The database name where this summary is obtained from.
     * @type {{name: string}}
     * @public
     */
    this.database = { name: metadata.db || null }
  }

  _buildNotifications(notifications: any[]): Notification[] {
    if (!notifications) {
      return []
    }
    return notifications.map(function(n: any): Notification {
      return new Notification(n)
    })
  }

  /**
   * Check if the result summary has a plan
   * @return {boolean}
   */
  hasPlan(): boolean {
    return this.plan instanceof Plan
  }

  /**
   * Check if the result summary has a profile
   * @return {boolean}
   */
  hasProfile(): boolean {
    return this.profile instanceof ProfiledPlan
  }
}

/**
 * Class for execution plan received by prepending Cypher with EXPLAIN.
 * @access public
 */
class Plan {
  operatorType: string
  identifiers: string[]
  arguments: { [key: string]: string }
  children: Plan[]

  /**
   * Create a Plan instance
   * @constructor
   * @param {Object} plan - Object with plan data
   */
  constructor(plan: any) {
    this.operatorType = plan.operatorType
    this.identifiers = plan.identifiers
    this.arguments = plan.args
    this.children = plan.children
      ? plan.children.map((child: any) => new Plan(child))
      : []
  }
}

/**
 * Class for execution plan received by prepending Cypher with PROFILE.
 * @access public
 */
class ProfiledPlan {
  operatorType: string
  identifiers: string[]
  arguments: { [key: string]: string }
  dbHits: number
  rows: number
  pageCacheMisses: number
  pageCacheHits: number
  pageCacheHitRatio: number
  time: number
  children: ProfiledPlan[]

  /**
   * Create a ProfiledPlan instance
   * @constructor
   * @param {Object} profile - Object with profile data
   */
  constructor(profile: any) {
    this.operatorType = profile.operatorType
    this.identifiers = profile.identifiers
    this.arguments = profile.args
    this.dbHits = valueOrDefault('dbHits', profile)
    this.rows = valueOrDefault('rows', profile)
    this.pageCacheMisses = valueOrDefault('pageCacheMisses', profile)
    this.pageCacheHits = valueOrDefault('pageCacheHits', profile)
    this.pageCacheHitRatio = valueOrDefault('pageCacheHitRatio', profile)
    this.time = valueOrDefault('time', profile)
    this.children = profile.children
      ? profile.children.map((child: any) => new ProfiledPlan(child))
      : []
  }

  hasPageCacheStats(): boolean {
    return (
      this.pageCacheMisses > 0 ||
      this.pageCacheHits > 0 ||
      this.pageCacheHitRatio > 0
    )
  }
}

/**
 * Stats Query statistics dictionary for a {@link QueryStatistics}
 * @public
 */
class Stats {
  nodesCreated: number
  nodesDeleted: number
  relationshipsCreated: number
  relationshipsDeleted: number
  propertiesSet: number
  labelsAdded: number
  labelsRemoved: number
  indexesAdded: number
  indexesRemoved: number
  constraintsAdded: number
  constraintsRemoved: number;
  [key: string]: number

  /**
   * @constructor
   * @private
   */
  constructor() {
    /**
     * nodes created
     * @type {number}
     * @public
     */
    this.nodesCreated = 0
    /**
     * nodes deleted
     * @type {number}
     * @public
     */
    this.nodesDeleted = 0
    /**
     * relationships created
     * @type {number}
     * @public
     */
    this.relationshipsCreated = 0
    /**
     * relationships deleted
     * @type {number}
     * @public
     */
    this.relationshipsDeleted = 0
    /**
     * properties set
     * @type {number}
     * @public
     */
    this.propertiesSet = 0
    /**
     * labels added
     * @type {number}
     * @public
     */
    this.labelsAdded = 0
    /**
     * labels removed
     * @type {number}
     * @public
     */
    this.labelsRemoved = 0
    /**
     * indexes added
     * @type {number}
     * @public
     */
    this.indexesAdded = 0
    /**
     * indexes removed
     * @type {number}
     * @public
     */
    this.indexesRemoved = 0
    /**
     * constraints added
     * @type {number}
     * @public
     */
    this.constraintsAdded = 0
    /**
     * constraints removed
     * @type {number}
     * @public
     */
    this.constraintsRemoved = 0
  }
}

/**
 * Get statistical information for a {@link Result}.
 * @access public
 */
class QueryStatistics {
  private _stats: Stats
  private _systemUpdates: number
  private _containsSystemUpdates?: boolean
  private _containsUpdates?: boolean

  /**
   * Structurize the statistics
   * @constructor
   * @param {Object} statistics - Result statistics
   */
  constructor(statistics: any) {
    this._stats = {
      nodesCreated: 0,
      nodesDeleted: 0,
      relationshipsCreated: 0,
      relationshipsDeleted: 0,
      propertiesSet: 0,
      labelsAdded: 0,
      labelsRemoved: 0,
      indexesAdded: 0,
      indexesRemoved: 0,
      constraintsAdded: 0,
      constraintsRemoved: 0,
    }
    this._systemUpdates = 0
    Object.keys(statistics).forEach(index => {
      // To camelCase
      const camelCaseIndex = index.replace(/(-\w)/g, m => m[1].toUpperCase())
      if (camelCaseIndex in this._stats) {
        this._stats[camelCaseIndex] = intValue(statistics[index])
      } else if (camelCaseIndex === 'systemUpdates') {
        this._systemUpdates = intValue(statistics[index])
      } else if (camelCaseIndex === 'containsSystemUpdates') {
        this._containsSystemUpdates = statistics[index]
      } else if (camelCaseIndex === 'containsUpdates') {
        this._containsUpdates = statistics[index]
      }
    })

    this._stats = Object.freeze(this._stats)
  }

  /**
   * Did the database get updated?
   * @return {boolean}
   */
  containsUpdates(): boolean {
    return this._containsUpdates !== undefined ?
      this._containsUpdates : (
        Object.keys(this._stats).reduce((last, current) => {
          return last + this._stats[current]
        }, 0) > 0
      )
  }

  /**
   * Returns the query statistics updates in a dictionary.
   * @returns {Stats}
   */
  updates(): Stats {
    return this._stats
  }

  /**
   * Return true if the system database get updated, otherwise false
   * @returns {boolean} - If the system database get updated or not.
   */
  containsSystemUpdates(): boolean {
    return this._containsSystemUpdates !== undefined ?
      this._containsSystemUpdates : this._systemUpdates > 0
  }

  /**
   * @returns {number} - Number of system updates
   */
  systemUpdates(): number {
    return this._systemUpdates
  }
}

interface NotificationPosition {
  offset: number
  line: number
  column: number
}

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

  /**
   * Create a Notification instance
   * @constructor
   * @param {Object} notification - Object with notification data
   */
  constructor(notification: any) {
    this.code = notification.code
    this.title = notification.title
    this.description = notification.description
    this.severity = notification.severity
    this.position = Notification._constructPosition(notification.position)
  }

  static _constructPosition(pos: NotificationPosition) {
    if (!pos) {
      return {}
    }
    return {
      offset: intValue(pos.offset),
      line: intValue(pos.line),
      column: intValue(pos.column)
    }
  }
}

/**
 * Class for exposing server info from a result.
 * @access public
 */
class ServerInfo {
  address?: string
  version?: string
  protocolVersion?: number
  agent?: string

  /**
   * Create a ServerInfo instance
   * @constructor
   * @param {Object} serverMeta - Object with serverMeta data
   * @param {Object} connectionInfo - Bolt connection info
   * @param {number} protocolVersion - Bolt Protocol Version
   */
  constructor(serverMeta?: any, protocolVersion?: number) {
    if (serverMeta) {
      /**
       * The server adress
       * @type {string}
       * @public
       */
      this.address = serverMeta.address
      /**
       * The server version string.
       * 
       * See {@link ServerInfo#protocolVersion} and {@link ServerInfo#agent}
       * @type {string}
       * @deprecated in 4.3, please use ServerInfo#agent, ServerInfo#protocolVersion, or call the <i>dbms.components</i> procedure instead.
       * <b>Method might be removed in the next major release.</b>
       
       * @public
       */
      this.version = serverMeta.version

      /**
       * The server user agent string
       * @type {string}
       * @public
       */
      this.agent = serverMeta.version
    }

    /**
     * The protocol version used by the connection
     * @type {number}
     * @public
     */
    this.protocolVersion = protocolVersion
  }
}

function intValue(value: NumberOrInteger): number {
  if (value instanceof Integer) {
    return value.toInt()
  } else if (typeof value == 'bigint') {
    return int(value).toInt()
  } else {
    return value
  }
}

function valueOrDefault(
  key: string,
  values: { [key: string]: NumberOrInteger },
  defaultValue: number = 0
): number {
  if (key in values) {
    const value = values[key]
    return intValue(value)
  } else {
    return defaultValue
  }
}

/**
 * The constants for query types
 * @type {{SCHEMA_WRITE: string, WRITE_ONLY: string, READ_ONLY: string, READ_WRITE: string}}
 */
const queryType = {
  READ_ONLY: 'r',
  READ_WRITE: 'rw',
  WRITE_ONLY: 'w',
  SCHEMA_WRITE: 's'
}

export {
  queryType,
  ServerInfo,
  Notification,
  Plan,
  ProfiledPlan,
  QueryStatistics,
  Stats
}
export type {
  NotificationPosition,
}

export default ResultSummary

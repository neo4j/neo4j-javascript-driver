/**
 * Copyright (c) 2002-2020 "Neo4j,"
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

import { isInt } from './integer'

/**
 * A ResultSummary instance contains structured metadata for a {@link Result}.
 * @access public
 */
class ResultSummary {
  /**
   * @constructor
   * @param {string} query - The query this summary is for
   * @param {Object} parameters - Parameters for the query
   * @param {Object} metadata - Query metadata
   * @param {number} protocolVersion - Bolt protocol version
   */
  constructor (query, parameters, metadata, protocolVersion) {
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
     * @type {Plan}
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

  _buildNotifications (notifications) {
    if (!notifications) {
      return []
    }
    return notifications.map(function (n) {
      return new Notification(n)
    })
  }

  /**
   * Check if the result summary has a plan
   * @return {boolean}
   */
  hasPlan () {
    return this.plan instanceof Plan
  }

  /**
   * Check if the result summary has a profile
   * @return {boolean}
   */
  hasProfile () {
    return this.profile instanceof ProfiledPlan
  }
}

/**
 * Class for execution plan received by prepending Cypher with EXPLAIN.
 * @access public
 */
class Plan {
  /**
   * Create a Plan instance
   * @constructor
   * @param {Object} plan - Object with plan data
   */
  constructor (plan) {
    this.operatorType = plan.operatorType
    this.identifiers = plan.identifiers
    this.arguments = plan.args
    this.children = plan.children
      ? plan.children.map(child => new Plan(child))
      : []
  }
}

/**
 * Class for execution plan received by prepending Cypher with PROFILE.
 * @access public
 */
class ProfiledPlan {
  /**
   * Create a ProfiledPlan instance
   * @constructor
   * @param {Object} profile - Object with profile data
   */
  constructor (profile) {
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
      ? profile.children.map(child => new ProfiledPlan(child))
      : []
  }

  hasPageCacheStats () {
    return (
      this.pageCacheMisses > 0 ||
      this.pageCacheHits > 0 ||
      this.pageCacheHitRatio > 0
    )
  }
}

/**
 * Get statistical information for a {@link Result}.
 * @access public
 */
class QueryStatistics {
  /**
   * Structurize the statistics
   * @constructor
   * @param {Object} statistics - Result statistics
   */
  constructor (statistics) {
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
      constraintsRemoved: 0
    }
    this._systemUpdates = 0
    Object.keys(statistics).forEach(index => {
      // To camelCase
      const camelCaseIndex = index.replace(/(-\w)/g, m => m[1].toUpperCase())
      if (camelCaseIndex in this._stats) {
        this._stats[camelCaseIndex] = intValue(statistics[index])
      } else if (camelCaseIndex === 'systemUpdates') {
        this._systemUpdates = intValue(statistics[index])
      }
    })

    this._stats = Object.freeze(this._stats)
  }

  /**
   * Did the database get updated?
   * @return {boolean}
   */
  containsUpdates () {
    return (
      Object.keys(this._stats).reduce((last, current) => {
        return last + this._stats[current]
      }, 0) > 0
    )
  }

  /**
   * Returns the query statistics updates in a dictionary.
   * @returns {*}
   */
  updates () {
    return this._stats
  }

  /**
   * Return true if the system database get updated, otherwise false
   * @returns {boolean} - If the system database get updated or not.
   */
  containsSystemUpdates () {
    return this._systemUpdates > 0
  }

  /**
   * @returns {number} - Number of system updates
   */
  systemUpdates () {
    return this._systemUpdates
  }
}

/**
 * Class for Cypher notifications
 * @access public
 */
class Notification {
  /**
   * Create a Notification instance
   * @constructor
   * @param {Object} notification - Object with notification data
   */
  constructor (notification) {
    this.code = notification.code
    this.title = notification.title
    this.description = notification.description
    this.severity = notification.severity
    this.position = Notification._constructPosition(notification.position)
  }

  static _constructPosition (pos) {
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
  /**
   * Create a ServerInfo instance
   * @constructor
   * @param {Object} serverMeta - Object with serverMeta data
   * @param {number} protocolVersion - Bolt protocol version
   */
  constructor (serverMeta, protocolVersion) {
    if (serverMeta) {
      this.address = serverMeta.address
      this.version = serverMeta.version
    }
    this.protocolVersion = protocolVersion
  }
}

function intValue (value) {
  return isInt(value) ? value.toInt() : value
}

function valueOrDefault (key, values, defaultValue = 0) {
  if (key in values) {
    const value = values[key]
    return isInt(value) ? value.toInt() : value
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

export { queryType }

export default ResultSummary

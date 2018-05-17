/**
 * Copyright (c) 2002-2018 "Neo4j,"
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

import {isInt} from './integer';

/**
  * A ResultSummary instance contains structured metadata for a {Result}.
  * @access public
  */
class ResultSummary {
  /**
   * @constructor
   * @param {string} statement - The statement this summary is for
   * @param {Object} parameters - Parameters for the statement
   * @param {Object} metadata - Statement metadata
   */
  constructor(statement, parameters, metadata) {
    /**
     * The statement and parameters this summary is for.
     * @type {{text: string, parameters: Object}}
     * @public
     */
    this.statement = {text: statement, parameters};

    /**
     * The type of statement executed. Can be "r" for read-only statement, "rw" for read-write statement,
     * "w" for write-only statement and "s" for schema-write statement.
     * String constants are available in {@link statementType} object.
     * @type {string}
     * @public
     */
    this.statementType = metadata.type;

    /**
     * Counters for operations the statement triggered.
     * @type {StatementStatistics}
     * @public
     */
    this.counters = new StatementStatistics(metadata.stats || {});
    //for backwards compatibility, remove in future version
    this.updateStatistics = this.counters;

    /**
     * This describes how the database will execute the statement.
     * Statement plan for the executed statement if available, otherwise undefined.
     * Will only be populated for queries that start with "EXPLAIN".
     * @type {Plan}
     */
    this.plan = metadata.plan || metadata.profile ? new Plan(metadata.plan || metadata.profile) : false;

    /**
     * This describes how the database did execute your statement. This will contain detailed information about what
     * each step of the plan did. Profiled statement plan for the executed statement if available, otherwise undefined.
     * Will only be populated for queries that start with "PROFILE".
     * @type {ProfiledPlan}
     * @public
     */
    this.profile = metadata.profile ? new ProfiledPlan(metadata.profile) : false;

    /**
     * An array of notifications that might arise when executing the statement. Notifications can be warnings about
     * problematic statements or other valuable information that can be presented in a client. Unlike failures
     * or errors, notifications do not affect the execution of a statement.
     * @type {Array<Notification>}
     * @public
     */
    this.notifications = this._buildNotifications(metadata.notifications);

    /**
     * The basic information of the server where the result is obtained from.
     * @type {ServerInfo}
     * @public
     */
    this.server = new ServerInfo(metadata.server);

    /**
     * The time it took the server to consume the result.
     * @type {number}
     * @public
     */
    this.resultConsumedAfter = metadata.result_consumed_after;

    /**
     * The time it took the server to make the result available for consumption in milliseconds.
     * @type {number}
     * @public
     */
    this.resultAvailableAfter = metadata.result_available_after;
  }

  _buildNotifications(notifications) {
    if(!notifications) {
      return [];
    }
    return notifications.map(function(n) { return new Notification(n) });
  }

  /**
   * Check if the result summary has a plan
   * @return {boolean}
   */
  hasPlan() {
    return this.plan instanceof Plan
  }

  /**
   * Check if the result summary has a profile
   * @return {boolean}
   */
  hasProfile() {
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
  constructor(plan) {
    this.operatorType = plan.operatorType;
    this.identifiers = plan.identifiers;
    this.arguments = plan.args;
    this.children = plan.children ? plan.children.map((child) => new Plan(child)) : [];
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
  constructor(profile) {
    this.operatorType = profile.operatorType;
    this.identifiers = profile.identifiers;
    this.arguments = profile.args;
    this.dbHits = profile.args.DbHits.toInt();
    this.rows = profile.args.Rows.toInt();
    this.children = profile.children ? profile.children.map((child) => new ProfiledPlan(child)) : [];
  }
}

/**
  * Get statistical information for a {@link Result}.
  * @access public
  */
class StatementStatistics {
  /**
   * Structurize the statistics
   * @constructor
   * @param {Object} statistics - Result statistics
   */
  constructor(statistics) {
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
    };
    Object.keys(statistics).forEach((index) => {
      //To camelCase
      this._stats[index.replace(/(\-\w)/g, (m) => m[1].toUpperCase())] =
        isInt(statistics[index]) ? statistics[index].toInt() : statistics[index];
    });
  }

  /**
   * Did the database get updated?
   * @return {boolean}
   */
  containsUpdates() {
    return Object.keys(this._stats).reduce((last, current) => {
      return last + this._stats[current];
    }, 0) > 0;
  }

  /**
   * @return {Number} - Number of nodes created.
   */
  nodesCreated() {
    return this._stats.nodesCreated;
  }

  /**
   * @return {Number} - Number of nodes deleted.
   */
  nodesDeleted() {
    return this._stats.nodesDeleted;
  }

  /**
   * @return {Number} - Number of relationships created.
   */
  relationshipsCreated() {
    return this._stats.relationshipsCreated;
  }

  /**
   * @return {Number} - Number of nodes deleted.
   */
  relationshipsDeleted() {
    return this._stats.relationshipsDeleted;
  }

  /**
   * @return {Number} - Number of properties set.
   */
  propertiesSet() {
    return this._stats.propertiesSet;
  }

  /**
   * @return {Number} - Number of labels added.
   */
  labelsAdded() {
    return this._stats.labelsAdded;
  }

  /**
   * @return {Number} - Number of labels removed.
   */
  labelsRemoved() {
    return this._stats.labelsRemoved;
  }

  /**
   * @return {Number} - Number of indexes added.
   */
  indexesAdded() {
    return this._stats.indexesAdded;
  }

  /**
   * @return {Number} - Number of indexes removed.
   */
  indexesRemoved() {
    return this._stats.indexesRemoved;
  }

  /**
   * @return {Number} - Number of constraints added.
   */
  constraintsAdded() {
    return this._stats.constraintsAdded;
  }

  /**
   * @return {Number} - Number of constraints removed.
   */
  constraintsRemoved() {
    return this._stats.constraintsRemoved;
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
  constructor(notification) {
    this.code = notification.code;
    this.title = notification.title;
    this.description = notification.description;
    this.severity = notification.severity;
    this.position = Notification._constructPosition(notification.position);
  }

  static _constructPosition(pos) {
    if(!pos) {
      return {};
    }
    return {
      offset: pos.offset.toInt(),
      line: pos.line.toInt(),
      column: pos.column.toInt()
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
   */
  constructor(serverMeta) {
    if (serverMeta) {
      this.address = serverMeta.address;
      this.version = serverMeta.version;
    }
  }
}

const statementType = {
  READ_ONLY: 'r',
  READ_WRITE: 'rw',
  WRITE_ONLY: 'w',
  SCHEMA_WRITE: 's'
};

export {
  statementType
}

export default ResultSummary

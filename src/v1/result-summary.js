/**
 * Copyright (c) 2002-2016 "Neo Technology,"
 * Network Engine for Objects in Lund AB [http://neotechnology.com]
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

import {int, isInt} from './integer';

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
    this.statement = {text: statement, parameters};
    this.statementType = metadata.type;
    this.updateStatistics = new StatementStatistics(metadata.stats || {});
    this.plan = metadata.plan || metadata.profile ? new Plan(metadata.plan || metadata.profile) : false;
    this.profile = metadata.profile ? new ProfiledPlan(metadata.profile) : false;
    this.notifications = this._buildNotifications(metadata.notifications);
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
   * @param {Object} plan - Object with plan data
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
  * Get statistical information for a {Result}.
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
      nodesDelete: 0,
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
    Object.keys(statistics).forEach((index) => {
      let val = isInt(statistics[index]) ? statistics[index].toInt() : statistics[index];
      //To camelCase
      this._stats[index.replace(/(\-\w)/g, (m) => m[1].toUpperCase())] = val;
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
   * @return {Number} - Number of contraints added.
   */
  constraintsAdded() {
    return this._stats.constraintsAdded;
  }

  /**
   * @return {Number} - Number of contraints removed.
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
    this.description = notification.desciption;
    this.position = this._constructPosition(notification.position);
  }

  _constructPosition(pos) {
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

const statementType = {
  READ_ONLY: 'r',
  READ_WRITE: 'rw',
  WRITE_ONLY: 'w',
  SCHEMA_WRITE: 's'
}

export default {
  ResultSummary,
  statementType
}

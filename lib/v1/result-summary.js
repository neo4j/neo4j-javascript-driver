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

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _integer = require('./integer');

/**
  * A ResultSummary instance contains structured metadata for a {Result}.
  * @access public
  */

var ResultSummary = (function () {
  /**
   * @constructor
   * @param {string} statement - The statement this summary is for
   * @param {Object} parameters - Parameters for the statement
   * @param {Object} metadata - Statement metadata
   */

  function ResultSummary(statement, parameters, metadata) {
    _classCallCheck(this, ResultSummary);

    this.statement = { text: statement, parameters: parameters };
    this.statementType = metadata.type;
    this.updateStatistics = new StatementStatistics(metadata.stats || {});
    this.plan = metadata.plan || metadata.profile ? new Plan(metadata.plan || metadata.profile) : false;
    this.profile = metadata.profile ? new ProfiledPlan(metadata.profile) : false;
    this.notifications = this._buildNotifications(metadata.notifications);
  }

  /**
    * Class for execution plan received by prepending Cypher with EXPLAIN.
    * @access public
    */

  _createClass(ResultSummary, [{
    key: '_buildNotifications',
    value: function _buildNotifications(notifications) {
      if (!notifications) {
        return [];
      }
      return notifications.map(function (n) {
        return new Notification(n);
      });
    }

    /**
     * Check if the result summary has a plan
     * @return {boolean}
     */
  }, {
    key: 'hasPlan',
    value: function hasPlan() {
      return this.plan instanceof Plan;
    }

    /**
     * Check if the result summary has a profile
     * @return {boolean}
     */
  }, {
    key: 'hasProfile',
    value: function hasProfile() {
      return this.profile instanceof ProfiledPlan;
    }
  }]);

  return ResultSummary;
})();

var Plan =
/**
 * Create a Plan instance
 * @constructor
 * @param {Object} plan - Object with plan data
 */
function Plan(plan) {
  _classCallCheck(this, Plan);

  this.operatorType = plan.operatorType;
  this.identifiers = plan.identifiers;
  this.arguments = plan.args;
  this.children = plan.children ? plan.children.map(function (child) {
    return new Plan(child);
  }) : [];
}

/**
  * Class for execution plan received by prepending Cypher with PROFILE.
  * @access public
  */
;

var ProfiledPlan =
/**
 * Create a ProfiledPlan instance
 * @constructor
 * @param {Object} profile - Object with profile data
 */
function ProfiledPlan(profile) {
  _classCallCheck(this, ProfiledPlan);

  this.operatorType = profile.operatorType;
  this.identifiers = profile.identifiers;
  this.arguments = profile.args;
  this.dbHits = profile.args.DbHits.toInt();
  this.rows = profile.args.Rows.toInt();
  this.children = profile.children ? profile.children.map(function (child) {
    return new ProfiledPlan(child);
  }) : [];
}

/**
  * Get statistical information for a {Result}.
  * @access public
  */
;

var StatementStatistics = (function () {
  /**
   * Structurize the statistics
   * @constructor
   * @param {Object} statistics - Result statistics
   */

  function StatementStatistics(statistics) {
    var _this = this;

    _classCallCheck(this, StatementStatistics);

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
    Object.keys(statistics).forEach(function (index) {
      //To camelCase
      _this._stats[index.replace(/(\-\w)/g, function (m) {
        return m[1].toUpperCase();
      })] = (0, _integer.isInt)(statistics[index]) ? statistics[index].toInt() : statistics[index];
    });
  }

  /**
    * Class for Cypher notifications
    * @access public
    */

  /**
   * Did the database get updated?
   * @return {boolean}
   */

  _createClass(StatementStatistics, [{
    key: 'containsUpdates',
    value: function containsUpdates() {
      var _this2 = this;

      return Object.keys(this._stats).reduce(function (last, current) {
        return last + _this2._stats[current];
      }, 0) > 0;
    }

    /**
     * @return {Number} - Number of nodes created.
     */
  }, {
    key: 'nodesCreated',
    value: function nodesCreated() {
      return this._stats.nodesCreated;
    }

    /**
     * @return {Number} - Number of nodes deleted.
     */
  }, {
    key: 'nodesDeleted',
    value: function nodesDeleted() {
      return this._stats.nodesDeleted;
    }

    /**
     * @return {Number} - Number of relationships created.
     */
  }, {
    key: 'relationshipsCreated',
    value: function relationshipsCreated() {
      return this._stats.relationshipsCreated;
    }

    /**
     * @return {Number} - Number of nodes deleted.
     */
  }, {
    key: 'relationshipsDeleted',
    value: function relationshipsDeleted() {
      return this._stats.relationshipsDeleted;
    }

    /**
     * @return {Number} - Number of properties set.
     */
  }, {
    key: 'propertiesSet',
    value: function propertiesSet() {
      return this._stats.propertiesSet;
    }

    /**
     * @return {Number} - Number of labels added.
     */
  }, {
    key: 'labelsAdded',
    value: function labelsAdded() {
      return this._stats.labelsAdded;
    }

    /**
     * @return {Number} - Number of labels removed.
     */
  }, {
    key: 'labelsRemoved',
    value: function labelsRemoved() {
      return this._stats.labelsRemoved;
    }

    /**
     * @return {Number} - Number of indexes added.
     */
  }, {
    key: 'indexesAdded',
    value: function indexesAdded() {
      return this._stats.indexesAdded;
    }

    /**
     * @return {Number} - Number of indexes removed.
     */
  }, {
    key: 'indexesRemoved',
    value: function indexesRemoved() {
      return this._stats.indexesRemoved;
    }

    /**
     * @return {Number} - Number of contraints added.
     */
  }, {
    key: 'constraintsAdded',
    value: function constraintsAdded() {
      return this._stats.constraintsAdded;
    }

    /**
     * @return {Number} - Number of contraints removed.
     */
  }, {
    key: 'constraintsRemoved',
    value: function constraintsRemoved() {
      return this._stats.constraintsRemoved;
    }
  }]);

  return StatementStatistics;
})();

var Notification = (function () {
  /**
   * Create a Notification instance
   * @constructor
   * @param {Object} notification - Object with notification data
   */

  function Notification(notification) {
    _classCallCheck(this, Notification);

    this.code = notification.code;
    this.title = notification.title;
    this.description = notification.description;
    this.severity = notification.severity;
    this.position = Notification._constructPosition(notification.position);
  }

  _createClass(Notification, null, [{
    key: '_constructPosition',
    value: function _constructPosition(pos) {
      if (!pos) {
        return {};
      }
      return {
        offset: pos.offset.toInt(),
        line: pos.line.toInt(),
        column: pos.column.toInt()
      };
    }
  }]);

  return Notification;
})();

var statementType = {
  READ_ONLY: 'r',
  READ_WRITE: 'rw',
  WRITE_ONLY: 'w',
  SCHEMA_WRITE: 's'
};

exports['default'] = {
  ResultSummary: ResultSummary,
  statementType: statementType
};
module.exports = exports['default'];
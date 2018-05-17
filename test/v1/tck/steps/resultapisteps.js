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

var neo4j = require("../../../../lib/v1");
var resultSummary = require("../../../../lib/v1/result-summary");
var util = require("./util")

module.exports = function () {

  this.When(/^the `Statement Result` is consumed a `Result Summary` is returned$/, function (callback) {
    var self = this;
    this.rc.then(function(res) {
      self.summary = res.summary;
      callback();
    }).catch(function(err) {callback(new Error("Rejected Promise: " + err))});
  });

  this.Then(/^the `Statement Result` is closed$/, function () {
    //No result cursor in JavaScript Driver
  });

  this.When(/^I request a `Statement` from the `Result Summary`$/, function () {
    this.statement = this.summary.statement
  });

  this.Then(/^requesting the `Statement` as text should give: (.*)$/, function (statementText) {
    if (this.statement.text != statementText) {
      throw Error("'" + this.statement.text + "' does not match expected text: '" + statementText + "'")
    }
  });

  this.Then(/^requesting the `Statement` parameter should give: (.*)$/, function (statementParam) {
    var param = util.literalValueToTestValue(statementParam);
    if (typeof this.statement.parameters === 'undefined') {
      this.statement.parameters = {}
    }
    if (!util.compareValues(this.statement.parameters, param)) {
        throw Error("Params does not match! Got: " + this.statement.parameters + " Expected: " + param);
    }
  });

  this.Then(/^requesting `Counters` from `Result Summary` should give$/, function (table) {
    var counters = this.summary.counters;
    for ( var i = 0 ; i < table.hashes().length; i++) {
      var statistic = table.hashes()[i].counter;
      var expected = util.literalValueToTestValueNormalIntegers(table.hashes()[i].result);
      var given = getStatistic(statistic, counters)
      if (!util.compareValues(given, expected)) {
        throw Error("Statistics for: " + statistic + " does not match. Expected: '" + expected + "' Given: '" + given + "'");
      }
    }
  });

  this.Then(/^requesting the `Statement Type` should give (.*)$/, function (type) {
    var type = getStatementTypeFromString(type);
    if (this.summary.statementType != type)
    {
      throw Error("statementType does not match. Expected: '" + type + "' Given: '" + this.summary.statementType + "'");
    }
  });

  this.Then(/^the `Result Summary` has a `Plan`$/, function () {
    if(! this.summary.hasPlan()) {
      throw Error("Expected summary to have a `plan`. It did not...");
    }
  });

  this.Then(/^the `Result Summary` does not have a `Plan`$/, function () {
    if(this.summary.hasPlan()) {
      throw Error("Expected summary to NOT have a `plan`. It did not...");
    }
  });

  this.Then(/^the `Result Summary` has a `Profile`$/, function () {
    if(! this.summary.hasProfile()) {
      throw Error("Expected summary to have a `profile plan`. It did not...");
    }
  });

  this.Then(/^the `Result Summary` does not have a `Profile`$/, function () {
    if( this.summary.hasProfile()) {
      throw Error("Expected summary to NOT have a `profile plan`. It did...");
    }
  });

  this.Then(/^requesting the `Plan` it contains$/, function (table) {
    checkPlanExact(table, this.summary.plan)
  });

  this.Then(/^the `Plan` also contains method calls for:$/, function (table) {
    checkPlan(table, this.summary.plan)
  });

  this.Then(/^requesting the `Profile` it contains:$/, function (table) {
    checkPlanExact(table, this.summary.profile)
});

this.Then(/^the `Profile` also contains method calls for:$/, function (table) {
  checkPlan(table, this.summary.profile)
});

this.Then(/^the `Result Summary` `Notifications` is empty$/, function () {
  if (! this.summary.notifications.length == 0) {
    throw Error("Expected no notifications. Got: " + this.summary.notifications.length)
  }
});

this.Then(/^the `Result Summary` `Notifications` has one notification with$/, function (table) {

  var expected = {};
  if (this.summary.notifications.length > 1) {
    throw Error("Expected only one notification. Got: " + this.summary.notifications.length)
  }
  var givenNotification = this.summary.notifications[0];
  var given = {}
  for ( var i = 0 ; i < table.hashes().length; i++) {
    var key = table.hashes()[i]['key']
    expected[key] = util.literalValueToTestValueNormalIntegers(table.hashes()[i]['value']);
    given[key] = givenNotification[key]
  }
  if (Object.keys(givenNotification).length !== Object.keys(given).length) {
    throw Error("Keys do not match with expected. Got: " + Object.keys(givenNotification) + " Expected: " + Object.keys(given))
  }

  // Do not compare notification positions. They differ by Neo4j database version
  delete expected['position'];
  delete given['position'];

  if (!util.compareValues(expected, given)) {
    throw Error("Summary notifications does not match. Expected: '" + util.printable(expected) + "' Given: '" + util.printable(givenNotification) + "'");
  }
});

  function checkPlanExact(table, plan)
  {
    for ( var i = 0 ; i < table.hashes().length; i++) {
      var dataKey = getPlanParam(table.hashes()[i]["plan method"])
      var given = plan[dataKey];
      if (given === undefined || given === null || given === NaN) {
        throw Error("Plans `" + dataKey + "` has no content! Got: " + given);
      }
    }
  }

  function checkPlan(table, plan)
  {
    for ( var i = 0 ; i < table.hashes().length; i++) {
      var dataKey = getPlanParam(table.hashes()[i]["plan method"])
      var given = plan[dataKey];
      if (given === undefined || given === null || given === NaN) {
        throw Error("Plans `" + dataKey + "` has no content! Got: " + given);
      }
    }
  }

  function getPlanParam(key) {
    if (key == 'operator type') {
      return 'operatorType'
    }
    if (key == 'db hits') {
      return 'dbHits'
    }
    if (key == 'records') {
      return 'rows'
    }
    else {
      return key
    }
  }

  function getStatementTypeFromString(type) {
    if (type == 'read write') {
      return resultSummary.statementType.READ_WRITE;
    }
    if (type == 'read only') {
      return resultSummary.statementType.READ_ONLY;
    }
    if (type == 'write only') {
      return resultSummary.statementType.WRITE_ONLY;
    }
    if (type == 'schema write') {
      return resultSummary.statementType.SCHEMA_WRITE;
    }
    throw Error("No statement type mapping of: " + type)
  }

  function getStatistic(statementString, counters) {
    if (statementString == 'nodes created') {
      return counters.nodesCreated();
    }
    if (statementString == 'nodes deleted') {
      return counters.nodesDeleted();
    }
    if (statementString == 'relationships created') {
      return counters.relationshipsCreated();
    }
    if (statementString == 'relationships deleted') {
      return counters.relationshipsDeleted();
    }
    if (statementString == 'properties set') {
      return counters.propertiesSet();
    }
    if (statementString == 'labels added') {
      return counters.labelsAdded();
    }
    if (statementString == 'labels removed') {
      return counters.labelsRemoved();
    }
    if (statementString == 'indexes added') {
      return counters.indexesAdded();
    }
    if (statementString == 'indexes removed') {
      return counters.indexesRemoved();
    }
    if (statementString == 'constraints added') {
      return counters.constraintsAdded();
    }
    if (statementString == 'constraints removed') {
      return counters.constraintsRemoved();
    }
    if (statementString == 'contains updates') {
      return counters.containsUpdates();
    }
    throw Error("No statistics mapping of: " + statementString)
  }

};

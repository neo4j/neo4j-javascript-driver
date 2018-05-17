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
var util = require("./util");
var sharedNeo4j = require("../../../internal/shared-neo4j").default;

module.exports = function () {

  this.Given(/^I have a driver$/, function () {
  });

  this.When(/^I start a `Transaction` through a session$/, function () {
    this.transaction = this.session.beginTransaction()
  });

  this.When(/^`run` a query with that same session without closing the transaction first$/, function (callback) {
    var self = this;
    this.session.run("CREATE (:n)").then(function(result) {callback()}).catch(function(err) {self.error = err; callback()})
  });

  this.Then(/^it throws a `ClientException`$/, function (table) {
    var expected = table.rows()[0][0];
    if (!this.error) {
      throw new Error("Expected an error but got none.")
    }
    if (this.error.message.indexOf(expected) != 0) {
      if (!(expected == "Unsupported URI scheme:" || expected == "Unable to connect to" ))
      {
        throw new Error("Error messages do not match. Given: '" + this.error.message + "'. Expected: '" + expected + "'");
      }
    }
  });

  this.When(/^I start a new `Transaction` with the same session before closing the previous$/, function () {
    try {
      this.session.beginTransaction();
    } catch (e) {
      this.error = e;
    }

  });

  this.When(/^I run a non valid cypher statement$/, function (callback) {
    var self = this;
    this.session.run("CRETE (:n)").then(function(result) {callback()}).catch(function(err) {self.error = err; callback()})
  });

  this.When(/^I set up a driver to an incorrect port$/, function (callback) {
    var self = this;
    var driver = neo4j.driver("bolt://localhost:7777", neo4j.auth.basic(sharedNeo4j.username, sharedNeo4j.password));
    driver.onSuccess = function () {
      driver.close();
    };
    driver.onError = function (error) {
      driver.close();
      self.error = error;
      callback();
    };
    driver.session().beginTransaction();
    setTimeout(callback, 1000);
  });

  this.When(/^I set up a driver with wrong scheme$/, function (callback) {
    try {
      neo4j.driver("wrong://localhost:7474", neo4j.auth.basic(sharedNeo4j.username, sharedNeo4j.password));
    } catch (e){
      this.error = e;
      callback();
    }
  });

};

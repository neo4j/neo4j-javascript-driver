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
var fs = require("fs");
var sharedNeo4j = require("../../../internal/shared-neo4j").default;

module.exports = function () {

  var driver = undefined;

  var failedScenarios = [];

  this.registerHandler("BeforeFeatures", function(event, next) {
    driver = neo4j.driver("bolt://localhost", neo4j.auth.basic(sharedNeo4j.username, sharedNeo4j.password));

    return next()
  });

  this.Before("@reset_database", function( scenario, callback ) {
    this.driver = driver;
    this.session = this.driver.session();
    this.session.run("MATCH (n) DETACH DELETE n").then( function( ) {
      callback();
    });
  });

  this.Before("@tls", function( scenario ) {

    this.knownHosts1 = "known_hosts1";
    this.knownHosts2 = "known_hosts2";
    _deleteFile(this.knownHosts1);
    _deleteFile(this.knownHosts2);
  });

  this.Before("~@reset_database", "~@tls", function( scenario, callback ) {
    this.driver = driver;
    this.session = this.driver.session();
    callback();
  });

  this.Before("@equality_test", function( scenario ) {
    this.savedValues = {};
  });

  this.After("~@error_reporting",function (scenario, callback) {
    if (this.session) {
      this.session.close();
    }
    if (!scenario.isSuccessful()) {
      failedScenarios.push(scenario)
    }

    _deleteFile(this.knownHosts1);
    _deleteFile(this.knownHosts2);
    callback();
  });

  this.registerHandler('AfterFeatures', function (event, callback) {
    if (driver) {
      driver.close();
    }
    if (failedScenarios.length) {
      for ( var i = 0; i < failedScenarios.length; i++) {
        console.log("FAILED! Scenario: " + failedScenarios[i].getName());
        console.log("With Exception: " + failedScenarios[i].getException() + "\n");
      }
      return process.exit(2);
    }
    callback();
  });

  function _deleteFile(fname) {
    if (!fname) return;

    try {
      fs.lstatSync(fname);
      fs.unlinkSync(fname);
    }
    catch (e) {
      // ignore
    }
  }
};

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

  this.Given(/^a driver is configured with auth enabled and correct password is provided$/, function () {
    if (this.driver) {
      this.driver.close();
    }
    this.driver = neo4j.driver("bolt://localhost", neo4j.auth.basic(sharedNeo4j.username, sharedNeo4j.password));
  });

  this.Then(/^reading and writing to the database should be possible$/, function (callback) {
    var driver = this.driver;
    var session = driver.session();
    session.run('CREATE (:label1)').then(function () {
      closeDriver(driver);
      callback();
    }).catch(function (err) {
      closeDriver(driver);
      callback(new Error('Rejected Promise: ' + err));
    });
  });

  this.Given(/^a driver is configured with auth enabled and the wrong password is provided$/, function () {
    closeDriver(this.driver);
    this.driver = neo4j.driver("bolt://localhost", neo4j.auth.basic(sharedNeo4j.username, "wrong"));
    this.driver.session();
  });

  this.Then(/^reading and writing to the database should not be possible$/, {timeout:5000}, function (callback) {

    var self = this;
    this.driver.onError = function (err) {
      closeDriver(self.driver);
      self.err = err;
      callback();
    };

    var session = this.driver.session();
    session.run("CREATE (:label1)").then( function(  ) {
      closeDriver(self.driver);
      callback(new Error("Should not be able to run session!"));
    }).catch( function(err) {
      closeDriver(self.driver);
      callback();
    });
  });

  this.Then(/^a `Protocol Error` is raised$/, function () {
    var message = this.err.message;
    var code = this.err.code;

    var expectedStartOfMessage = 'The client is unauthorized due to authentication failure.';
    var expectedCode = 'Neo.ClientError.Security.Unauthorized';

    if (message.indexOf(expectedStartOfMessage) != 0) {
      throw new Error("Wrong error message. Expected: '" + expectedStartOfMessage + "'. Got: '" + message + "'");
    }

    if (code.indexOf(expectedCode) != 0) {
      throw new Error("Wrong error code. Expected: '" + expectedCode + "'. Got: '" + code + "'");
    }
  });

  function closeDriver(driver) {
    if (driver) {
      driver.close();
    }
  }
};

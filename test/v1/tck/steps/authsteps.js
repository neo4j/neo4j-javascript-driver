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

var neo4j = require("../../../../lib/v1");
var util = require("./util")

module.exports = function () {

  var username = "user"
  var password = "password"

  this.Given(/^a driver is configured with auth enabled and correct password is provided$/, function () {
    this.driver.close();
    this.driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "neo4j"));
  });

  this.Then(/^reading and writing to the database should be possible$/, function (callback) {
    var session = this.driver.session()
    session.run("CREATE (:label1)").then( function(  ) {
        callback();
    }).catch(function(err) {callback(new Error("Rejected Promise: " + err))});
  });

  this.Given(/^a driver is configured with auth enabled and the wrong password is provided$/, function () {
    this.driver.close();
    this.driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "wrong"));
  });

  this.Then(/^reading and writing to the database should not be possible$/, function (callback) {
    var session = this.driver.session()
    var self = this;
    session.run("CREATE (:label1)").then( function(  ) {
      callback(new Error("Should not be able to run session!"));
    }).catch( function(err) {
      self.err = err;
      callback();
    });
  });

  this.Then(/^a `Protocol Error` is raised$/, function () {
    var message = this.err.fields[0].message
    var code = this.err.fields[0].code

    // TODO uncomment this once we fix the init sync
    //var expectedStartOfMessage = 'No operations allowed until you send an INIT message successfully.'
    var expectedCode = 'Neo.ClientError';

    // TODO uncomment this once we fix the init sync
    //if (message.indexOf(expectedStartOfMessage) != 0) {
    //  throw new Error("Wrong error messsage. Expected: '" + expectedStartOfMessage + "'. Got: '" + message + "'");
    //}

    if (code.indexOf(expectedCode) != 0) {
      throw new Error("Wrong error code. Expected: '" + expectedCode + "'. Got: '" + code + "'");
    }
  });
}

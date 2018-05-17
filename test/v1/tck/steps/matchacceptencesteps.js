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
var util = require("./util")

module.exports = function () {

  this.Given(/^init: (.*)$/, function (statement) {
    return this.session.run(statement);
  });

  this.When(/^running: (.*)$/, function (statement) {
      this.rc = this.session.run(statement);
  });

  this.When(/^running parametrized: (.*)$/, function (statement, table) {
    var param = util.literalTableToTestObject(table.hashes())[0];
    this.rc = this.session.run(statement, param);
  });


  this.Then(/^result:$/, function (table, callback) {
    this.expectedResults = util.literalTableToTestObject(table.hashes());
    var self = this;
    var errorCallback = function(err) {callback(new Error("Rejected Promise: " + err))};
    var successCallback = function(res) {
      var givenResults = [];
      var expectedPrint = printable(self.expectedResults);
      for (var i = 0 ; i < res.records.length; i++)  {
        givenResults.push(getTestObject(res.records[i]));
      }
      if ( givenResults.length != self.expectedResults.length) {
        callback(new Error("Given and expected length of result array does not match.\n" +
            "Given length: " + givenResults.length + " Expected length" + self.expectedResults.length + "\n" +
            "Given: " + printable(givenResults) + " Expected: " + expectedPrint));
      }
      if (!compareResults(givenResults, self.expectedResults) ) {
        callback(new Error("Given and expected results does not match: " + printable(givenResults) + " Expected " + expectedPrint));
      }
      callback();
    };
    this.rc.then(successCallback).catch(errorCallback);
  });


  function compareResults(given, expected) {
    if (! (typeof given === "object" && given instanceof Array) ) {
      throw new Error("Should be type Array")
    }
    if (! (typeof expected === "object" && expected instanceof Array) ) {
      throw new Error("Should be type Array")
    }
    for (var i = 0 ; i < given.length ; i++ ) {
      var sizeExpected = expected.length;
      for ( var j = 0 ; j < expected.length ; j++ ) {
        if ( compareResultObjects(given[i], expected[j]) ) {
          expected.splice(j,1);
          break;
        }
      }
      if (sizeExpected === expected.length) {
        return false;
      }
    }
    return true;
  }

  function compareResultObjects(given, expected) {
    var keys = Object.keys(given);
    var keysExpected = Object.keys(expected);
    keys.sort();
    keysExpected.sort();
    if (!util.compareValues(keys, keysExpected)) {
      return false;
    }
    for ( var i = 0 ; i < keys.length ; i++ ) {
      if (!util.compareValues(given[keys[i]], expected[keys[i]]))
      {
        return false;
      }
    }
    return true;

  }

  function getTestObject(rels) {
    var result = {};
    rels.forEach(function( rel, key ) {
      if (typeof rel === "object" && rel instanceof Array) {
        var relArray = [];
        for (var i in rel) {
          relArray.push(getTestValue(rel[i]));
        }
        result[key] = relArray;
      }
      else {
        result[key] = getTestValue(rel);
      }
    });
    return result;
  }

  function getTestValue(val) {
    if ( val === null) {
      return val;
    }
    var con = val.constructor.name.toLowerCase();
    if (con === util.NODE) {
      return stripNode(val);
    }
    else if (con === util.RELATIONSHIP) {
      return stripRelationship(val);
    }
    else if (con === util.PATH) {
      return stripPath(val);
    }
    else {
      return val;
    }
  }

  function stripRelationship(rel) {
    rel.start = neo4j.int(0);
    rel.end = neo4j.int(0);
    rel.identity = neo4j.int(0);
    return rel;
  }

  function stripNode(node) {
    node.identity = neo4j.int(0);
    return node;
  }

  function stripPath(path) {
    var id = 0;
    var startid = neo4j.int(path.start.identity.toString());
    var segments = path.segments;
    var segment;
    for (var i = 0; i < segments.length; i++) {
      segment = segments[i];
      var relationship = segment.relationship;
      var endId = neo4j.int(segment.end.identity.toString());
      relationship.identity = neo4j.int(0);
      segment.start.identity = neo4j.int(id++);
      segment.end.identity = neo4j.int(id);

      if (relationship.start.equals(startid) && relationship.end.equals(endId)) {
        relationship.start = segment.start.identity;
        relationship.end = segment.end.identity;
      }
      else if (relationship.end.equals(startid) && relationship.start.equals(endId)) {
        relationship.end = segment.start.identity;
        relationship.start = segment.end.identity;
      }
      else {
        throw new Error("Path segment does not make sense")
      }
      startid = endId;
    }
    path.start.identity = neo4j.int(0);
    path.end.identity = neo4j.int(id);
    return path;
  }

  function printable(array) {
    return JSON.stringify(array);
  }
};

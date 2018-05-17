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

module.exports = function () {

  this.Given(/^A running database$/, function () {
    return this.session.run("RETURN 1 AS one");
  });

  this.Given(/^a String of size (\d+)$/, function (size) {
    this.expectedValue = stringOfSize(size);
  });

  this.Given(/^a List of size (\d+) and type (.*)$/, function (size, type) {
    var list = [];
    for(var i = 0; i < size; i++ ) {
      if (type.toLowerCase() === util.STRING) {
        list.push(stringOfSize(3));
      }
      else if (type.toLowerCase() === util.INT) {
        list.push(randomInt());
      }
      else if (type.toLowerCase() === util.BOOL) {
        list.push(randomBool());
      }
      else if (type.toLowerCase() === util.FLOAT) {
        list.push(randomFloat());
      }
      else if (type.toLowerCase() === util.NULL) {
        list.push(null);
      }
      else {
        throw new Error("No such type: " + type);
      }
    }
    this.expectedValue = list;
  });

  this.Given(/^a Map of size (\d+) and type (.*)$/, function (size, type) {
    var map = {};
    for(var i = 0; i < size; i++ ) {
      if (type.toLowerCase() === util.STRING) {
        map["a" + util.sizeOfObject(this.M)] = stringOfSize(3);
      }
      else if (type.toLowerCase() === util.INT) {
        map["a" + util.sizeOfObject(this.M)] = randomInt();
      }
      else if (type.toLowerCase() === util.BOOL) {
        map["a" + util.sizeOfObject(this.M)] = randomBool();
      }
      else if (type.toLowerCase() === util.FLOAT) {
        map["a" + util.sizeOfObject(this.M)] = randomFloat();
      }
      else if (type.toLowerCase() === util.NULL) {
        map["a" + util.sizeOfObject(this.M)] = null;
      }
      else {
        throw new Error("No such type: " + type);
      }
    }
    this.expectedValue = map;
  });

  this.Given(/^a value (.*)$/, function (input) {
    this.expectedValue = util.literalValueToTestValue(input);
  });

  this.Given(/^a list containing$/, function (table) {
    var rows = table.rows()
    this.expectedValue = [];
    for (var i = 0, len = rows.length; i < len; i++) {
      this.expectedValue.push(util.literalValueToTestValue(rows[i]));
    }
  });

  this.When(/^adding this list to itself$/, function () {
    var clone = [];
    for (var i = 0, len = this.expectedValue.length; i < len; i++) {
      clone.push(util.clone(this.expectedValue[i]));
    }
    this.expectedValue.push([]);
  });

  this.Given(/^a map containing$/, function (table) {
    var rows = table.rows()
    this.expectedValue = {}
    for (var i = 0, len = rows.length; i < len; i++) {
      var key = util.literalValueToTestValue(rows[i][0])
      var value = util.literalValueToTestValue(rows[i][1])
      this.expectedValue[key] = value;
    }
  });

  this.Given(/^adding this map to itself with key "(.*)"$/, function (key) {
    var clone = util.clone(this.expectedValue);
    this.expectedValue[key] = clone;
  });

  this.When(/^the driver asks the server to echo this value back$/, function () {
    echoExpectedValue.call(this);
  });

  this.When(/^the driver asks the server to echo this list back$/, function () {
    echoExpectedValue.call(this);
  });

  this.When(/^the driver asks the server to echo this map back$/, function () {
    echoExpectedValue.call(this);
  });


  this.Then(/^the value given in the result should be the same as what was sent$/, function (callback) {
    var self = this;
    var errorCallback = function(err) {callback(new Error("Rejected Promise: " + err))}
    var successCallback = function(res) {
      if(res.records.length != 1 || res.records[0].length != 1) {
        callback(new Error("Expected the statement to return a single record, single field record. Got: " + res.records.length + " records and: " + res.records[0].length + " values"));
      }

      if (!util.compareValues(res.records[0].get('x'), self.expectedValue)) {
          callback(new Error("Expected the statement to return same as what was sent. Got: " + res.records[0].get('x') + " Expected: " + self.expectedValue));
      }
      callback();
    };
    this.withParamPromise.then(successCallback).catch(errorCallback);
    this.withLiteralPromise.then(successCallback).catch(errorCallback);
  });

  function stringOfSize(size) {
    var chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return new Array(size).join().split(',').map(function() { return chars.charAt(Math.floor(Math.random() * chars.length)); }).join('');
  }

  function randomBool()
  {
    return Math.random() >= 0.5
  }

  function randomInt()
  {
    return neo4j.int(Math.floor(Math.random() * (2147483647 + 2147483648  + 1)) - 2147483648);
  }

  function randomFloat()
  {
    return Math.random()
  }

  function toParameter(type, value) {

    if (type.toLowerCase() === STRING) {
      return value.toString();
    }
    if (type.toLowerCase() === INT) {
      return neo4j.int(value);
    }
    if (type.toLowerCase() === BOOL) {
      return Boolean(value);
    }
    if (type.toLowerCase() === FLOAT) {
      return parseFloat(value);
    }
    if (type.toLowerCase() === NULL) {
      return null;
    }
    else {
      throw new Error("Cannot conversion of type:" + type + " has not been implemented" );
    }
  }

  function jsToCypherLiteral(jsVal) {
    if( typeof jsVal === "string" || jsVal instanceof String ) {
      return '"' + jsVal + '"';
    }
    else if( neo4j.isInt(jsVal) ) {
      return jsVal.toString();
    }
    else if( typeof jsVal === "boolean") {
      return jsVal.toString();
    }
    //number is float
    else if( typeof jsVal === "number") {
      var f = jsVal.toString();
      if (!(f.indexOf("e") != -1 || f.indexOf("E") != -1)) {
        if (f.indexOf(".") == -1) {
          return jsVal.toFixed(1).toString();
        }
      }
      return f.replace("+", "");
    }
    else if( jsVal === undefined || jsVal === null) {
      return 'Null';
    }
    else if( typeof jsVal === "object" && jsVal instanceof Array ) {
      var list = "[";
      for(var i = 0; i < jsVal.length; i++ ) {
        list += jsToCypherLiteral(jsVal[i]);
        if ( i < jsVal.length -1) {
          list += ",";
        }
      }
      return list += "]";
    }
    else if( typeof jsVal === "object" && jsVal instanceof Object ) {
      var map = "{"
      for(var key in jsVal) {
        var new_key = key;
        map += new_key + ":" + jsToCypherLiteral(jsVal[key]);
        map += ",";
      }
      map = map.slice(0,-1);
      return map += "}";
    }
    else {
      throw new Error("Cannot convert " + jsVal);
    }
  }

  function echoExpectedValue() {
    this.withParamPromise = this.session.run("RETURN {x} as x", {x:this.expectedValue});
    this.withLiteralPromise = this.session.run("RETURN "+jsToCypherLiteral(this.expectedValue)+" as x");
  }

};

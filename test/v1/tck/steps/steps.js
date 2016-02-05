var neo4j = require("../../../../lib/v1");

module.exports = function () {

  this.Before(function( scenario ) {
    this.driver = neo4j.driver("bolt://localhost");
    this.session = this.driver.session();
  });

  this.Given(/^A running database$/, function () {
    return this.session.run("RETURN 1 AS one");
  });

  this.Given(/^a String of size (\d+)$/, function (size) {
    this.expectedValue = stringOfSize(size);
  });

  this.Given(/^a List of size (\d+) and type (.*)$/, function (size, type) {
    var list = [];
    for(var i = 0; i < size; i++ ) {
      if (type === 'String') {
        list.push(stringOfSize(3));
      }
      if (type === 'Integer') {
        list.push(randomInt());
      }
      if (type === 'Boolean') {
        list.push(randomBool());
      }
      if (type === 'Float') {
        list.push(randomFloat());
      }
      if (type === 'Null') {
        list.push(null);
      }
    }
    this.expectedValue = list;
  });

  this.Given(/^a Map of size (\d+) and type (.*)$/, function (size, type) {
    var map = {};
    for(var i = 0; i < size; i++ ) {
      if (type === 'String') {
        map["a" + sizeOfObject(this.M)] = stringOfSize(3);
      }
      if (type === 'Integer') {
        map["a" + sizeOfObject(this.M)] = randomInt();
      }
      if (type === 'Boolean') {
        map["a" + sizeOfObject(this.M)] = randomBool();
      }
      if (type === 'Float') {
        map["a" + sizeOfObject(this.M)] = randomFloat();
      }
      if (type === 'Null') {
        map["a" + sizeOfObject(this.M)] = null;
      }
    }
    this.expectedValue = map;
  });

  this.Given(/^a list value (.*) of type (.*)$/, function (input, boltType) {
    this.expectedValue = getListFromString(boltType, input);
  });

  this.Given(/^a value (.*) of type (.*)$/, function (input, boltType) {
    this.expectedValue = toParameter(boltType, input)
  });

  this.Given(/^an empty list L$/, function () {
    this.L = [];
  });

  this.Given(/^an empty map M$/, function () {
    this.M = {};
  });

  this.Given(/^adding a table of values to the list L$/, function (table) {
    var rows = table.rows();
    for (var i = 0, len = rows.length; i < len; i++) {
      this.L.push(toParameter(rows[i][0], rows[i][1]));
    }
  });

  this.Given(/^adding a table of lists to the list L$/, function (table) {
    var rows = table.rows();
    for (var i = 0, len = rows.length; i < len; i++) {
      this.L.push(getListFromString(rows[i][0], rows[i][1]));
    }
  });

  this.Given(/^adding map M to list L$/, function () {
    this.L.push(this.M);
  });

  this.Given(/^adding a table of values to the map M$/, function (table) {
    var rows = table.rows();
    for (var i = 0, len = rows.length; i < len; i++) {
      this.M["a" + sizeOfObject(this.M)] = toParameter(rows[i][0], rows[i][1]);
    }
  });

  this.When(/^adding a table of lists to the map M$/, function (table) {
    var rows = table.rows();
    for (var i = 0, len = rows.length; i < len; i++) {
      this.M["a" + sizeOfObject(this.M)] = getListFromString(rows[i][0], rows[i][1]);
    }
  });

  this.When(/^adding a copy of map M to map M$/, function () {
    var copy_of_map = {}
    for(var key in this.M) {
      copy_of_map[key] = this.M[key]
    }
    this.M["a" + sizeOfObject(this.M)] = copy_of_map;
  });

  this.When(/^the driver asks the server to echo this value back$/, function () {
    echoExpectedValue.call(this);
  });

  this.When(/^the driver asks the server to echo this list back$/, function () {
    this.expectedValue = this.L;
    echoExpectedValue.call(this);
  });

  this.When(/^the driver asks the server to echo this map back$/, function () {
    this.expectedValue = this.M;
    echoExpectedValue.call(this);
  });

  this.Then(/^the value given in the result should be the same as what was sent$/, function (callback) {
    var self = this;
    var errorCallback = function(err) {callback(new Error("Rejected Promise: " + err))}
    var successCallback = function(res) {
      if(Object.keys(res[0]).length != 1 || Object.keys(res[0])[0].length != 1) {
        callback(new Error("Expected the statement to return a single row, single field record. Got: " + Object.keys(res[0]).length + " records and: " + Object.keys(res[0])[0].length + " values"));
      }
      if (!compareValues(res[0]['x'], self.expectedValue)) {
          callback(new Error("Expected the statement to return same as what was sent. Got: " + res[0]['x'] + " Expected: " + self.expectedValue));
      }
      callback();
    }
    this.withParamPromise.then(successCallback).catch(errorCallback);
    this.withLiteralPromise.then(successCallback).catch(errorCallback);

  });

  this.After(function () {
    this.driver.close()
  });

  function sizeOfObject(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
  }

  function stringOfSize(size) {
    var chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array(size).join().split(',').map(function() { return chars.charAt(Math.floor(Math.random() * chars.length)); }).join('');
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

    if (type === 'String') {
      return value.toString();
    }
    if (type === 'Integer') {
      return neo4j.int(value);
    }
    if (type === 'Boolean') {
      return Boolean(value);
    }
    if (type === 'Float') {
      return parseFloat(value);
    }
    if (type === 'Null') {
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
      return 'Null'
    }
    else if( typeof jsVal === "object" && jsVal instanceof Array ) {
      var list = "["
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

  function compareValues(one, other) {
    if (neo4j.isInt(one)) {
      if (one.equals(other)) {
        return true;
      }
    }
    else if (typeof one === "object" && one instanceof Array){
      if (one === other) return true;
      if (sizeOfObject(one) != sizeOfObject(other)) return false;
      for (var i = 0; i < one.length; ++i) {
        if (!compareValues(one[i], other[i])) {
          console.log("Mismatch at index: [" + i + "] Values should be same but was : [" + one[i] +"] and : [" + other[i] + "]");
          return false;
        }
      }
      return true;
    }
    else if (typeof one === "object" && one instanceof Object){
      if (one === other) return true;
      if (one.length != other.length) return false;
      for (var key in one) {
        if (typeof other[key] == "undefined") return false;
        if (!compareValues(one[key], other[key])) {
          console.log("Mismatch at key: [" + key + "] Values should be same but was : [" + one[key] +"] and : [" + other[key] + "]");
          return false;
        }
      }
      return true;
    }
    else if (one === other) {
      return true;
    }
    return false;
  }

  function getListFromString(type, input) {
    var str = input.replace("[", "");
    str = str.replace("]","");
    str = str.split(",");
    var list = [];
    for(var i = 0; i < str.length; i++ ) {
      list.push(toParameter(type,str[i]));
    }
    return list;
  }

  function echoExpectedValue() {
    this.withParamPromise = this.session.run("RETURN {x} as x", {x:this.expectedValue});
    this.withLiteralPromise = this.session.run("RETURN "+jsToCypherLiteral(this.expectedValue)+" as x");
  }
};

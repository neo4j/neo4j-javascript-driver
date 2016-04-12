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

"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _error = require("./error");

function generateFieldLookup(keys) {
  var lookup = {};
  keys.forEach(function (name, idx) {
    lookup[name] = idx;
  });
  return lookup;
}

/**
 * Records make up the contents of the {@link Result}, and is how you access
 * the output of a statement. A simple statement might yield a result stream
 * with a single record, for instance:
 *
 *     MATCH (u:User) RETURN u.name, u.age
 *
 * This returns a stream of records with two fields, named `u.name` and `u.age`,
 * each record represents one user found by the statement above. You can access
 * the values of each field either by name:
 *
 *     record.get("n.name")
 *
 * Or by it's position:
 *
 *     record.get(0)
 *
 * @access public
 */

var Record = (function () {
  /**
   * Create a new record object.
   * @constructor
   * @access private
   * @param {Object} keys An array of field keys, in the order the fields appear
   *                      in the record
   * @param {Object} fields An array of field values
   * @param {Object} fieldLookup An object of fieldName -> value index, used to map
   *                            field names to values. If this is null, one will be
   *                            generated.
   */

  function Record(keys, fields) {
    var fieldLookup = arguments.length <= 2 || arguments[2] === undefined ? null : arguments[2];

    _classCallCheck(this, Record);

    this.keys = keys;
    this.length = keys.length;
    this._fields = fields;
    this._fieldLookup = fieldLookup || generateFieldLookup(keys);
  }

  /**
   * Run the given function for each field in this record. The function
   * will get three arguments - the value, the key and this record, in that
   * order.
   *
   * @param visitor
   */

  _createClass(Record, [{
    key: "forEach",
    value: function forEach(visitor) {
      for (var i = 0; i < this.keys.length; i++) {
        visitor(this._fields[i], this.keys[i], this);
      }
    }

    /**
     * Get a value from this record, either by index or by field key.
     *
     * @param {string|Number} key Field key, or the index of the field.
     * @returns {*}
     */
  }, {
    key: "get",
    value: function get(key) {
      var index = undefined;
      if (!(typeof key === "number")) {
        index = this._fieldLookup[key];
        if (index === undefined) {
          throw (0, _error.newError)("This record has no field with key '" + key + "', available key are: [" + this.keys + "].");
        }
      } else {
        index = key;
      }

      if (index > this._fields.length - 1 || index < 0) {
        throw (0, _error.newError)("This record has no field with index '" + index + "'. Remember that indexes start at `0`, " + "and make sure your statement returns records in the shape you meant it to.");
      }

      return this._fields[index];
    }
  }]);

  return Record;
})();

exports.Record = Record;
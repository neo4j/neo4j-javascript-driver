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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _integer = require('./integer');

var _driver = require('./driver');

var _graphTypes = require('./graph-types');

var _error = require('./error');

var _result = require('./result');

var _result2 = _interopRequireDefault(_result);

var _resultSummary = require('./result-summary');

var _resultSummary2 = _interopRequireDefault(_resultSummary);

var _record = require('./record');

exports['default'] = {
  driver: _driver.driver,
  int: _integer.int,
  isInt: _integer.isInt,
  Neo4jError: _error.Neo4jError,
  auth: {
    basic: function basic(username, password) {
      var realm = arguments.length <= 2 || arguments[2] === undefined ? undefined : arguments[2];

      if (realm) {
        return { scheme: "basic", principal: username, credentials: password, realm: realm };
      } else {
        return { scheme: "basic", principal: username, credentials: password };
      }
    },
    custom: function custom(principal, credentials, realm, scheme) {
      var parameters = arguments.length <= 4 || arguments[4] === undefined ? undefined : arguments[4];

      if (parameters) {
        return { scheme: scheme, principal: principal, credentials: credentials, realm: realm,
          parameters: parameters };
      } else {
        return { scheme: scheme, principal: principal, credentials: credentials, realm: realm };
      }
    }
  },
  types: {
    Node: _graphTypes.Node,
    Relationship: _graphTypes.Relationship,
    UnboundRelationship: _graphTypes.UnboundRelationship,
    PathSegment: _graphTypes.PathSegment,
    Path: _graphTypes.Path,
    Result: _result2['default'],
    ResultSummary: _resultSummary2['default'],
    Record: _record.Record
  }
};
module.exports = exports['default'];
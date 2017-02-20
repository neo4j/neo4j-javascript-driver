'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PROTOCOL_ERROR = exports.SESSION_EXPIRED = exports.SERVICE_UNAVAILABLE = exports.Neo4jError = exports.newError = undefined;

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Copyright (c) 2002-2017 "Neo Technology,","
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

// A common place for constructing error objects, to keep them
// uniform across the driver surface.

var SERVICE_UNAVAILABLE = 'ServiceUnavailable';
var SESSION_EXPIRED = 'SessionExpired';
var PROTOCOL_ERROR = 'ProtocolError';

function newError(message) {
  var code = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "N/A";

  // TODO: Idea is that we can check the code here and throw sub-classes
  // of Neo4jError as appropriate
  return new Neo4jError(message, code);
}

var Neo4jError = function (_Error) {
  (0, _inherits3.default)(Neo4jError, _Error);

  function Neo4jError(message) {
    var code = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "N/A";
    (0, _classCallCheck3.default)(this, Neo4jError);

    var _this = (0, _possibleConstructorReturn3.default)(this, (Neo4jError.__proto__ || (0, _getPrototypeOf2.default)(Neo4jError)).call(this, message));

    _this.message = message;
    _this.code = code;
    return _this;
  }

  return Neo4jError;
}(Error);

exports.newError = newError;
exports.Neo4jError = Neo4jError;
exports.SERVICE_UNAVAILABLE = SERVICE_UNAVAILABLE;
exports.SESSION_EXPIRED = SESSION_EXPIRED;
exports.PROTOCOL_ERROR = PROTOCOL_ERROR;
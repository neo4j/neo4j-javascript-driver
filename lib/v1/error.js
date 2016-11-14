'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

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

// A common place for constructing error objects, to keep them
// uniform across the driver surface.

var SERVICE_UNAVAILABLE = 'ServiceUnavailable';
var SESSION_EXPIRED = 'SessionExpired';
function newError(message) {
  var code = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "N/A";

  // TODO: Idea is that we can check the code here and throw sub-classes
  // of Neo4jError as appropriate
  return new Neo4jError(message, code);
}

var Neo4jError = function (_Error) {
  _inherits(Neo4jError, _Error);

  function Neo4jError(message) {
    var code = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "N/A";

    _classCallCheck(this, Neo4jError);

    var _this = _possibleConstructorReturn(this, (Neo4jError.__proto__ || Object.getPrototypeOf(Neo4jError)).call(this, message));

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
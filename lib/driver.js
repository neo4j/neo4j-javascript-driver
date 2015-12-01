/**
 * Copyright (c) 2002-2015 "Neo Technology,"
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

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _session2 = require('./session');

var _session3 = _interopRequireDefault(_session2);

var _internalConnector = require("./internal/connector");

/**
  * A Driver instance is used for mananging {@link Session}s.
  * @access public
  */

var Driver = (function () {
  /**
   * @constructor
   * @param {string} url
   * @param {string} userAgent
   */

  function Driver(url, userAgent) {
    _classCallCheck(this, Driver);

    this._url = url;
    this._userAgent = userAgent || 'neo4j-javascript/0.0';
    this._openSessions = {};
    this._sessionIdGenerator = 0;
  }

  /**
   * Create and return new session
   * @return {Session} new session.
   */

  _createClass(Driver, [{
    key: 'session',
    value: function session() {
      var sessionId = this._sessionIdGenerator++;
      var conn = (0, _internalConnector.connect)(this._url);
      conn.initialize(this._userAgent);

      var _driver = this;
      var _session = new _session3['default'](conn, function () {
        // On close of session, remove it from the list of open sessions
        delete _driver._openSessions[sessionId];
      });

      this._openSessions[sessionId] = _session;
      return _session;
    }

    /**
     * Close sessions connections
     * @return
     */
  }, {
    key: 'close',
    value: function close() {
      for (var sessionId in this._openSessions) {
        if (this._openSessions.hasOwnProperty(sessionId)) {
          this._openSessions[sessionId].close();
        }
      }
    }
  }]);

  return Driver;
})();

exports['default'] = Driver;
module.exports = exports['default'];
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

var _internalStreamObserver = require('./internal/stream-observer');

var _internalStreamObserver2 = _interopRequireDefault(_internalStreamObserver);

var _result = require('./result');

/**
  * A Session instance is used for handling the connection and
  * sending statements through the connection.
  * @access public
  */

var Session = (function () {
  /**
   * @constructor
   * @param {Connection} conn - A connection to use
   * @param {function()} onClose - Function to be called on connection close
   */

  function Session(conn, onClose) {
    _classCallCheck(this, Session);

    this._conn = conn;
    this._onClose = onClose;
  }

  /**
   * Run Cypher statement
   * Could be called with a statement object i.e.: {statement: "MATCH ...", parameters: {param: 1}}
   * or with the statement and parameters as separate arguments.
   * @param {mixed} statement - Cypher statement to execute
   * @param {Object} parameters - Map with parameters to use in statement
   * @return {Result} - New Result
   */

  _createClass(Session, [{
    key: 'run',
    value: function run(statement, parameters) {
      if (typeof statement === 'object' && statement.text) {
        parameters = statement.parameters || {};
        statement = statement.text;
      }
      var streamObserver = new _internalStreamObserver2['default']();
      this._conn.run(statement, parameters || {}, streamObserver);
      this._conn.pullAll(streamObserver);
      this._conn.sync();
      return new _result.Result(streamObserver, statement, parameters);
    }

    /**
     * Close connection
     * @param {function()} cb - Function to be called on connection close
     * @return
     */
  }, {
    key: 'close',
    value: function close(cb) {
      this._onClose();
      this._conn.close(cb);
    }
  }]);

  return Session;
})();

exports['default'] = Session;
module.exports = exports['default'];
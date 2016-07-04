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

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _internalStreamObserver = require('./internal/stream-observer');

var _internalStreamObserver2 = _interopRequireDefault(_internalStreamObserver);

var _result = require('./result');

var _result2 = _interopRequireDefault(_result);

var _transaction = require('./transaction');

var _transaction2 = _interopRequireDefault(_transaction);

var _error = require("./error");

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
    this._hasTx = false;
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
    value: function run(statement) {
      var parameters = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      if (typeof statement === 'object' && statement.text) {
        parameters = statement.parameters || {};
        statement = statement.text;
      }
      var streamObserver = new _internalStreamObserver2['default']();
      if (!this._hasTx) {
        this._conn.run(statement, parameters, streamObserver);
        this._conn.pullAll(streamObserver);
        this._conn.sync();
      } else {
        streamObserver.onError((0, _error.newError)("Statements cannot be run directly on a " + "session with an open transaction; either run from within the " + "transaction or use a different session."));
      }
      return new _result2['default'](streamObserver, statement, parameters);
    }

    /**
     * Begin a new transaction in this session. A session can have at most one transaction running at a time, if you
     * want to run multiple concurrent transactions, you should use multiple concurrent sessions.
     *
     * While a transaction is open the session cannot be used to run statements outside the transaction.
     *
     * @returns {Transaction} - New Transaction
     */
  }, {
    key: 'beginTransaction',
    value: function beginTransaction() {
      var _this = this;

      if (this._hasTx) {
        throw new _error.newError("You cannot begin a transaction on a session with an " + "open transaction; either run from within the transaction or use a " + "different session.");
      }

      this._hasTx = true;
      return new _transaction2['default'](this._conn, function () {
        _this._hasTx = false;
      });
    }

    /**
     * Close this session.
     * @param {function()} cb - Function to be called after the session has been closed
     * @return
     */
  }, {
    key: 'close',
    value: function close() {
      var cb = arguments.length <= 0 || arguments[0] === undefined ? function () {
        return null;
      } : arguments[0];

      if (this._onClose) {
        try {
          this._onClose(cb);
        } finally {
          this._onClose = null;
        }
      } else {
        cb();
      }
    }
  }]);

  return Session;
})();

exports['default'] = Session;
module.exports = exports['default'];
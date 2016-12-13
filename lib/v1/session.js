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

var _get = function get(_x3, _x4, _x5) { var _again = true; _function: while (_again) { var object = _x3, property = _x4, receiver = _x5; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x3 = parent; _x4 = property; _x5 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _internalStreamObserver = require('./internal/stream-observer');

var _internalStreamObserver2 = _interopRequireDefault(_internalStreamObserver);

var _result = require('./result');

var _result2 = _interopRequireDefault(_result);

var _transaction = require('./transaction');

var _transaction2 = _interopRequireDefault(_transaction);

var _integer = require("./integer");

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

  /** Internal stream observer used for transactional results*/

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
      var streamObserver = new _RunObserver();
      if (!this._hasTx) {
        this._conn.run(statement, parameters, streamObserver);
        this._conn.pullAll(streamObserver);
        this._conn.sync();
      } else {
        streamObserver.onError((0, _error.newError)("Statements cannot be run directly on a " + "session with an open transaction; either run from within the " + "transaction or use a different session."));
      }
      return new _result2['default'](streamObserver, statement, parameters, function () {
        return streamObserver.meta();
      });
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

var _RunObserver = (function (_StreamObserver) {
  _inherits(_RunObserver, _StreamObserver);

  function _RunObserver() {
    _classCallCheck(this, _RunObserver);

    _get(Object.getPrototypeOf(_RunObserver.prototype), 'constructor', this).call(this);
    this._meta = {};
  }

  _createClass(_RunObserver, [{
    key: 'onCompleted',
    value: function onCompleted(meta) {
      _get(Object.getPrototypeOf(_RunObserver.prototype), 'onCompleted', this).call(this, meta);
      for (var key in meta) {
        if (meta.hasOwnProperty(key)) {
          this._meta[key] = meta[key];
        }
      }
    }
  }, {
    key: 'meta',
    value: function meta() {
      return this._meta;
    }
  }]);

  return _RunObserver;
})(_internalStreamObserver2['default']);

exports['default'] = Session;
module.exports = exports['default'];
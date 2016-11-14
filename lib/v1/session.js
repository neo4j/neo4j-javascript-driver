'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
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

var _streamObserver = require('./internal/stream-observer');

var _streamObserver2 = _interopRequireDefault(_streamObserver);

var _result = require('./result');

var _result2 = _interopRequireDefault(_result);

var _transaction = require('./transaction');

var _transaction2 = _interopRequireDefault(_transaction);

var _integer = require('./integer');

var _integer2 = _interopRequireDefault(_integer);

var _error = require('./error');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
  * A Session instance is used for handling the connection and
  * sending statements through the connection.
  * @access public
  */

var Session = function () {
  /**
   * @constructor
   * @param {Promise.<Connection>} connectionPromise - Promise of a connection to use
   * @param {function()} onClose - Function to be called on connection close
   */
  function Session(connectionPromise, onClose) {
    _classCallCheck(this, Session);

    this._connectionPromise = connectionPromise;
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
      var parameters = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      if ((typeof statement === 'undefined' ? 'undefined' : _typeof(statement)) === 'object' && statement.text) {
        parameters = statement.parameters || {};
        statement = statement.text;
      }
      var streamObserver = new _RunObserver(this._onRunFailure());
      if (!this._hasTx) {
        this._connectionPromise.then(function (conn) {
          streamObserver.resolveConnection(conn);
          conn.run(statement, parameters, streamObserver);
          conn.pullAll(streamObserver);
          conn.sync();
        }).catch(function (err) {
          return streamObserver.onError(err);
        });
      } else {
        streamObserver.onError((0, _error.newError)("Statements cannot be run directly on a " + "session with an open transaction; either run from within the " + "transaction or use a different session."));
      }
      return new _result2.default(streamObserver, statement, parameters, function () {
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
    value: function beginTransaction(bookmark) {
      var _this = this;

      if (this._hasTx) {
        throw (0, _error.newError)("You cannot begin a transaction on a session with an " + "open transaction; either run from within the transaction or use a " + "different session.");
      }

      this._hasTx = true;
      return new _transaction2.default(this._connectionPromise, function () {
        _this._hasTx = false;
      }, this._onRunFailure(), bookmark, function (bookmark) {
        _this._lastBookmark = bookmark;
      });
    }
  }, {
    key: 'lastBookmark',
    value: function lastBookmark() {
      return this._lastBookmark;
    }

    /**
     * Close this session.
     * @param {function()} cb - Function to be called after the session has been closed
     * @return
     */

  }, {
    key: 'close',
    value: function close() {
      var cb = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : function () {
        return null;
      };

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

    //Can be overridden to add error callback on RUN

  }, {
    key: '_onRunFailure',
    value: function _onRunFailure() {
      return function (err) {
        return err;
      };
    }
  }]);

  return Session;
}();

/** Internal stream observer used for transactional results*/


var _RunObserver = function (_StreamObserver) {
  _inherits(_RunObserver, _StreamObserver);

  function _RunObserver(onError) {
    _classCallCheck(this, _RunObserver);

    var _this2 = _possibleConstructorReturn(this, (_RunObserver.__proto__ || Object.getPrototypeOf(_RunObserver)).call(this, onError));

    _this2._meta = {};
    return _this2;
  }

  _createClass(_RunObserver, [{
    key: 'onCompleted',
    value: function onCompleted(meta) {
      _get(_RunObserver.prototype.__proto__ || Object.getPrototypeOf(_RunObserver.prototype), 'onCompleted', this).call(this, meta);
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
}(_streamObserver2.default);

exports.default = Session;
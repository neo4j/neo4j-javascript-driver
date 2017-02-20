"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _assign = require("babel-runtime/core-js/object/assign");

var _assign2 = _interopRequireDefault(_assign);

var _getPrototypeOf = require("babel-runtime/core-js/object/get-prototype-of");

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _possibleConstructorReturn2 = require("babel-runtime/helpers/possibleConstructorReturn");

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _get2 = require("babel-runtime/helpers/get");

var _get3 = _interopRequireDefault(_get2);

var _inherits2 = require("babel-runtime/helpers/inherits");

var _inherits3 = _interopRequireDefault(_inherits2);

var _typeof2 = require("babel-runtime/helpers/typeof");

var _typeof3 = _interopRequireDefault(_typeof2);

var _classCallCheck2 = require("babel-runtime/helpers/classCallCheck");

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require("babel-runtime/helpers/createClass");

var _createClass3 = _interopRequireDefault(_createClass2);

var _streamObserver = require("./internal/stream-observer");

var _streamObserver2 = _interopRequireDefault(_streamObserver);

var _result = require("./result");

var _result2 = _interopRequireDefault(_result);

var _transaction = require("./transaction");

var _transaction2 = _interopRequireDefault(_transaction);

var _error = require("./error");

var _util = require("./internal/util");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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
    (0, _classCallCheck3.default)(this, Session);

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


  (0, _createClass3.default)(Session, [{
    key: "run",
    value: function run(statement) {
      var parameters = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      if ((typeof statement === "undefined" ? "undefined" : (0, _typeof3.default)(statement)) === 'object' && statement.text) {
        parameters = statement.parameters || {};
        statement = statement.text;
      }
      (0, _util.assertString)(statement, "Cypher statement");

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
    key: "beginTransaction",
    value: function beginTransaction(bookmark) {
      var _this = this;

      if (bookmark) {
        (0, _util.assertString)(bookmark, "Bookmark");
      }

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
    key: "lastBookmark",
    value: function lastBookmark() {
      return this._lastBookmark;
    }

    /**
     * Close this session.
     * @param {function()} cb - Function to be called after the session has been closed
     * @return
     */

  }, {
    key: "close",
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
    key: "_onRunFailure",
    value: function _onRunFailure() {
      return function (err) {
        return err;
      };
    }
  }]);
  return Session;
}();

/** Internal stream observer used for transactional results*/
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


var _RunObserver = function (_StreamObserver) {
  (0, _inherits3.default)(_RunObserver, _StreamObserver);

  function _RunObserver(onError) {
    (0, _classCallCheck3.default)(this, _RunObserver);

    var _this2 = (0, _possibleConstructorReturn3.default)(this, (_RunObserver.__proto__ || (0, _getPrototypeOf2.default)(_RunObserver)).call(this, onError));

    _this2._meta = {};
    return _this2;
  }

  (0, _createClass3.default)(_RunObserver, [{
    key: "onCompleted",
    value: function onCompleted(meta) {
      (0, _get3.default)(_RunObserver.prototype.__proto__ || (0, _getPrototypeOf2.default)(_RunObserver.prototype), "onCompleted", this).call(this, meta);
      for (var key in meta) {
        if (meta.hasOwnProperty(key)) {
          this._meta[key] = meta[key];
        }
      }
    }
  }, {
    key: "meta",
    value: function meta() {
      var serverMeta = { server: this._conn.server };
      return (0, _assign2.default)({}, this._meta, serverMeta);
    }
  }]);
  return _RunObserver;
}(_streamObserver2.default);

exports.default = Session;
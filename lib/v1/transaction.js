'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _get2 = require('babel-runtime/helpers/get');

var _get3 = _interopRequireDefault(_get2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _streamObserver = require('./internal/stream-observer');

var _streamObserver2 = _interopRequireDefault(_streamObserver);

var _result = require('./result');

var _result2 = _interopRequireDefault(_result);

var _util = require('./internal/util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Represents a transaction in the Neo4j database.
 *
 * @access public
 */
var Transaction = function () {
  /**
   * @constructor
   * @param {Promise} connectionPromise - A connection to use
   * @param {function()} onClose - Function to be called when transaction is committed or rolled back.
   * @param errorTransformer callback use to transform error
   * @param bookmark optional bookmark
   * @param onBookmark callback invoked when new bookmark is produced
   */
  function Transaction(connectionPromise, onClose, errorTransformer, bookmark, onBookmark) {
    (0, _classCallCheck3.default)(this, Transaction);

    this._connectionPromise = connectionPromise;
    var streamObserver = new _TransactionStreamObserver(this);
    var params = {};
    if (bookmark) {
      params = { bookmark: bookmark };
    }
    this._connectionPromise.then(function (conn) {
      streamObserver.resolveConnection(conn);
      conn.run("BEGIN", params, streamObserver);
      conn.discardAll(streamObserver);
    }).catch(streamObserver.onError);

    this._state = _states.ACTIVE;
    this._onClose = onClose;
    this._errorTransformer = errorTransformer;
    this._onBookmark = onBookmark || function () {};
  }

  /**
   * Run Cypher statement
   * Could be called with a statement object i.e.: {statement: "MATCH ...", parameters: {param: 1}}
   * or with the statement and parameters as separate arguments.
   * @param {mixed} statement - Cypher statement to execute
   * @param {Object} parameters - Map with parameters to use in statement
   * @return {Result} - New Result
   */


  (0, _createClass3.default)(Transaction, [{
    key: 'run',
    value: function run(statement, parameters) {
      if ((typeof statement === 'undefined' ? 'undefined' : (0, _typeof3.default)(statement)) === 'object' && statement.text) {
        parameters = statement.parameters || {};
        statement = statement.text;
      }
      (0, _util.assertString)(statement, "Cypher statement");

      return this._state.run(this._connectionPromise, new _TransactionStreamObserver(this), statement, parameters);
    }

    /**
     * Commits the transaction and returns the result.
     *
     * After committing the transaction can no longer be used.
     *
     * @returns {Result} - New Result
     */

  }, {
    key: 'commit',
    value: function commit() {
      var committed = this._state.commit(this._connectionPromise, new _TransactionStreamObserver(this));
      this._state = committed.state;
      //clean up
      this._onClose();
      return committed.result;
    }

    /**
     * Rollbacks the transaction.
     *
     * After rolling back, the transaction can no longer be used.
     *
     * @returns {Result} - New Result
     */

  }, {
    key: 'rollback',
    value: function rollback() {
      var committed = this._state.rollback(this._connectionPromise, new _TransactionStreamObserver(this));
      this._state = committed.state;
      //clean up
      this._onClose();
      return committed.result;
    }
  }, {
    key: '_onError',
    value: function _onError() {
      // rollback explicitly if tx.run failed, rollback
      if (this._state == _states.ACTIVE) {
        this.rollback();
      } else {
        // else just do the cleanup
        this._onClose();
      }
      this._state = _states.FAILED;
    }
  }]);
  return Transaction;
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


var _TransactionStreamObserver = function (_StreamObserver) {
  (0, _inherits3.default)(_TransactionStreamObserver, _StreamObserver);

  function _TransactionStreamObserver(tx) {
    (0, _classCallCheck3.default)(this, _TransactionStreamObserver);

    var _this = (0, _possibleConstructorReturn3.default)(this, (_TransactionStreamObserver.__proto__ || (0, _getPrototypeOf2.default)(_TransactionStreamObserver)).call(this, tx._errorTransformer || function (err) {
      return err;
    }));

    _this._tx = tx;
    //this is to to avoid multiple calls to onError caused by IGNORED
    _this._hasFailed = false;
    return _this;
  }

  (0, _createClass3.default)(_TransactionStreamObserver, [{
    key: 'onError',
    value: function onError(error) {
      if (!this._hasFailed) {
        this._tx._onError();
        (0, _get3.default)(_TransactionStreamObserver.prototype.__proto__ || (0, _getPrototypeOf2.default)(_TransactionStreamObserver.prototype), 'onError', this).call(this, error);
        this._hasFailed = true;
      }
    }
  }, {
    key: 'onCompleted',
    value: function onCompleted(meta) {
      (0, _get3.default)(_TransactionStreamObserver.prototype.__proto__ || (0, _getPrototypeOf2.default)(_TransactionStreamObserver.prototype), 'onCompleted', this).call(this, meta);
      var bookmark = meta.bookmark;
      this._tx._onBookmark(bookmark);
    }
  }, {
    key: 'serverMeta',
    value: function serverMeta() {
      var serverMeta = { server: this._conn.server };
      return serverMeta;
    }
  }]);
  return _TransactionStreamObserver;
}(_streamObserver2.default);

/** internal state machine of the transaction*/


var _states = {
  //The transaction is running with no explicit success or failure marked
  ACTIVE: {
    commit: function commit(connectionPromise, observer) {
      return { result: _runDiscardAll("COMMIT", connectionPromise, observer),
        state: _states.SUCCEEDED };
    },
    rollback: function rollback(connectionPromise, observer) {
      return { result: _runDiscardAll("ROLLBACK", connectionPromise, observer), state: _states.ROLLED_BACK };
    },
    run: function run(connectionPromise, observer, statement, parameters) {
      connectionPromise.then(function (conn) {
        observer.resolveConnection(conn);
        conn.run(statement, parameters || {}, observer);
        conn.pullAll(observer);
        conn.sync();
      }).catch(observer.onError);

      return new _result2.default(observer, statement, parameters, function () {
        return observer.serverMeta();
      });
    }
  },

  //An error has occurred, transaction can no longer be used and no more messages will
  // be sent for this transaction.
  FAILED: {
    commit: function commit(conn, observer) {
      observer.onError({
        error: "Cannot commit statements in this transaction, because previous statements in the " + "transaction has failed and the transaction has been rolled back. Please start a new" + " transaction to run another statement."
      });
      return { result: new _result2.default(observer, "COMMIT", {}), state: _states.FAILED };
    },
    rollback: function rollback(conn, observer) {
      observer.onError({ error: "Cannot rollback transaction, because previous statements in the " + "transaction has failed and the transaction has already been rolled back." });
      return { result: new _result2.default(observer, "ROLLBACK", {}), state: _states.FAILED };
    },
    run: function run(conn, observer, statement, parameters) {
      observer.onError({ error: "Cannot run statement, because previous statements in the " + "transaction has failed and the transaction has already been rolled back." });
      return new _result2.default(observer, statement, parameters);
    }
  },

  //This transaction has successfully committed
  SUCCEEDED: {
    commit: function commit(conn, observer) {
      observer.onError({
        error: "Cannot commit statements in this transaction, because commit has already been successfully called on the transaction and transaction has been closed. Please start a new" + " transaction to run another statement."
      });
      return { result: new _result2.default(observer, "COMMIT", {}), state: _states.SUCCEEDED };
    },
    rollback: function rollback(conn, observer) {
      observer.onError({ error: "Cannot rollback transaction, because transaction has already been successfully closed." });
      return { result: new _result2.default(observer, "ROLLBACK", {}), state: _states.SUCCEEDED };
    },
    run: function run(conn, observer, statement, parameters) {
      observer.onError({ error: "Cannot run statement, because transaction has already been successfully closed." });
      return new _result2.default(observer, statement, parameters);
    }
  },

  //This transaction has been rolled back
  ROLLED_BACK: {
    commit: function commit(conn, observer) {
      observer.onError({
        error: "Cannot commit this transaction, because it has already been rolled back."
      });
      return { result: new _result2.default(observer, "COMMIT", {}), state: _states.ROLLED_BACK };
    },
    rollback: function rollback(conn, observer) {
      observer.onError({ error: "Cannot rollback transaction, because transaction has already been rolled back." });
      return { result: new _result2.default(observer, "ROLLBACK", {}), state: _states.ROLLED_BACK };
    },
    run: function run(conn, observer, statement, parameters) {
      observer.onError({ error: "Cannot run statement, because transaction has already been rolled back." });
      return new _result2.default(observer, statement, parameters);
    }
  }
};

function _runDiscardAll(msg, connectionPromise, observer) {
  connectionPromise.then(function (conn) {
    observer.resolveConnection(conn);
    conn.run(msg, {}, observer);
    conn.discardAll(observer);
    conn.sync();
  }).catch(observer.onError);

  return new _result2.default(observer, msg, {});
}

exports.default = Transaction;
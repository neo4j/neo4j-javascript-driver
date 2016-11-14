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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

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
   */
  function Transaction(connectionPromise, onClose, errorTransformer, bookmark, onBookmark) {
    _classCallCheck(this, Transaction);

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


  _createClass(Transaction, [{
    key: 'run',
    value: function run(statement, parameters) {
      if ((typeof statement === 'undefined' ? 'undefined' : _typeof(statement)) === 'object' && statement.text) {
        parameters = statement.parameters || {};
        statement = statement.text;
      }
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
      this._onClose();
      this._state = _states.FAILED;
    }
  }]);

  return Transaction;
}();

/** Internal stream observer used for transactional results*/


var _TransactionStreamObserver = function (_StreamObserver) {
  _inherits(_TransactionStreamObserver, _StreamObserver);

  function _TransactionStreamObserver(tx) {
    _classCallCheck(this, _TransactionStreamObserver);

    var _this = _possibleConstructorReturn(this, (_TransactionStreamObserver.__proto__ || Object.getPrototypeOf(_TransactionStreamObserver)).call(this, tx._errorTransformer || function (err) {
      return err;
    }));

    _this._tx = tx;
    //this is to to avoid multiple calls to onError caused by IGNORED
    _this._hasFailed = false;
    return _this;
  }

  _createClass(_TransactionStreamObserver, [{
    key: 'onError',
    value: function onError(error) {
      if (!this._hasFailed) {
        this._tx._onError();
        _get(_TransactionStreamObserver.prototype.__proto__ || Object.getPrototypeOf(_TransactionStreamObserver.prototype), 'onError', this).call(this, error);
        this._hasFailed = true;
      }
    }
  }, {
    key: 'onCompleted',
    value: function onCompleted(meta) {
      _get(_TransactionStreamObserver.prototype.__proto__ || Object.getPrototypeOf(_TransactionStreamObserver.prototype), 'onCompleted', this).call(this, meta);
      var bookmark = meta.bookmark;
      if (bookmark) {
        this._tx._onBookmark(bookmark);
      }
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

      return new _result2.default(observer, statement, parameters);
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
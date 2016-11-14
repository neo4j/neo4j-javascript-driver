'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WRITE = exports.READ = exports.Driver = undefined;

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

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

var _session = require('./session');

var _session2 = _interopRequireDefault(_session);

var _pool = require('./internal/pool');

var _pool2 = _interopRequireDefault(_pool);

var _integer = require('./integer');

var _integer2 = _interopRequireDefault(_integer);

var _connector = require('./internal/connector');

var _streamObserver = require('./internal/stream-observer');

var _streamObserver2 = _interopRequireDefault(_streamObserver);

var _error = require('./error');

require('babel-polyfill');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var READ = 'READ',
    WRITE = 'WRITE';
/**
 * A driver maintains one or more {@link Session sessions} with a remote
 * Neo4j instance. Through the {@link Session sessions} you can send statements
 * and retrieve results from the database.
 *
 * Drivers are reasonably expensive to create - you should strive to keep one
 * driver instance around per Neo4j Instance you connect to.
 *
 * @access public
 */

var Driver = function () {
  /**
   * You should not be calling this directly, instead use {@link driver}.
   * @constructor
   * @param {string} url
   * @param {string} userAgent
   * @param {Object} token
   * @param {Object} config
   * @access private
   */
  function Driver(url) {
    var userAgent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'neo4j-javascript/0.0';
    var token = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    var config = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

    _classCallCheck(this, Driver);

    this._url = url;
    this._userAgent = userAgent;
    this._openSessions = {};
    this._sessionIdGenerator = 0;
    this._token = token;
    this._config = config;
    this._pool = new _pool2.default(this._createConnection.bind(this), this._destroyConnection.bind(this), Driver._validateConnection.bind(this), config.connectionPoolSize);
  }

  /**
   * Create a new connection instance.
   * @return {Connection} new connector-api session instance, a low level session API.
   * @access private
   */


  _createClass(Driver, [{
    key: '_createConnection',
    value: function _createConnection(url, release) {
      var _this = this;

      var sessionId = this._sessionIdGenerator++;
      var streamObserver = new _ConnectionStreamObserver(this);
      var conn = (0, _connector.connect)(url, this._config);
      conn.initialize(this._userAgent, this._token, streamObserver);
      conn._id = sessionId;
      conn._release = function () {
        return release(_this._url, conn);
      };

      this._openSessions[sessionId] = conn;
      return conn;
    }

    /**
     * Check that a connection is usable
     * @return {boolean} true if the connection is open
     * @access private
     **/

  }, {
    key: '_destroyConnection',


    /**
     * Dispose of a live session, closing any associated resources.
     * @return {Session} new session.
     * @access private
     */
    value: function _destroyConnection(conn) {
      delete this._openSessions[conn._id];
      conn.close();
    }

    /**
     * Acquire a session to communicate with the database. The driver maintains
     * a pool of sessions, so calling this method is normally cheap because you
     * will be pulling a session out of the common pool.
     *
     * This comes with some responsibility - make sure you always call
     * {@link Session#close()} when you are done using a session, and likewise,
     * make sure you don't close your session before you are done using it. Once
     * it is returned to the pool, the session will be reset to a clean state and
     * made available for others to use.
     *
     * @param {String} mode of session - optional
     * @return {Session} new session.
     */

  }, {
    key: 'session',
    value: function session(mode) {
      var _this2 = this;

      var connectionPromise = this._acquireConnection(mode);
      connectionPromise.catch(function (err) {
        if (_this2.onError && err.code === _error.SERVICE_UNAVAILABLE) {
          _this2.onError(err);
        } else {
          //we don't need to tell the driver about this error
        }
      });
      return this._createSession(connectionPromise, function (cb) {
        // This gets called on Session#close(), and is where we return
        // the pooled 'connection' instance.

        // We don't pool Session instances, to avoid users using the Session
        // after they've called close. The `Session` object is just a thin
        // wrapper around Connection anyway, so it makes little difference.

        // Queue up a 'reset', to ensure the next user gets a clean
        // session to work with.

        connectionPromise.then(function (conn) {
          conn.reset();
          conn.sync();

          // Return connection to the pool
          conn._release();
        }).catch(function () {/*ignore errors here*/});

        // Call user callback
        if (cb) {
          cb();
        }
      });
    }

    //Extension point

  }, {
    key: '_acquireConnection',
    value: function _acquireConnection(mode) {
      return Promise.resolve(this._pool.acquire(this._url));
    }

    //Extension point

  }, {
    key: '_createSession',
    value: function _createSession(connectionPromise, cb) {
      return new _session2.default(connectionPromise, cb);
    }

    /**
     * Close all open sessions and other associated resources. You should
     * make sure to use this when you are done with this driver instance.
     * @return undefined
     */

  }, {
    key: 'close',
    value: function close() {
      for (var sessionId in this._openSessions) {
        if (this._openSessions.hasOwnProperty(sessionId)) {
          this._openSessions[sessionId].close();
        }
        this._pool.purgeAll();
      }
    }
  }], [{
    key: '_validateConnection',
    value: function _validateConnection(conn) {
      return conn.isOpen();
    }
  }]);

  return Driver;
}();

/** Internal stream observer used for connection state */


var _ConnectionStreamObserver = function (_StreamObserver) {
  _inherits(_ConnectionStreamObserver, _StreamObserver);

  function _ConnectionStreamObserver(driver) {
    _classCallCheck(this, _ConnectionStreamObserver);

    var _this3 = _possibleConstructorReturn(this, (_ConnectionStreamObserver.__proto__ || Object.getPrototypeOf(_ConnectionStreamObserver)).call(this));

    _this3._driver = driver;
    _this3._hasFailed = false;
    return _this3;
  }

  _createClass(_ConnectionStreamObserver, [{
    key: 'onError',
    value: function onError(error) {
      if (!this._hasFailed) {
        _get(_ConnectionStreamObserver.prototype.__proto__ || Object.getPrototypeOf(_ConnectionStreamObserver.prototype), 'onError', this).call(this, error);
        if (this._driver.onError) {
          this._driver.onError(error);
        }
        this._hasFailed = true;
      }
    }
  }, {
    key: 'onCompleted',
    value: function onCompleted(message) {
      if (this._driver.onCompleted) {
        this._driver.onCompleted(message);
      }
    }
  }]);

  return _ConnectionStreamObserver;
}(_streamObserver2.default);

exports.Driver = Driver;
exports.READ = READ;
exports.WRITE = WRITE;
exports.default = Driver;
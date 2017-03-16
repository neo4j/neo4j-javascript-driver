'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WRITE = exports.READ = exports.Driver = undefined;

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _get2 = require('babel-runtime/helpers/get');

var _get3 = _interopRequireDefault(_get2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _session = require('./session');

var _session2 = _interopRequireDefault(_session);

var _pool = require('./internal/pool');

var _pool2 = _interopRequireDefault(_pool);

var _connector = require('./internal/connector');

var _streamObserver = require('./internal/stream-observer');

var _streamObserver2 = _interopRequireDefault(_streamObserver);

var _error = require('./error');

var _connectionProviders = require('./internal/connection-providers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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
  function Driver(url, userAgent) {
    var token = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    var config = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
    (0, _classCallCheck3.default)(this, Driver);

    this._url = url;
    this._userAgent = userAgent;
    this._openSessions = {};
    this._sessionIdGenerator = 0;
    this._token = token;
    this._config = config;
    this._pool = new _pool2.default(this._createConnection.bind(this), this._destroyConnection.bind(this), Driver._validateConnection.bind(this), config.connectionPoolSize);
    this._connectionProvider = this._createConnectionProvider(url, this._pool, this._driverOnErrorCallback.bind(this));
  }

  /**
   * Create a new connection instance.
   * @return {Connection} new connector-api session instance, a low level session API.
   * @access private
   */


  (0, _createClass3.default)(Driver, [{
    key: '_createConnection',
    value: function _createConnection(url, release) {
      var sessionId = this._sessionIdGenerator++;
      var conn = (0, _connector.connect)(url, this._config);
      var streamObserver = new _ConnectionStreamObserver(this, conn);
      conn.initialize(this._userAgent, this._token, streamObserver);
      conn._id = sessionId;
      conn._release = function () {
        return release(url, conn);
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
     * @param {string} [mode=WRITE] the access mode of this session, allowed values are {@link READ} and {@link WRITE}.
     * @param {string} [bookmark=null] the initial reference to some previous transaction. Value is optional and
     * absence indicates that that the bookmark does not exist or is unknown.
     * @return {Session} new session.
     */

  }, {
    key: 'session',
    value: function session(mode, bookmark) {
      var sessionMode = Driver._validateSessionMode(mode);
      return this._createSession(sessionMode, this._connectionProvider, bookmark, this._config);
    }
  }, {
    key: '_createConnectionProvider',


    //Extension point
    value: function _createConnectionProvider(address, connectionPool, driverOnErrorCallback) {
      return new _connectionProviders.DirectConnectionProvider(address, connectionPool, driverOnErrorCallback);
    }

    //Extension point

  }, {
    key: '_createSession',
    value: function _createSession(mode, connectionProvider, bookmark, config) {
      return new _session2.default(mode, connectionProvider, bookmark, config);
    }
  }, {
    key: '_driverOnErrorCallback',
    value: function _driverOnErrorCallback(error) {
      var userDefinedOnErrorCallback = this.onError;
      if (userDefinedOnErrorCallback && error.code === _error.SERVICE_UNAVAILABLE) {
        userDefinedOnErrorCallback(error);
      } else {
        // we don't need to tell the driver about this error
      }
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
  }, {
    key: '_validateSessionMode',
    value: function _validateSessionMode(rawMode) {
      var mode = rawMode || WRITE;
      if (mode !== READ && mode !== WRITE) {
        throw (0, _error.newError)('Illegal session mode ' + mode);
      }
      return mode;
    }
  }]);
  return Driver;
}();

/** Internal stream observer used for connection state */


var _ConnectionStreamObserver = function (_StreamObserver) {
  (0, _inherits3.default)(_ConnectionStreamObserver, _StreamObserver);

  function _ConnectionStreamObserver(driver, conn) {
    (0, _classCallCheck3.default)(this, _ConnectionStreamObserver);

    var _this = (0, _possibleConstructorReturn3.default)(this, (_ConnectionStreamObserver.__proto__ || (0, _getPrototypeOf2.default)(_ConnectionStreamObserver)).call(this));

    _this._driver = driver;
    _this._conn = conn;
    _this._hasFailed = false;
    return _this;
  }

  (0, _createClass3.default)(_ConnectionStreamObserver, [{
    key: 'onError',
    value: function onError(error) {
      if (!this._hasFailed) {
        (0, _get3.default)(_ConnectionStreamObserver.prototype.__proto__ || (0, _getPrototypeOf2.default)(_ConnectionStreamObserver.prototype), 'onError', this).call(this, error);
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
      if (this._conn && message && message.server) {
        this._conn.setServerVersion(message.server);
      }
    }
  }]);
  return _ConnectionStreamObserver;
}(_streamObserver2.default);

exports.Driver = Driver;
exports.READ = READ;
exports.WRITE = WRITE;
exports.default = Driver;
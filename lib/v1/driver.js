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

var _get = function get(_x5, _x6, _x7) { var _again = true; _function: while (_again) { var object = _x5, property = _x6, receiver = _x7; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x5 = parent; _x6 = property; _x7 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _session = require('./session');

var _session2 = _interopRequireDefault(_session);

var _internalPool = require('./internal/pool');

var _internalConnector = require("./internal/connector");

var _internalStreamObserver = require('./internal/stream-observer');

var _internalStreamObserver2 = _interopRequireDefault(_internalStreamObserver);

var _version = require('../version');

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

var Driver = (function () {
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
    var userAgent = arguments.length <= 1 || arguments[1] === undefined ? 'neo4j-javascript/0.0' : arguments[1];
    var token = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];
    var config = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];

    _classCallCheck(this, Driver);

    this._url = url;
    this._userAgent = userAgent;
    this._openSessions = {};
    this._sessionIdGenerator = 0;
    this._token = token;
    this._config = config;
    this._pool = new _internalPool.Pool(this._createConnection.bind(this), this._destroyConnection.bind(this), this._validateConnection.bind(this), config.connectionPoolSize);
  }

  /** Internal stream observer used for connection state */

  /**
   * Create a new connection instance.
   * @return {Connection} new connector-api session instance, a low level session API.
   * @access private
   */

  _createClass(Driver, [{
    key: '_createConnection',
    value: function _createConnection(release) {
      var sessionId = this._sessionIdGenerator++;
      var streamObserver = new _ConnectionStreamObserver(this);
      var conn = (0, _internalConnector.connect)(this._url, this._config);
      conn.initialize(this._userAgent, this._token, streamObserver);
      conn._id = sessionId;
      conn._release = function () {
        return release(conn);
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
    key: '_validateConnection',
    value: function _validateConnection(conn) {
      return conn.isOpen();
    }

    /**
     * Dispose of a live session, closing any associated resources.
     * @return {Session} new session.
     * @access private
     */
  }, {
    key: '_destroyConnection',
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
     * @return {Session} new session.
     */
  }, {
    key: 'session',
    value: function session() {
      var conn = this._pool.acquire();
      return new _session2['default'](conn, function (cb) {
        // This gets called on Session#close(), and is where we return
        // the pooled 'connection' instance.

        // We don't pool Session instances, to avoid users using the Session
        // after they've called close. The `Session` object is just a thin
        // wrapper around Connection anyway, so it makes little difference.

        // Queue up a 'reset', to ensure the next user gets a clean
        // session to work with.
        conn.reset();
        conn.sync();

        // Return connection to the pool
        conn._release();

        // Call user callback
        if (cb) {
          cb();
        }
      });
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
      }
    }
  }]);

  return Driver;
})();

var _ConnectionStreamObserver = (function (_StreamObserver) {
  _inherits(_ConnectionStreamObserver, _StreamObserver);

  function _ConnectionStreamObserver(driver) {
    _classCallCheck(this, _ConnectionStreamObserver);

    _get(Object.getPrototypeOf(_ConnectionStreamObserver.prototype), 'constructor', this).call(this);
    this._driver = driver;
    this._hasFailed = false;
  }

  _createClass(_ConnectionStreamObserver, [{
    key: 'onError',
    value: function onError(error) {
      if (!this._hasFailed) {
        _get(Object.getPrototypeOf(_ConnectionStreamObserver.prototype), 'onError', this).call(this, error);
        if (this._driver.onError) {
          this._driver.onError(error);
        }
        this._hasFailed = true;
      }
    }
  }]);

  return _ConnectionStreamObserver;
})(_internalStreamObserver2['default']);

var USER_AGENT = "neo4j-javascript/" + _version.VERSION;

/**
 * Construct a new Neo4j Driver. This is your main entry point for this
 * library.
 *
 * ## Configuration
 *
 * This function optionally takes a configuration argument. Available configuration
 * options are as follows:
 *
 *     {
 *       // Encryption level: one of ENCRYPTION_ON, ENCRYPTION_OFF or ENCRYPTION_NON_LOCAL.
 *       // ENCRYPTION_NON_LOCAL is on by default in modern NodeJS installs,
 *       // but off by default in the Web Bundle and old (<=1.0.0) NodeJS installs
 *       // due to technical limitations on those platforms.
 *       encrypted: ENCRYPTION_ON|ENCRYPTION_OFF|ENCRYPTION_NON_LOCAL
 *
 *       // Trust strategy to use if encryption is enabled. There is no mode to disable
 *       // trust other than disabling encryption altogether. The reason for
 *       // this is that if you don't know who you are talking to, it is easy for an
 *       // attacker to hijack your encrypted connection, rendering encryption pointless.
 *       //
 *       // TRUST_ON_FIRST_USE is the default for modern NodeJS deployments, and works
 *       // similarly to how `ssl` works - the first time we connect to a new host,
 *       // we remember the certificate they use. If the certificate ever changes, we
 *       // assume it is an attempt to hijack the connection and require manual intervention.
 *       // This means that by default, connections "just work" while still giving you
 *       // good encrypted protection.
 *       //
 *       // TRUST_SIGNED_CERTIFICATES is the classic approach to trust verification -
 *       // whenever we establish an encrypted connection, we ensure the host is using
 *       // an encryption certificate that is in, or is signed by, a certificate listed
 *       // as trusted. In the web bundle, this list of trusted certificates is maintained
 *       // by the web browser. In NodeJS, you configure the list with the next config option.
 *       trust: "TRUST_ON_FIRST_USE" | "TRUST_SIGNED_CERTIFICATES",
 *
 *       // List of one or more paths to trusted encryption certificates. This only
 *       // works in the NodeJS bundle, and only matters if you use "TRUST_SIGNED_CERTIFICATES".
 *       // The certificate files should be in regular X.509 PEM format.
 *       // For instance, ['./trusted.pem']
 *       trustedCertificates: [],
 *
 *       // Path to a file where the driver saves hosts it has seen in the past, this is
 *       // very similar to the ssl tool's known_hosts file. Each time we connect to a
 *       // new host, a hash of their certificate is stored along with the domain name and
 *       // port, and this is then used to verify the host certificate does not change.
 *       // This setting has no effect unless TRUST_ON_FIRST_USE is enabled.
 *       knownHosts:"~/.neo4j/known_hosts",
 *     }
 *
 * @param {string} url The URL for the Neo4j database, for instance "bolt://localhost"
 * @param {Map<String,String>} authToken Authentication credentials. See {@link auth} for helpers.
 * @param {Object} config Configuration object. See the configuration section above for details.
 * @returns {Driver}
 */
function driver(url, authToken) {
  var config = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

  return new Driver(url, USER_AGENT, authToken, config);
}

exports.Driver = Driver;
exports.driver = driver;
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

var _net = require('net');

var _net2 = _interopRequireDefault(_net);

var _tls = require('tls');

var _tls2 = _interopRequireDefault(_tls);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _os = require('os');

var _buf = require('./buf');

var _error = require('./../error');

var _CONNECTION_IDGEN = 0;

function userHome() {
  // For some reason, Browserify chokes on shimming `process`. This code
  // will never get executed on the browser anyway, to just hack around it
  var getOutOfHereBrowserifyYoureDrunk = require;
  var process = getOutOfHereBrowserifyYoureDrunk('process');

  return process.env[process.platform == 'win32' ? 'USERPROFILE' : 'HOME'];
}

function mkFullPath(pathToCreate) {
  try {
    _fs2['default'].mkdirSync(pathToCreate);
  } catch (e) {
    if (e.code === 'ENOENT') {
      // Create parent dir
      mkFullPath(_path2['default'].dirname(pathToCreate));
      // And now try again
      mkFullPath(pathToCreate);
      return;
    }
    if (e.code === 'EEXIST') {
      return;
    }
    throw e;
  }
}

function loadFingerprint(serverId, knownHostsPath, cb) {
  try {
    _fs2['default'].accessSync(knownHostsPath);
  } catch (e) {
    return cb(null);
  }
  var found = false;
  require('readline').createInterface({
    input: _fs2['default'].createReadStream(knownHostsPath)
  }).on('line', function (line) {
    if (!found && line.startsWith(serverId)) {
      found = true;
      cb(line.split(" ")[1]);
    }
  }).on('close', function () {
    if (!found) {
      cb(null);
    }
  });
}

var _lockFingerprintFromAppending = {};
function storeFingerprint(serverId, knownHostsPath, fingerprint, cb) {
  // we check if the serverId has been appended
  if (!!_lockFingerprintFromAppending[serverId]) {
    // if it has, we ignore it
    return cb(null);
  }

  // we make the line as appended
  // ( 1 is more efficient to store than true because true is an oddball )
  _lockFingerprintFromAppending[serverId] = 1;

  // If file doesn't exist, create full path to it
  try {
    _fs2['default'].accessSync(knownHostsPath);
  } catch (_) {
    mkFullPath(_path2['default'].dirname(knownHostsPath));
  }

  _fs2['default'].appendFile(knownHostsPath, serverId + " " + fingerprint + _os.EOL, "utf8", function (err) {
    delete _lockFingerprintFromAppending[serverId];
    if (err) {
      console.log(err);
    }
    return cb(err);
  });
}

var TrustStrategy = {
  TRUST_SIGNED_CERTIFICATES: function TRUST_SIGNED_CERTIFICATES(opts, onSuccess, onFailure) {
    if (!opts.trustedCertificates || opts.trustedCertificates.length == 0) {
      onFailure((0, _error.newError)("You are using TRUST_SIGNED_CERTIFICATES as the method " + "to verify trust for encrypted  connections, but have not configured any " + "trustedCertificates. You  must specify the path to at least one trusted " + "X.509 certificate for this to work. Two other alternatives is to use " + "TRUST_ON_FIRST_USE or to disable encryption by setting encrypted=false " + "in your driver configuration."));
      return;
    }

    var tlsOpts = {
      ca: opts.trustedCertificates.map(_fs2['default'].readFileSync),
      // Because we manually check for this in the connect callback, to give
      // a more helpful error to the user
      rejectUnauthorized: false
    };

    var socket = _tls2['default'].connect(opts.port, opts.host, tlsOpts, function () {
      if (!socket.authorized) {
        onFailure((0, _error.newError)("Server certificate is not trusted. If you trust the database you are connecting to, add" + " the signing certificate, or the server certificate, to the list of certificates trusted by this driver" + " using `neo4j.v1.driver(.., { trustedCertificates:['path/to/certificate.crt']}). This " + " is a security measure to protect against man-in-the-middle attacks. If you are just trying " + " Neo4j out and are not concerned about encryption, simply disable it using `encrypted=false` in the driver" + " options."));
      } else {
        onSuccess();
      }
    });
    socket.on('error', onFailure);
    return socket;
  },
  TRUST_ON_FIRST_USE: function TRUST_ON_FIRST_USE(opts, onSuccess, onFailure) {
    var tlsOpts = {
      // Because we manually verify the certificate against known_hosts
      rejectUnauthorized: false
    };

    var socket = _tls2['default'].connect(opts.port, opts.host, tlsOpts, function () {
      var serverCert = socket.getPeerCertificate( /*raw=*/true);

      if (!serverCert.raw) {
        // If `raw` is not available, we're on an old version of NodeJS, and
        // the raw cert cannot be accessed (or, at least I couldn't find a way to)
        // therefore, we can't generate a SHA512 fingerprint, meaning we can't
        // do TOFU, and the safe approach is to fail.
        onFailure((0, _error.newError)("You are using a version of NodeJS that does not " + "support trust-on-first use encryption. You can either upgrade NodeJS to " + "a newer version, use `trust:TRUST_SIGNED_CERTIFICATES` in your driver " + "config instead, or disable encryption using `encrypted:false`."));
        return;
      }

      var serverFingerprint = require('crypto').createHash('sha512').update(serverCert.raw).digest("hex");
      var knownHostsPath = opts.knownHosts || _path2['default'].join(userHome(), ".neo4j", "known_hosts");
      var serverId = opts.host + ":" + opts.port;

      loadFingerprint(serverId, knownHostsPath, function (knownFingerprint) {
        if (knownFingerprint === serverFingerprint) {
          onSuccess();
        } else if (knownFingerprint == null) {
          storeFingerprint(serverId, knownHostsPath, serverFingerprint, function (err) {
            if (err) {
              return onFailure(err);
            }
            return onSuccess();
          });
        } else {
          onFailure((0, _error.newError)("Database encryption certificate has changed, and no longer " + "matches the certificate stored for " + serverId + " in `" + knownHostsPath + "`. As a security precaution, this driver will not automatically trust the new " + "certificate, because doing so would allow an attacker to pretend to be the Neo4j " + "instance we want to connect to. The certificate provided by the server looks like: " + serverCert + ". If you trust that this certificate is valid, simply remove the line " + "starting with " + serverId + " in `" + knownHostsPath + "`, and the driver will " + "update the file with the new certificate. You can configure which file the driver " + "should use to store this information by setting `knownHosts` to another path in " + "your driver configuration - and you can disable encryption there as well using " + "`encrypted:false`."));
        }
      });
    });
    socket.on('error', onFailure);
    return socket;
  }
};

function connect(opts, onSuccess) {
  var onFailure = arguments.length <= 2 || arguments[2] === undefined ? function () {
    return null;
  } : arguments[2];

  if (opts.encrypted === false) {
    var conn = _net2['default'].connect(opts.port, opts.host, onSuccess);
    conn.on('error', onFailure);
    return conn;
  } else if (TrustStrategy[opts.trust]) {
    return TrustStrategy[opts.trust](opts, onSuccess, onFailure);
  } else {
    onFailure((0, _error.newError)("Unknown trust strategy: " + opts.trust + ". Please use either " + "trust:'TRUST_SIGNED_CERTIFICATES' or trust:'TRUST_ON_FIRST_USE' in your driver " + "configuration. Alternatively, you can disable encryption by setting " + "`encrypted:false`. There is no mechanism to use encryption without trust verification, " + "because this incurs the overhead of encryption without improving security. If " + "the driver does not verify that the peer it is connected to is really Neo4j, it " + "is very easy for an attacker to bypass the encryption by pretending to be Neo4j."));
  }
}

/**
 * In a Node.js environment the 'net' module is used
 * as transport.
 * @access private
 */

var NodeChannel = (function () {

  /**
   * Create new instance
   * @param {Object} opts - Options object
   * @param {string} opts.host - The host, including protocol to connect to.
   * @param {Integer} opts.port - The port to use.
   */

  function NodeChannel(opts) {
    _classCallCheck(this, NodeChannel);

    var self = this;

    this.id = _CONNECTION_IDGEN++;
    this.available = true;
    this._pending = [];
    this._open = true;
    this._error = null;
    this._handleConnectionError = this._handleConnectionError.bind(this);

    this._conn = connect(opts, function () {
      if (!self._open) {
        return;
      }

      self._conn.on('data', function (buffer) {
        if (self.onmessage) {
          self.onmessage(new _buf.NodeBuffer(buffer));
        }
      });

      self._conn.on('error', self._handleConnectionError);

      // Drain all pending messages
      var pending = self._pending;
      self._pending = null;
      for (var i = 0; i < pending.length; i++) {
        self.write(pending[i]);
      }
    }, this._handleConnectionError);
  }

  _createClass(NodeChannel, [{
    key: '_handleConnectionError',
    value: function _handleConnectionError(err) {
      this._error = err;
      if (this.onerror) {
        this.onerror(err);
      }
    }

    /**
     * Write the passed in buffer to connection
     * @param {NodeBuffer} buffer - Buffer to write
     */
  }, {
    key: 'write',
    value: function write(buffer) {
      // If there is a pending queue, push this on that queue. This means
      // we are not yet connected, so we queue things locally.
      if (this._pending !== null) {
        this._pending.push(buffer);
      } else if (buffer instanceof _buf.NodeBuffer) {
        // console.log( "[Conn#"+this.id+"] SEND: ", buffer.toString() );
        this._conn.write(buffer._buffer);
      } else {
        throw (0, _error.newError)("Don't know how to write: " + buffer);
      }
    }

    /**
     * Close the connection
     * @param {function} cb - Function to call on close.
     */
  }, {
    key: 'close',
    value: function close() {
      var cb = arguments.length <= 0 || arguments[0] === undefined ? function () {
        return null;
      } : arguments[0];

      this._open = false;
      if (this._conn) {
        this._conn.end();
        this._conn.on('end', cb);
      } else {
        cb();
      }
    }
  }]);

  return NodeChannel;
})();

var _nodeChannelModule = { channel: NodeChannel, available: true };

try {
  // Only define this module if 'net' is available
  require.resolve("net");
} catch (e) {
  _nodeChannelModule = { available: false };
}

exports['default'] = _nodeChannelModule;
module.exports = exports['default'];
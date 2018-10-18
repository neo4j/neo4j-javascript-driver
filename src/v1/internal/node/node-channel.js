/**
 * Copyright (c) 2002-2018 "Neo4j,"
 * Neo4j Sweden AB [http://neo4j.com]
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
import net from 'net';
import tls from 'tls';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import crypto from 'crypto';
import {EOL} from 'os';
import NodeBuffer from './node-buf';
import {ENCRYPTION_OFF, ENCRYPTION_ON, isEmptyObjectOrNull} from '../util';
import {newError} from '../../error';

let _CONNECTION_IDGEN = 0;

function userHome() {
  // For some reason, Browserify chokes on shimming `process`. This code
  // will never get executed on the browser anyway, to just hack around it
  let getOutOfHereBrowserifyYoureDrunk = require;
  let process = getOutOfHereBrowserifyYoureDrunk('process');

  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

function mkFullPath(pathToCreate) {
  try {
    fs.mkdirSync( pathToCreate );
  } catch (e) {
    if(e.code === 'ENOENT') {
      // Create parent dir
      mkFullPath(path.dirname( pathToCreate ));
      // And now try again
      mkFullPath( pathToCreate );
      return;
    }
    if (e.code === 'EEXIST') {
      return;
    }
    throw e;
  }
}

function loadFingerprint( serverId, knownHostsPath, cb ) {
  try {
    fs.accessSync( knownHostsPath );
  } catch(e) {
    return cb(null)
  }
  let found = false;
  readline.createInterface({
    input: fs.createReadStream(knownHostsPath)
  }).on('line', (line)  => {
    if( !found && line.startsWith( serverId )) {
      found = true;
      cb( line.split(" ")[1] );
    }
  }).on('close', () => {
    if(!found) {
      cb(null);
    }
  });
}

const _lockFingerprintFromAppending = {};
function storeFingerprint( serverId, knownHostsPath, fingerprint, cb ) {
  // we check if the serverId has been appended
  if(!!_lockFingerprintFromAppending[serverId]){
    // if it has, we ignore it
    return cb(null);
  }

  // we make the line as appended
  // ( 1 is more efficient to store than true because true is an oddball )
  _lockFingerprintFromAppending[serverId] = 1;

  // If file doesn't exist, create full path to it
  try {
    fs.accessSync(knownHostsPath);
  } catch (_) {
    mkFullPath(path.dirname(knownHostsPath));
  }

  fs.appendFile(knownHostsPath, serverId + " " + fingerprint + EOL, "utf8", (err) => {
    delete _lockFingerprintFromAppending[serverId];
    if (err) {
      console.log(err);
    }
    return cb(err);
  });
}

const TrustStrategy = {
  /**
   * @deprecated Since version 1.0. Will be deleted in a future version. {@link #TRUST_CUSTOM_CA_SIGNED_CERTIFICATES}.
   */
  TRUST_SIGNED_CERTIFICATES: function( config, onSuccess, onFailure ) {
    console.warn('`TRUST_SIGNED_CERTIFICATES` has been deprecated as option and will be removed in a future version of ' +
      "the driver. Please use `TRUST_CUSTOM_CA_SIGNED_CERTIFICATES` instead.");
    return TrustStrategy.TRUST_CUSTOM_CA_SIGNED_CERTIFICATES(config, onSuccess, onFailure);
  },
  TRUST_CUSTOM_CA_SIGNED_CERTIFICATES : function( config, onSuccess, onFailure ) {
    if( !config.trustedCertificates || config.trustedCertificates.length === 0 ) {
      onFailure(newError("You are using TRUST_CUSTOM_CA_SIGNED_CERTIFICATES as the method " +
        "to verify trust for encrypted  connections, but have not configured any " +
        "trustedCertificates. You  must specify the path to at least one trusted " +
        "X.509 certificate for this to work. Two other alternatives is to use " +
        "TRUST_ALL_CERTIFICATES or to disable encryption by setting encrypted=\"" + ENCRYPTION_OFF + "\"" +
        "in your driver configuration."));
      return;
    }

    const tlsOpts = newTlsOptions(config.url.host, config.trustedCertificates.map((f) => fs.readFileSync(f)));
    const socket = tls.connect(config.url.port, config.url.host, tlsOpts, function () {
      if (!socket.authorized) {
        onFailure(newError("Server certificate is not trusted. If you trust the database you are connecting to, add" +
          " the signing certificate, or the server certificate, to the list of certificates trusted by this driver" +
          " using `neo4j.v1.driver(.., { trustedCertificates:['path/to/certificate.crt']}). This " +
          " is a security measure to protect against man-in-the-middle attacks. If you are just trying " +
          " Neo4j out and are not concerned about encryption, simply disable it using `encrypted=\"" + ENCRYPTION_OFF + "\"`" +
          " in the driver options. Socket responded with: " + socket.authorizationError));
      } else {
        onSuccess();
      }
    });
    socket.on('error', onFailure);
    return configureSocket(socket);
  },
  TRUST_SYSTEM_CA_SIGNED_CERTIFICATES : function( config, onSuccess, onFailure ) {
    const tlsOpts = newTlsOptions(config.url.host);
    const socket = tls.connect(config.url.port, config.url.host, tlsOpts, function () {
      if (!socket.authorized) {
        onFailure(newError("Server certificate is not trusted. If you trust the database you are connecting to, use " +
          "TRUST_CUSTOM_CA_SIGNED_CERTIFICATES and add" +
          " the signing certificate, or the server certificate, to the list of certificates trusted by this driver" +
          " using `neo4j.v1.driver(.., { trustedCertificates:['path/to/certificate.crt']}). This " +
          " is a security measure to protect against man-in-the-middle attacks. If you are just trying " +
          " Neo4j out and are not concerned about encryption, simply disable it using `encrypted=\"" + ENCRYPTION_OFF + "\"`" +
          " in the driver options. Socket responded with: " + socket.authorizationError));
      } else {
        onSuccess();
      }
    });
    socket.on('error', onFailure);
    return configureSocket(socket);
  },
  /**
   * @deprecated in 1.1 in favour of {@link #TRUST_ALL_CERTIFICATES}. Will be deleted in a future version.
   */
  TRUST_ON_FIRST_USE : function( config, onSuccess, onFailure ) {
    console.warn('`TRUST_ON_FIRST_USE` has been deprecated as option and will be removed in a future version of ' +
          "the driver. Please use `TRUST_ALL_CERTIFICATES` instead.");

    const tlsOpts = newTlsOptions(config.url.host);
    const socket = tls.connect(config.url.port, config.url.host, tlsOpts, function () {
      const serverCert = socket.getPeerCertificate(/*raw=*/true);

      if( !serverCert.raw ) {
        // If `raw` is not available, we're on an old version of NodeJS, and
        // the raw cert cannot be accessed (or, at least I couldn't find a way to)
        // therefore, we can't generate a SHA512 fingerprint, meaning we can't
        // do TOFU, and the safe approach is to fail.
        onFailure(newError("You are using a version of NodeJS that does not " +
          "support trust-on-first use encryption. You can either upgrade NodeJS to " +
          "a newer version, use `trust:TRUST_CUSTOM_CA_SIGNED_CERTIFICATES` in your driver " +
          "config instead, or disable encryption using `encrypted:\"" + ENCRYPTION_OFF+ "\"`."));
        return;
      }

      const serverFingerprint = crypto.createHash('sha512').update(serverCert.raw).digest('hex');
      const knownHostsPath = config.knownHostsPath || path.join(userHome(), ".neo4j", "known_hosts");
      const serverId = config.url.hostAndPort;

      loadFingerprint(serverId, knownHostsPath, (knownFingerprint) => {
        if( knownFingerprint === serverFingerprint ) {
          onSuccess();
        } else if( knownFingerprint == null ) {
          storeFingerprint( serverId, knownHostsPath, serverFingerprint, (err) => {
            if (err) {
              return onFailure(err);
            }
            return onSuccess();
          });
        } else {
          onFailure(newError("Database encryption certificate has changed, and no longer " +
            "matches the certificate stored for " + serverId + " in `" + knownHostsPath +
            "`. As a security precaution, this driver will not automatically trust the new " +
            "certificate, because doing so would allow an attacker to pretend to be the Neo4j " +
            "instance we want to connect to. The certificate provided by the server looks like: " +
            serverCert + ". If you trust that this certificate is valid, simply remove the line " +
            "starting with " + serverId + " in `" + knownHostsPath + "`, and the driver will " +
            "update the file with the new certificate. You can configure which file the driver " +
            "should use to store this information by setting `knownHosts` to another path in " +
            "your driver configuration - and you can disable encryption there as well using " +
            "`encrypted:\"" + ENCRYPTION_OFF + "\"`."))
        }
      });
    });
    socket.on('error', onFailure);
    return configureSocket(socket);
  },

  TRUST_ALL_CERTIFICATES: function (config, onSuccess, onFailure) {
    const tlsOpts = newTlsOptions(config.url.host);
    const socket = tls.connect(config.url.port, config.url.host, tlsOpts, function () {
      const certificate = socket.getPeerCertificate();
      if (isEmptyObjectOrNull(certificate)) {
        onFailure(newError("Secure connection was successful but server did not return any valid " +
            "certificates. Such connection can not be trusted. If you are just trying " +
            " Neo4j out and are not concerned about encryption, simply disable it using " +
            "`encrypted=\"" + ENCRYPTION_OFF + "\"` in the driver options. " +
            "Socket responded with: " + socket.authorizationError));
      } else {
        onSuccess();
      }
    });
    socket.on('error', onFailure);
    return configureSocket(socket);
  }
};

/**
 * Connect using node socket.
 * @param {ChannelConfig} config - configuration of this channel.
 * @param {function} onSuccess - callback to execute on connection success.
 * @param {function} onFailure - callback to execute on connection failure.
 * @return {*} socket connection.
 */
function connect( config, onSuccess, onFailure=(()=>null) ) {
  const trustStrategy = trustStrategyName(config);
  if (!isEncrypted(config)) {
    const socket = net.connect(config.url.port, config.url.host, onSuccess);
    socket.on('error', onFailure);
    return configureSocket(socket);
  } else if (TrustStrategy[trustStrategy]) {
    return TrustStrategy[trustStrategy](config, onSuccess, onFailure);
  } else {
    onFailure(newError("Unknown trust strategy: " + config.trust + ". Please use either " +
      "trust:'TRUST_CUSTOM_CA_SIGNED_CERTIFICATES' or trust:'TRUST_ALL_CERTIFICATES' in your driver " +
      "configuration. Alternatively, you can disable encryption by setting " +
      "`encrypted:\"" + ENCRYPTION_OFF + "\"`. There is no mechanism to use encryption without trust verification, " +
      "because this incurs the overhead of encryption without improving security. If " +
      "the driver does not verify that the peer it is connected to is really Neo4j, it " +
      "is very easy for an attacker to bypass the encryption by pretending to be Neo4j."));
  }
}

function isEncrypted(config) {
  const encryptionNotConfigured = config.encrypted == null || config.encrypted === undefined;
  if (encryptionNotConfigured) {
    // default to using encryption if trust-all-certificates is available
    return true;
  }
  return config.encrypted === true || config.encrypted === ENCRYPTION_ON;
}

function trustStrategyName(config) {
  if (config.trust) {
    return config.trust;
  }
  return 'TRUST_ALL_CERTIFICATES';
}

/**
 * Create a new configuration options object for the {@code tls.connect()} call.
 * @param {string} hostname the target hostname.
 * @param {string|undefined} ca an optional CA.
 * @return {object} a new options object.
 */
function newTlsOptions(hostname, ca = undefined) {
  return {
    rejectUnauthorized: false, // we manually check for this in the connect callback, to give a more helpful error to the user
    servername: hostname, // server name for the SNI (Server Name Indication) TLS extension
    ca: ca, // optional CA useful for TRUST_CUSTOM_CA_SIGNED_CERTIFICATES trust mode
  };
}

/**
 * Update socket options for the newly created socket. Accepts either `net.Socket` or its subclass `tls.TLSSocket`.
 * @param {net.Socket} socket the socket to configure.
 * @return {net.Socket} the given socket.
 */
function configureSocket(socket) {
  socket.setKeepAlive(true);
  return socket;
}

/**
 * In a Node.js environment the 'net' module is used
 * as transport.
 * @access private
 */
export default class NodeChannel {

  /**
   * Create new instance
   * @param {ChannelConfig} config - configuration for this channel.
   */
  constructor (config) {
    let self = this;

    this.id = _CONNECTION_IDGEN++;
    this._pending = [];
    this._open = true;
    this._error = null;
    this._handleConnectionError = this._handleConnectionError.bind(this);
    this._handleConnectionTerminated = this._handleConnectionTerminated.bind(this);
    this._connectionErrorCode = config.connectionErrorCode;

    this._conn = connect(config, () => {
      if(!self._open) {
        return;
      }

      self._conn.on('data', ( buffer ) => {
        if( self.onmessage ) {
          self.onmessage( new NodeBuffer( buffer ) );
        }
      });

      self._conn.on('error', self._handleConnectionError);
      self._conn.on('end', self._handleConnectionTerminated);

      // Drain all pending messages
      let pending = self._pending;
      self._pending = null;
      for (let i = 0; i < pending.length; i++) {
        self.write( pending[i] );
      }
    }, this._handleConnectionError);

    this._setupConnectionTimeout(config, this._conn);
  }

  _handleConnectionError( err ) {
    let msg = err.message || 'Failed to connect to server';
    this._error = newError(msg, this._connectionErrorCode);
    if( this.onerror ) {
      this.onerror(this._error);
    }
  }

  _handleConnectionTerminated() {
      this._error = newError('Connection was closed by server', this._connectionErrorCode);
      if( this.onerror ) {
        this.onerror(this._error);
      }
  }

  /**
   * Setup connection timeout on the socket, if configured.
   * @param {ChannelConfig} config - configuration of this channel.
   * @param {object} socket - `net.Socket` or `tls.TLSSocket` object.
   * @private
   */
  _setupConnectionTimeout(config, socket) {
    const timeout = config.connectionTimeout;
    if (timeout) {
      socket.on('connect', () => {
        // connected - clear connection timeout
        socket.setTimeout(0);
      });

      socket.on('timeout', () => {
        // timeout fired - not connected within configured time. cancel timeout and destroy socket
        socket.setTimeout(0);
        socket.destroy(newError(`Failed to establish connection in ${timeout}ms`, config.connectionErrorCode));
      });

      socket.setTimeout(timeout);
    }
  }

  /**
   * Write the passed in buffer to connection
   * @param {NodeBuffer} buffer - Buffer to write
   */
  write ( buffer ) {
    // If there is a pending queue, push this on that queue. This means
    // we are not yet connected, so we queue things locally.
    if( this._pending !== null ) {
      this._pending.push( buffer );
    } else if( buffer instanceof NodeBuffer ) {
      this._conn.write( buffer._buffer );
    } else {
      throw newError( "Don't know how to write: " + buffer );
    }
  }

  /**
   * Close the connection
   * @param {function} cb - Function to call on close.
   */
  close(cb = (() => null)) {
    this._open = false;
    if( this._conn ) {
      this._conn.end();
      this._conn.removeListener('end', this._handleConnectionTerminated);
      this._conn.on('end', cb);
    } else {
      cb();
    }
  }
}

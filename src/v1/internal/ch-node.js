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

import net from 'net';
import tls from 'tls';
import fs from 'fs';
import path from 'path';
import {EOL} from 'os';
import {NodeBuffer} from './buf';
import {newError} from './../error';

let _CONNECTION_IDGEN = 0;

function userHome() {
  // For some reason, Browserify chokes on shimming `process`. This code
  // will never get executed on the browser anyway, to just hack around it
  let getOutOfHereBrowserifyYoureDrunk = require;
  let process = getOutOfHereBrowserifyYoureDrunk('process');

  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

function loadFingerprint( serverId, knownHostsPath, cb ) {
  if( !fs.existsSync( knownHostsPath )) {
    cb(null);
    return;
  }
  let found = false;
  require('readline').createInterface({
    input: fs.createReadStream(knownHostsPath)
  }).on('line', (line)  => {
    if( line.startsWith( serverId )) {
      found = true;
      cb( line.split(" ")[1] );
    }
  }).on('close', () => {
    if(!found) {
      cb(null);
    }
  });
}

function storeFingerprint(serverId, knownHostsPath, fingerprint) {
  fs.appendFile(knownHostsPath, serverId + " " + fingerprint + EOL, "utf8", (err) => {
    if (err) {
      console.log(err);
    }
  });
}

const TrustStrategy = {
  TRUST_SIGNED_CERTIFICATES : function( opts, onSuccess, onFailure ) {
    if( !opts.trustedCertificates || opts.trustedCertificates.length == 0 ) {
      onFailure(newError("You are using TRUST_SIGNED_CERTIFICATES as the method " +
        "to verify trust for encrypted  connections, but have not configured any " +
        "trustedCertificates. You  must specify the path to at least one trusted " +
        "X.509 certificate for this to work. Two other alternatives is to use " +
        "TRUST_ON_FIRST_USE or to disable encryption by setting encrypted=false " +
        "in your driver configuration."));
      return;
    }

    let tlsOpts = {
      ca: opts.trustedCertificates.map(fs.readFileSync),
      // Because we manually check for this in the connect callback, to give
      // a more helpful error to the user
      rejectUnauthorized: false
    };

    let socket = tls.connect(opts.port, opts.host, tlsOpts, function () {
      if (!socket.authorized) {
        onFailure(newError("Server certificate is not trusted. If you trust the database you are connecting to, add" +
          " the signing certificate, or the server certificate, to the list of certificates trusted by this driver" +
          " using `neo4j.v1.driver(.., { trustedCertificates:['path/to/certificate.crt']}). This " +
          " is a security measure to protect against man-in-the-middle attacks. If you are just trying " +
          " Neo4j out and are not concerned about encryption, simply disable it using `encrypted=false` in the driver" +
          " options."));
      } else {
        onSuccess();
      }
    });
    socket.on('error', onFailure);
    return socket;
  },
  TRUST_ON_FIRST_USE : function( opts, onSuccess, onFailure ) {
    let tlsOpts = {
      // Because we manually verify the certificate against known_hosts
      rejectUnauthorized: false
    };

    let socket = tls.connect(opts.port, opts.host, tlsOpts, function () {
      var serverCert = socket.getPeerCertificate(/*raw=*/true);

      if( !serverCert.raw ) {
        // If `raw` is not available, we're on an old version of NodeJS, and
        // the raw cert cannot be accessed (or, at least I couldn't find a way to)
        // therefore, we can't generate a SHA512 fingerprint, meaning we can't
        // do TOFU, and the safe approach is to fail.
        onFailure(newError("You are using a version of NodeJS that does not " +
          "support trust-on-first use encryption. You can either upgrade NodeJS to " +
          "a newer version, use `trust:TRUST_SIGNED_CERTIFICATES` in your driver " +
          "config instead, or disable encryption using `encrypted:false`."));
        return;
      }

      var serverFingerprint = require('crypto').createHash('sha512').update(serverCert.raw).digest("hex");
      let knownHostsPath = opts.knownHosts || path.join(userHome(), ".neo4j", "known_hosts");
      let serverId = opts.host + ":" + opts.port;

      loadFingerprint(serverId, knownHostsPath, (knownFingerprint) => {
        if( knownFingerprint === serverFingerprint ) {
          onSuccess();
        } else if( knownFingerprint == null ) {
          storeFingerprint( serverId, knownHostsPath, serverFingerprint );
          onSuccess();
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
            "`encrypted:false`."))
        }
      });
    });
    socket.on('error', onFailure);
    return socket;
  }
};

function connect( opts, onSuccess, onFailure=(()=>null) ) {
  if( opts.encrypted === false ) {
    var conn = net.connect(opts.port, opts.host, onSuccess);
    conn.on('error', onFailure);
    return conn;
  } else if( TrustStrategy[opts.trust]) {
    return TrustStrategy[opts.trust](opts, onSuccess, onFailure);
  } else {
    onFailure(newError("Unknown trust strategy: " + opts.trust + ". Please use either " +
      "trust:'TRUST_SIGNED_CERTIFICATES' or trust:'TRUST_ON_FIRST_USE' in your driver " +
      "configuration. Alternatively, you can disable encryption by setting " +
      "`encrypted:false`. There is no mechanism to use encryption without trust verification, " +
      "because this incurs the overhead of encryption without improving security. If " +
      "the driver does not verify that the peer it is connected to is really Neo4j, it " +
      "is very easy for an attacker to bypass the encryption by pretending to be Neo4j."));
  }
}

/**
 * In a Node.js environment the 'net' module is used
 * as transport.
 * @access private
 */
class NodeChannel {

  /**
   * Create new instance
   * @param {Object} opts - Options object
   * @param {string} opts.host - The host, including protocol to connect to.
   * @param {Integer} opts.port - The port to use.
   */
  constructor (opts) {
    let self = this;

    this.id = _CONNECTION_IDGEN++;
    this.available = true;
    this._pending = [];
    this._open = true;
    this._error = null;
    this._handleConnectionError = this._handleConnectionError.bind(this);

    this._conn = connect(opts, () => {
      if(!self._open) {
        return;
      }

      self._conn.on('data', ( buffer ) => {
        if( self.onmessage ) {
          self.onmessage( new NodeBuffer( buffer ) );
        }
      });

      self._conn.on('error', self._handleConnectionError);

      // Drain all pending messages
      let pending = self._pending;
      self._pending = null;
      for (let i = 0; i < pending.length; i++) {
        self.write( pending[i] );
      }
    }, this._handleConnectionError);
  }

  _handleConnectionError( err ) {
    this._error = err;
    if( this.onerror ) {
      this.onerror(err);
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
      // console.log( "[Conn#"+this.id+"] SEND: ", buffer.toString() );
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
      this._conn.on('end', cb);
    } else {
      cb();
    }
  }
}
let _nodeChannelModule = {channel: NodeChannel, available: true};

try {
  // Only define this module if 'net' is available
  require.resolve("net");
} catch(e) {
  _nodeChannelModule = { available : false };
}

export default _nodeChannelModule

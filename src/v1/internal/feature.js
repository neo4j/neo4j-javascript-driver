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

import {isEmptyObjectOrNull} from './util';

let _trustAllCertificatesAvailable = null;
let _dnsLookupAvailable = null;
let _nodeSocketAvailable = null;
let _nodeBufferAvailable = null;

export default class Feature {

  static trustAllCertificatesAvailable() {
    if (_trustAllCertificatesAvailable == null) {
      try {
        require.resolve('tls');
        const getPeerCertificateFunction = require('tls').TLSSocket.prototype.getPeerCertificate;
        _trustAllCertificatesAvailable = getPeerCertificateFunction && typeof getPeerCertificateFunction === 'function';
      } catch (e) {
        _trustAllCertificatesAvailable = false;
      }
    }
    return _trustAllCertificatesAvailable;
  }

  static dnsLookupAvailable() {
    if (_dnsLookupAvailable == null) {
      try {
        require.resolve('dns');
        const lookupFunction = require('dns').lookup;
        _dnsLookupAvailable = lookupFunction && typeof lookupFunction === 'function';
      } catch (e) {
        _dnsLookupAvailable = false;
      }
    }
    return _dnsLookupAvailable;
  }

  static nodeSocketAvailable() {
    if (_nodeSocketAvailable == null) {
      try {
        require.resolve('net');
        const netModule = require('net');
        _nodeSocketAvailable = !isEmptyObjectOrNull(netModule);
      } catch (e) {
        _nodeSocketAvailable = false;
      }
    }
    return _nodeSocketAvailable;
  }

  static nodeBufferAvailable() {
    if (_nodeBufferAvailable == null) {
      try {
        require.resolve('buffer');
        const bufferModule = require('buffer');
        _nodeBufferAvailable = !isEmptyObjectOrNull(bufferModule);
      } catch (e) {
        _nodeBufferAvailable = false;
      }
    }
    return _nodeBufferAvailable;
  }
}

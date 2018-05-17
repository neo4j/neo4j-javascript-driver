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

// Central place to detect feature support for the current platform,
// expand as needed.

const FEATURES = {
  trust_on_first_use : () => {
    try {
      // This is insane. We are verifying that we have a version of getPeerCertificate
      // that supports reading the whole certificate, eg this commit:
      // https://github.com/nodejs/node/commit/345c40b6
      const getPeerCertificateFunction = require('tls').TLSSocket.prototype.getPeerCertificate;
      const numberOfParameters = getPeerCertificateFunction.length;
      return numberOfParameters >= 1;
    } catch( e ) {
      return false;
    }
  },
  trust_all_certificates: () => {
    try {
      const getPeerCertificateFunction = require('tls').TLSSocket.prototype.getPeerCertificate;
      return true;
    } catch (e) {
      return false;
    }
  },
  dns_lookup: () => {
    try {
      const lookupFunction = require('dns').lookup;
      if (lookupFunction && typeof lookupFunction === 'function') {
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }
};

function hasFeature( name ) {
  return FEATURES[name] && FEATURES[name]();
}

export default hasFeature;

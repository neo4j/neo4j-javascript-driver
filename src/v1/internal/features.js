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

// Central place to detect feature support for the current platform,
// expand as needed.

const FEATURES = {
  trust_on_first_use : () => {
    try {
      // This is insane. We are verifying that we have a version of getPeerCertificate
      // that supports reading the whole certificate, eg this commit:
      // https://github.com/nodejs/node/commit/345c40b6
      // comment
      let desc = require('tls').TLSSocket.prototype.getPeerCertificate;
      return desc.length >= 1;
    } catch( e ) {
      return false;
    }
  }
};

function hasFeature( name ) {
  return FEATURES[name] && FEATURES[name]();
}

export default hasFeature;

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

import hasFeature from './features';
import {SERVICE_UNAVAILABLE} from '../error';

export default class ChannelConfig {

  constructor(host, port, driverConfig, connectionErrorCode) {
    this.host = host;
    this.port = port;
    this.encrypted = ChannelConfig._extractEncrypted(driverConfig);
    this.trust = ChannelConfig._extractTrust(driverConfig);
    this.trustedCertificates = ChannelConfig._extractTrustedCertificates(driverConfig);
    this.knownHostsPath = ChannelConfig._extractKnownHostsPath(driverConfig);
    this.connectionErrorCode = connectionErrorCode || SERVICE_UNAVAILABLE;
  }

  static _extractEncrypted(driverConfig) {
    // check if encryption was configured by the user, use explicit null check because we permit boolean value
    const encryptionConfigured = driverConfig.encrypted == null;
    // default to using encryption if trust-all-certificates is available
    return encryptionConfigured ? hasFeature('trust_all_certificates') : driverConfig.encrypted;
  }

  static _extractTrust(driverConfig) {
    if (driverConfig.trust) {
      return driverConfig.trust;
    }
    // default to using TRUST_ALL_CERTIFICATES if it is available
    return hasFeature('trust_all_certificates') ? 'TRUST_ALL_CERTIFICATES' : 'TRUST_CUSTOM_CA_SIGNED_CERTIFICATES';
  }

  static _extractTrustedCertificates(driverConfig) {
    return driverConfig.trustedCertificates || [];
  }

  static _extractKnownHostsPath(driverConfig) {
    return driverConfig.knownHosts || null;
  }
};

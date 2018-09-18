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

import Platform from './platform';
import {SERVICE_UNAVAILABLE} from '../error';

const DEFAULT_CONNECTION_TIMEOUT_MILLIS = 5000; // 5 seconds by default

export default class ChannelConfig {

  /**
   * @constructor
   * @param {Url} url the URL for the channel to connect to.
   * @param {object} driverConfig the driver config provided by the user when driver is created.
   * @param {string} connectionErrorCode the default error code to use on connection errors.
   */
  constructor(url, driverConfig, connectionErrorCode) {
    this.url = url;
    this.encrypted = extractEncrypted(driverConfig);
    this.trust = extractTrust(driverConfig);
    this.trustedCertificates = extractTrustedCertificates(driverConfig);
    this.knownHostsPath = extractKnownHostsPath(driverConfig);
    this.connectionErrorCode = connectionErrorCode || SERVICE_UNAVAILABLE;
    this.connectionTimeout = extractConnectionTimeout(driverConfig);
  }
}

function extractEncrypted(driverConfig) {
  // check if encryption was configured by the user, use explicit null check because we permit boolean value
  const encryptionNotConfigured = driverConfig.encrypted == null;
  // default to using encryption if trust-all-certificates is available
  if (encryptionNotConfigured && Platform.trustAllCertificatesAvailable()) {
    return true;
  }
  return driverConfig.encrypted;
}

function extractTrust(driverConfig) {
  if (driverConfig.trust) {
    return driverConfig.trust;
  }
  // default to using TRUST_ALL_CERTIFICATES if it is available
  return Platform.trustAllCertificatesAvailable() ? 'TRUST_ALL_CERTIFICATES' : 'TRUST_CUSTOM_CA_SIGNED_CERTIFICATES';
}

function extractTrustedCertificates(driverConfig) {
  return driverConfig.trustedCertificates || [];
}

function extractKnownHostsPath(driverConfig) {
  return driverConfig.knownHosts || null;
}

function extractConnectionTimeout(driverConfig) {
  const configuredTimeout = parseInt(driverConfig.connectionTimeout, 10);
  if (configuredTimeout === 0) {
    // timeout explicitly configured to 0
    return null;
  } else if (configuredTimeout && configuredTimeout < 0) {
    // timeout explicitly configured to a negative value
    return null;
  } else if (!configuredTimeout) {
    // timeout not configured, use default value
    return DEFAULT_CONNECTION_TIMEOUT_MILLIS;
  } else {
    // timeout configured, use the provided value
    return configuredTimeout;
  }
}

/**
 * Copyright (c) "Neo4j"
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

import { newError, error, internal } from 'neo4j-driver-core'

const {
  util: { ENCRYPTION_OFF, ENCRYPTION_ON }
} = internal

const { SERVICE_UNAVAILABLE } = error

const DEFAULT_CONNECTION_TIMEOUT_MILLIS = 30000 // 30 seconds by default

const ALLOWED_VALUES_ENCRYPTED = [
  null,
  undefined,
  true,
  false,
  ENCRYPTION_ON,
  ENCRYPTION_OFF
]

const ALLOWED_VALUES_TRUST = [
  null,
  undefined,
  'TRUST_ALL_CERTIFICATES',
  'TRUST_CUSTOM_CA_SIGNED_CERTIFICATES',
  'TRUST_SYSTEM_CA_SIGNED_CERTIFICATES'
]

export default class ChannelConfig {
  /**
   * @constructor
   * @param {ServerAddress} address the address for the channel to connect to.
   * @param {Object} driverConfig the driver config provided by the user when driver is created.
   * @param {string} connectionErrorCode the default error code to use on connection errors.
   */
  constructor (address, driverConfig, connectionErrorCode) {
    this.address = address
    this.encrypted = extractEncrypted(driverConfig)
    this.trust = extractTrust(driverConfig)
    this.trustedCertificates = extractTrustedCertificates(driverConfig)
    this.knownHostsPath = extractKnownHostsPath(driverConfig)
    this.connectionErrorCode = connectionErrorCode || SERVICE_UNAVAILABLE
    this.connectionTimeout = extractConnectionTimeout(driverConfig)
  }
}

function extractEncrypted (driverConfig) {
  const value = driverConfig.encrypted
  if (ALLOWED_VALUES_ENCRYPTED.indexOf(value) === -1) {
    throw newError(
      `Illegal value of the encrypted setting ${value}. Expected one of ${ALLOWED_VALUES_ENCRYPTED}`
    )
  }
  return value
}

function extractTrust (driverConfig) {
  const value = driverConfig.trust
  if (ALLOWED_VALUES_TRUST.indexOf(value) === -1) {
    throw newError(
      `Illegal value of the trust setting ${value}. Expected one of ${ALLOWED_VALUES_TRUST}`
    )
  }
  return value
}

function extractTrustedCertificates (driverConfig) {
  return driverConfig.trustedCertificates || []
}

function extractKnownHostsPath (driverConfig) {
  return driverConfig.knownHosts || null
}

function extractConnectionTimeout (driverConfig) {
  const configuredTimeout = parseInt(driverConfig.connectionTimeout, 10)
  if (configuredTimeout === 0) {
    // timeout explicitly configured to 0
    return null
  } else if (configuredTimeout && configuredTimeout < 0) {
    // timeout explicitly configured to a negative value
    return null
  } else if (!configuredTimeout) {
    // timeout not configured, use default value
    return DEFAULT_CONNECTION_TIMEOUT_MILLIS
  } else {
    // timeout configured, use the provided value
    return configuredTimeout
  }
}

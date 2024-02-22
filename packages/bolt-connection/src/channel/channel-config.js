/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [https://neo4j.com]
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
   * @param {object} clientCertificate the client certificate
   */
  constructor (address, driverConfig, connectionErrorCode, clientCertificate) {
    this.address = address
    this.encrypted = extractEncrypted(driverConfig)
    this.trust = extractTrust(driverConfig)
    this.trustedCertificates = extractTrustedCertificates(driverConfig)
    this.knownHostsPath = extractKnownHostsPath(driverConfig)
    this.connectionErrorCode = connectionErrorCode || SERVICE_UNAVAILABLE
    this.connectionTimeout = driverConfig.connectionTimeout
    this.clientCertificate = clientCertificate
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
